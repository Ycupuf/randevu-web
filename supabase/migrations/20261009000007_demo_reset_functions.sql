-- 7/7: Demo hesapları için sıfırlama fonksiyonları.
-- Demo kullanıcılarını (demo-musteri@randevu.test, demo-isletme@randevu.test) şifreleriyle birlikte
-- bu dosyada OLUŞTURMUYORUZ: şifre depoya girmemeli. Oluşturmak için scripts/create-demo-users.mjs.
--
-- Demo hesapları herkesle paylaşılır; her demo girişinde temiz bir başlangıç verilir.
-- Fonksiyonlar yalnızca ilgili demo hesabın kendisi çağırınca çalışır, başkalarında hiçbir şey yapmaz.

create or replace function public.reset_demo_customer()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := (select auth.jwt() ->> 'email');
  v_count int;
begin
  if v_uid is null or v_email is distinct from 'demo-musteri@randevu.test' then
    return 0;
  end if;
  delete from public.appointments a using public.customers c
   where a.customer_id = c.id and c.user_id = v_uid;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Demo işletme sahibi: kendi demo işletmelerinin randevularını, müşterilerini ve izinlerini temizler;
-- hizmet, kaynak ve saatlere dokunmaz.
create or replace function public.reset_demo_owner()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := (select auth.jwt() ->> 'email');
  v_count int;
begin
  if v_uid is null or v_email is distinct from 'demo-isletme@randevu.test' then
    return 0;
  end if;
  delete from public.appointments a
   where a.business_id in (select business_id from public.business_members where user_id = v_uid);
  get diagnostics v_count = row_count;
  delete from public.time_off t
   where t.business_id in (select business_id from public.business_members where user_id = v_uid);
  delete from public.customer_notes n
   where n.business_id in (select business_id from public.business_members where user_id = v_uid);
  delete from public.customers c
   where c.business_id in (select business_id from public.business_members where user_id = v_uid)
     and c.user_id is null;
  return v_count;
end;
$$;

revoke all on function public.reset_demo_customer() from public, anon;
revoke all on function public.reset_demo_owner() from public, anon;
grant execute on function public.reset_demo_customer() to authenticated;
grant execute on function public.reset_demo_owner() to authenticated;
