-- 20/20: Kod incelemesi bulguları (3. tur).
--
-- (1) Personel elle randevu ekleyemiyordu: migration 19 customers_select'i daralttı, istemci "customers'a ekle ve id'yi
--     geri oku" yaptığında yeni satır (henüz randevusu yok) okunamadığı için RLS hatası alıyordu; telefonla arama da
--     personel için boş dönüyordu (kopya müşteri). Köke inildi: hesapsız müşteri artık yetkiyi kendi içinde denetleyen
--     bir RPC ile oluşturulur/bulunur; istemcinin customers'a doğrudan INSERT yetkisi kaldırıldı.
-- (2) demo-real-user-purge 'demo-%' deseni kullanıyordu; kullanıcı 'demo-salon' adlı GERÇEK bir işletme açarsa müşterilerinin
--     randevuları 24 saatte silinirdi. Açık demo slug listesine geçildi.
-- (3) email_rate_limit alıcıya göre sayım yapıyordu ama destekleyen indeks yoktu.
-- (4) Demo müşteri sıfırlamasındaki 20 sn kısıtı kaldırıldı: kısıt devredeyken ikinci ziyaretçi öncekinin randevu ve
--     ad/telefon kaydını devralıyordu. Müşteri sıfırlaması ucuzdur (birkaç satır), kısıt yalnızca ağır olan sahip
--     sıfırlamasında kalır.

create function public.create_walkin_customer(p_business_id uuid, p_full_name text, p_phone text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := trim(coalesce(p_full_name, ''));
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  if not private.is_business_member(p_business_id) then
    raise exception 'forbidden';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'invalid_customer';
  end if;
  if p_phone is not null and p_phone !~ '^\+905[0-9]{9}$' then
    raise exception 'invalid_customer';
  end if;

  -- Aynı telefonla kayıtlı hesapsız müşteri varsa onu kullan (kopya müşteri oluşmasın)
  if p_phone is not null then
    select c.id into v_id from public.customers c
     where c.business_id = p_business_id and c.user_id is null and c.phone = p_phone
     limit 1;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.customers (business_id, full_name, phone)
  values (p_business_id, v_name, p_phone)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_walkin_customer(uuid, text, text) from public, anon;
grant execute on function public.create_walkin_customer(uuid, text, text) to authenticated;

revoke insert on public.customers from authenticated;

select cron.schedule(
  'demo-real-user-purge',
  '7 * * * *',
  $cron$
    delete from public.appointments a
     using public.customers c, public.businesses b
     where a.customer_id = c.id and b.id = a.business_id
       and b.slug in ('demo-berber', 'demo-guzellik', 'demo-oto-yikama')
       and c.user_id is not null and coalesce(c.email, '') not like '%@randevu.test'
       and a.created_at < now() - interval '24 hours';
    delete from public.customers c
     using public.businesses b
     where b.id = c.business_id
       and b.slug in ('demo-berber', 'demo-guzellik', 'demo-oto-yikama')
       and c.user_id is not null and coalesce(c.email, '') not like '%@randevu.test'
       and c.created_at < now() - interval '24 hours'
       and not exists (select 1 from public.appointments a where a.customer_id = c.id)
  $cron$
);

create index email_outbox_recipient_idx on public.email_outbox (to_email, created_at);

create or replace function public.reset_demo_customer()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if (select auth.jwt() ->> 'email') is distinct from 'demo-musteri@randevu.test' then
    return 0;
  end if;
  v_n := private.reset_demo_customer_impl();
  -- Demo müşterinin ad ve telefonu da silinir (sonraki ziyaretçiler demo sahibi olarak görmesin)
  delete from public.customers where user_id = (select auth.uid());
  return v_n;
end;
$$;
