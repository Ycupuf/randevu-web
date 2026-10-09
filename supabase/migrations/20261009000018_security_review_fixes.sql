-- 18/18: Bağımsız güvenlik incelemesinin bulguları (hepsi canlıda sömürüsü kanıtlandıktan sonra düzeltildi).
--
-- Y2  Demo sahibi (herkes olabilir) businesses.slug'ı değiştirip "korumalı" demo işletmesini silebiliyordu;
--     timezone'a geçersiz değer yazılabiliyordu. -> sütun bazlı UPDATE yetkisi + değişmezlik/doğrulama tetikleyicisi.
-- O2  Müşteri kendi customers satırının business_id'sini başka işletmeye çevirebiliyordu. -> sütun yetkisi.
-- Y1b Üyeler hesapsız müşteriyi serbest e-postayla ekleyip manuel randevuyla o adrese e-posta tetikleyebiliyordu.
--     -> customers INSERT'te e-posta sütunu kapalı (hesapsız müşterinin e-postası olmaz).
-- D1/D3 resources.user_id istemciden yazılamaz ve işletme üyesi olmalı; data_requests.status istemciden yazılamaz.
-- O1  E-posta bombalama: alıcı başına saatte en fazla 30 e-posta kuyruğa girer.
-- O3  Demo müşteri sıfırlaması müşteri satırını (ad, telefon) da siler; demo işletmelerde GERÇEK hesapla alınan
--     randevular ve müşteriler 24 saat sonra silinir (paylaşılan demo sahibi bunları görebildiği için).
-- O4  Demo sıfırlamaları en fazla 20 saniyede bir çalışır (ağır işlem, hesapsız tetiklenebiliyordu).
-- D4  Takılı kalan 'sending' satırları 'failed' olur; sonuçlanmış e-posta kayıtları 30 gün sonra silinir.
-- D10 Randevu taşınınca 24 saat hatırlatması yeni saate göre yeniden planlanır.

-- ---------------------------------------------------------------------------
-- 1) Sütun bazlı yazma yetkileri (RLS satırı korur, bunlar hangi SÜTUNUN yazılabildiğini belirler)
-- ---------------------------------------------------------------------------
revoke update on public.businesses from authenticated;
grant update (name, description, address, city, phone, published) on public.businesses to authenticated;

revoke insert, update on public.customers from authenticated;
grant insert (business_id, full_name, phone) on public.customers to authenticated;
grant update (full_name, phone) on public.customers to authenticated;

revoke insert, update on public.resources from authenticated;
grant insert (business_id, name, kind, sort, active) on public.resources to authenticated;
grant update (name, kind, sort, active) on public.resources to authenticated;

revoke insert on public.data_requests from authenticated;
grant insert (user_id, kind) on public.data_requests to authenticated;

-- ---------------------------------------------------------------------------
-- 2) İşletme değişmezlikleri ve doğrulama (yetki dışı yollar için de geçerli)
-- ---------------------------------------------------------------------------
create function private.guard_business()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.slug is distinct from old.slug then
    raise exception 'slug_immutable';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.timezone) then
    raise exception 'invalid_timezone';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_business() from public;

create trigger businesses_guard
  before insert or update on public.businesses
  for each row execute function private.guard_business();

-- Personel hesabı bağlanan kaynak, o işletmenin üyesi olmalı
create function private.guard_resource_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null and not exists (
       select 1 from public.business_members m
        where m.business_id = new.business_id and m.user_id = new.user_id) then
    raise exception 'invalid_staff';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_resource_staff() from public;

create trigger resources_guard_staff
  before insert or update of user_id, business_id on public.resources
  for each row execute function private.guard_resource_staff();

-- ---------------------------------------------------------------------------
-- 3) E-posta: hız sınırı, hatırlatmanın yeniden planlanması, temizlik
-- ---------------------------------------------------------------------------
create function private.email_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.email_outbox o
       where o.to_email = new.to_email and o.created_at > now() - interval '1 hour') >= 30 then
    return null; -- sessizce atla: randevu işlemi bozulmaz
  end if;
  return new;
end;
$$;

revoke execute on function private.email_rate_limit() from public;

create trigger email_outbox_rate_limit
  before insert on public.email_outbox
  for each row execute function private.email_rate_limit();

create or replace function private.enqueue_appointment_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_kind text;
  v_payload jsonb := '{}'::jsonb;
  v_moved boolean;
  v_prev_resource text;
begin
  if tg_op = 'INSERT' and new.source = 'online' and new.status in ('pending', 'confirmed') then
    insert into public.email_outbox (kind, appointment_id, to_email)
    select 'owner_new', new.id, e from private.appointment_owner_emails(new.business_id, new.resource_id) as e
    on conflict do nothing;
  end if;

  if tg_op = 'UPDATE' and new.status = 'cancelled' and old.status in ('pending', 'confirmed')
     and new.cancelled_by = 'customer' then
    insert into public.email_outbox (kind, appointment_id, to_email)
    select 'owner_cancelled', new.id, e from private.appointment_owner_emails(new.business_id, new.resource_id) as e
    on conflict do nothing;
  end if;

  v_moved := tg_op = 'UPDATE'
    and old.status in ('pending', 'confirmed') and new.status in ('pending', 'confirmed')
    and (new.starts_at is distinct from old.starts_at or new.resource_id is distinct from old.resource_id);

  -- Saat değişti: eski saate göre planlanmış/gönderilmiş hatırlatma geçersiz, yenisi yeniden üretilebilsin
  if v_moved then
    delete from public.email_outbox where appointment_id = new.id and kind = 'reminder';
  end if;

  if v_moved and new.rescheduled_by = 'customer' then
    select r.name into v_prev_resource from public.resources r
     where r.id = old.resource_id and old.resource_id is distinct from new.resource_id;
    insert into public.email_outbox (kind, appointment_id, to_email, payload)
    select 'owner_rescheduled', new.id, e,
           jsonb_strip_nulls(jsonb_build_object('previous_starts_at', old.starts_at, 'previous_resource_name', v_prev_resource))
      from private.appointment_owner_emails(
             new.business_id, new.resource_id,
             case when old.resource_id is distinct from new.resource_id then old.resource_id end) as e;
  end if;

  select lower(trim(c.email)) into v_email from public.customers c where c.id = new.customer_id;
  if v_email is null or v_email = '' or v_email like '%@randevu.test' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'confirmed' then v_kind := 'booked';
    elsif new.status = 'pending' then v_kind := 'received';
    end if;
  elsif v_moved then
    v_kind := 'rescheduled';
    v_payload := jsonb_build_object('previous_starts_at', old.starts_at);
  elsif new.status is distinct from old.status then
    if new.status = 'confirmed' and old.status = 'pending' then
      v_kind := 'confirmed';
    elsif new.status = 'cancelled' and old.status in ('pending', 'confirmed') then
      v_kind := 'cancelled';
      v_payload := jsonb_build_object('cancelled_by', new.cancelled_by);
    end if;
  end if;

  if v_kind is not null then
    insert into public.email_outbox (kind, appointment_id, to_email, payload)
    values (v_kind, new.id, v_email, v_payload);
  end if;
  return new;
end;
$$;

revoke execute on function private.enqueue_appointment_email() from public;

select cron.schedule(
  'email-outbox-maintenance',
  '23 * * * *',
  $cron$
    update public.email_outbox
       set status = 'failed', error = coalesce(error, 'stuck_after_max_attempts')
     where status = 'sending' and attempts >= 5 and claimed_at < now() - interval '5 minutes';
    delete from public.email_outbox
     where status in ('sent', 'skipped', 'failed') and created_at < now() - interval '30 days'
  $cron$
);

-- ---------------------------------------------------------------------------
-- 4) Demo: sıfırlamalar kısıtlı ve kapsamı geniş, gerçek hesap verisi 24 saatte silinir
-- ---------------------------------------------------------------------------
create table private.demo_throttle (
  key text primary key,
  at timestamptz not null default now()
);

alter function public.reset_demo_owner() set schema private;
alter function private.reset_demo_owner() rename to reset_demo_owner_impl;
alter function public.reset_demo_customer() set schema private;
alter function private.reset_demo_customer() rename to reset_demo_customer_impl;
revoke all on function private.reset_demo_owner_impl() from public, anon, authenticated;
revoke all on function private.reset_demo_customer_impl() from public, anon, authenticated;

create function public.reset_demo_owner()
returns int
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.jwt() ->> 'email') is distinct from 'demo-isletme@randevu.test' then
    return 0;
  end if;
  insert into private.demo_throttle (key, at) values ('owner', now())
  on conflict (key) do update set at = now() where private.demo_throttle.at < now() - interval '20 seconds';
  if not found then
    return 0; -- çok sık: önceki sıfırlama geçerli
  end if;
  return private.reset_demo_owner_impl();
end;
$$;

create function public.reset_demo_customer()
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
  insert into private.demo_throttle (key, at) values ('customer', now())
  on conflict (key) do update set at = now() where private.demo_throttle.at < now() - interval '20 seconds';
  if not found then
    return 0;
  end if;
  v_n := private.reset_demo_customer_impl();
  -- Demo müşterinin ad ve telefonu da silinir (sonraki ziyaretçiler demo sahibi olarak görmesin)
  delete from public.customers where user_id = (select auth.uid());
  return v_n;
end;
$$;

revoke all on function public.reset_demo_owner() from public, anon;
revoke all on function public.reset_demo_customer() from public, anon;
grant execute on function public.reset_demo_owner() to authenticated;
grant execute on function public.reset_demo_customer() to authenticated;

-- Demo işletmelerde GERÇEK bir hesapla (örn. işe alım uzmanı) alınan randevular ve müşteri kayıtları 24 saat sonra silinir
select cron.schedule(
  'demo-real-user-purge',
  '7 * * * *',
  $cron$
    delete from public.appointments a
     using public.customers c, public.businesses b
     where a.customer_id = c.id and b.id = a.business_id and b.slug in ('demo-berber', 'demo-guzellik', 'demo-oto-yikama')
       and c.user_id is not null and coalesce(c.email, '') not like '%@randevu.test'
       and a.created_at < now() - interval '24 hours';
    delete from public.customers c
     using public.businesses b
     where b.id = c.business_id and b.slug in ('demo-berber', 'demo-guzellik', 'demo-oto-yikama')
       and c.user_id is not null and coalesce(c.email, '') not like '%@randevu.test'
       and c.created_at < now() - interval '24 hours'
       and not exists (select 1 from public.appointments a where a.customer_id = c.id)
  $cron$
);
