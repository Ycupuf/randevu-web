-- 15/15: (1) Kişi değişince eski kişiye de e-posta. (2) Yönetim panelinde bildirim merkezi.
--
-- Bildirimler işletme başına tek satırdır; kimin göreceğini RLS belirler: sahipler hepsini, personel yalnızca
-- kendi kaynağını ilgilendirenleri görür. Okundu bilgisi kullanıcı başına tutulur (notification_reads).
-- Gösterilecek bilgi (müşteri, hizmet, zaman) panel tarafından canlı okunur; burada yalnızca olay ve ek veri durur.
-- Sıfırlama sırasında (app.demo_reset) üretilen örnek randevular bildirim üretmez.

-- ---------------------------------------------------------------------------
-- 1) E-posta alıcıları: eski kaynağın personeli de eklenebilir
-- ---------------------------------------------------------------------------
drop function private.appointment_owner_emails(uuid, uuid);

create function private.appointment_owner_emails(
  p_business_id uuid, p_resource_id uuid, p_extra_resource_id uuid default null
) returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select distinct lower(trim(u.email))
    from (
      select m.user_id from public.business_members m
       where m.business_id = p_business_id and m.role = 'owner'
      union
      select r.user_id from public.resources r
       where r.id in (p_resource_id, p_extra_resource_id) and r.user_id is not null
    ) x
    join auth.users u on u.id = x.user_id
   where u.email is not null and trim(u.email) <> '' and lower(u.email) not like '%@randevu.test';
$$;

revoke execute on function private.appointment_owner_emails(uuid, uuid, uuid) from public;

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

  -- Müşteri saat/kişi değiştirdi: sahipler, yeni kişi ve (kişi değiştiyse) ESKİ kişi bilgilendirilir.
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

-- ---------------------------------------------------------------------------
-- 2) Bildirim tabloları
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  type text not null check (type in ('appointment_new', 'appointment_cancelled', 'appointment_rescheduled', 'customer_registered')),
  -- Randevu silinirse (yalnızca demo sıfırlama) bildirimi de gider
  appointment_id uuid references public.appointments (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  resource_id uuid references public.resources (id) on delete set null,
  -- Kişi değişen taşımada eski kaynak: o kişinin personeli de bildirimi görsün
  extra_resource_id uuid references public.resources (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index notifications_business_idx on public.notifications (business_id, created_at desc);
create index notifications_appointment_idx on public.notifications (appointment_id);
create index notifications_customer_idx on public.notifications (customer_id);

create table public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;

-- Okuma: sahipler işletmenin hepsini, personel yalnızca kendi kaynağını ilgilendirenleri görür.
-- Yazma politikası yok: yalnızca tetikleyiciler (security definer) yazar.
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    (select private.is_business_owner(business_id))
    or (select private.is_resource_staff(resource_id))
    or (select private.is_resource_staff(extra_resource_id))
  );

create policy notification_reads_select on public.notification_reads
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_reads_insert on public.notification_reads
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy notification_reads_delete on public.notification_reads
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.notifications from anon;
revoke all on public.notification_reads from anon;
-- tabloları yalnızca okuma ve kendi okundu kaydı için aç
revoke insert, update, delete on public.notifications from authenticated;
revoke update on public.notification_reads from authenticated;

-- RLS'in kendisi uygulanır (security invoker): yalnızca kullanıcının görebildiği bildirimler sayılır / işaretlenir.
create function public.unread_notification_count(p_business_id uuid)
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::int
    from public.notifications n
   where n.business_id = p_business_id
     and not exists (
       select 1 from public.notification_reads r
        where r.notification_id = n.id and r.user_id = (select auth.uid()));
$$;

create function public.mark_notifications_read(p_business_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.notification_reads (notification_id, user_id)
  select n.id, (select auth.uid()) from public.notifications n
   where n.business_id = p_business_id
  on conflict do nothing;
$$;

revoke all on function public.unread_notification_count(uuid) from public, anon;
revoke all on function public.mark_notifications_read(uuid) from public, anon;
grant execute on function public.unread_notification_count(uuid) to authenticated;
grant execute on function public.mark_notifications_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Bildirim üreten tetikleyiciler
-- ---------------------------------------------------------------------------
create function private.notify_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev_resource text;
begin
  if coalesce(current_setting('app.demo_reset', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.source = 'online' and new.status in ('pending', 'confirmed') then
      insert into public.notifications (business_id, type, appointment_id, customer_id, resource_id)
      values (new.business_id, 'appointment_new', new.id, new.customer_id, new.resource_id);
    end if;
    return new;
  end if;

  if new.status = 'cancelled' and old.status in ('pending', 'confirmed') and new.cancelled_by = 'customer' then
    insert into public.notifications (business_id, type, appointment_id, customer_id, resource_id)
    values (new.business_id, 'appointment_cancelled', new.id, new.customer_id, new.resource_id);
  elsif old.status in ('pending', 'confirmed') and new.status in ('pending', 'confirmed')
        and (new.starts_at is distinct from old.starts_at or new.resource_id is distinct from old.resource_id)
        and new.rescheduled_by = 'customer' then
    select r.name into v_prev_resource from public.resources r
     where r.id = old.resource_id and old.resource_id is distinct from new.resource_id;
    insert into public.notifications (business_id, type, appointment_id, customer_id, resource_id, extra_resource_id, data)
    values (
      new.business_id, 'appointment_rescheduled', new.id, new.customer_id, new.resource_id,
      case when old.resource_id is distinct from new.resource_id then old.resource_id end,
      jsonb_strip_nulls(jsonb_build_object('previous_starts_at', old.starts_at, 'previous_resource_name', v_prev_resource)));
  end if;
  return new;
end;
$$;

revoke execute on function private.notify_appointment() from public;

create trigger appointments_notify
  after insert or update on public.appointments
  for each row execute function private.notify_appointment();

-- Hesaplı yeni müşteri: işletmede ilk kez randevu alan (create_appointment müşteri kaydını açar; sonraki
-- randevularda kayıt yalnızca güncellenir, bu tetikleyici çalışmaz). Panelden elle eklenen (hesapsız) müşteri sayılmaz.
create function private.notify_customer_registered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null and coalesce(current_setting('app.demo_reset', true), '') <> 'on' then
    insert into public.notifications (business_id, type, customer_id)
    values (new.business_id, 'customer_registered', new.id);
  end if;
  return new;
end;
$$;

revoke execute on function private.notify_customer_registered() from public;

create trigger customers_notify_registered
  after insert on public.customers
  for each row execute function private.notify_customer_registered();

-- 90 günden eski bildirimler her gece silinir
select cron.schedule(
  'notifications-purge',
  '17 3 * * *',
  $cron$ delete from public.notifications where created_at < now() - interval '90 days' $cron$
);
