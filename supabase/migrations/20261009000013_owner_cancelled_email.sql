-- 13/13: Müşteri randevusunu iptal edince işletmeye bildirim.
-- Yalnızca müşterinin kendi iptali (cancelled_by = 'customer'); işletmenin kendi iptali için kendisine e-posta gitmez.
-- Alıcı listesi tek bir yardımcı işlevde toplandı (yeni randevu ve iptal aynı alıcıları kullanır).

alter table public.email_outbox drop constraint email_outbox_kind_check;
alter table public.email_outbox
  add constraint email_outbox_kind_check
  check (kind in ('received', 'booked', 'confirmed', 'cancelled', 'rescheduled', 'reminder', 'owner_new', 'owner_cancelled'));

create unique index email_outbox_owner_cancelled_once on public.email_outbox (appointment_id, to_email) where kind = 'owner_cancelled';

-- İşletme alıcıları: sahipler + randevudaki kaynağın bağlı olduğu personel hesabı. Demo (@randevu.test) hariç.
create or replace function private.appointment_owner_emails(p_business_id uuid, p_resource_id uuid)
returns setof text
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
       where r.id = p_resource_id and r.user_id is not null
    ) x
    join auth.users u on u.id = x.user_id
   where u.email is not null and trim(u.email) <> '' and lower(u.email) not like '%@randevu.test';
$$;

revoke execute on function private.appointment_owner_emails(uuid, uuid) from public;

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
begin
  -- 1) İşletmeye: yeni online randevu
  if tg_op = 'INSERT' and new.source = 'online' and new.status in ('pending', 'confirmed') then
    insert into public.email_outbox (kind, appointment_id, to_email)
    select 'owner_new', new.id, e from private.appointment_owner_emails(new.business_id, new.resource_id) as e
    on conflict do nothing;
  end if;

  -- 2) İşletmeye: müşteri kendi randevusunu iptal etti
  if tg_op = 'UPDATE' and new.status = 'cancelled' and old.status in ('pending', 'confirmed')
     and new.cancelled_by = 'customer' then
    insert into public.email_outbox (kind, appointment_id, to_email)
    select 'owner_cancelled', new.id, e from private.appointment_owner_emails(new.business_id, new.resource_id) as e
    on conflict do nothing;
  end if;

  -- 3) Müşteriye
  select lower(trim(c.email)) into v_email from public.customers c where c.id = new.customer_id;
  if v_email is null or v_email = '' or v_email like '%@randevu.test' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'confirmed' then v_kind := 'booked';
    elsif new.status = 'pending' then v_kind := 'received';
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'confirmed' and old.status = 'pending' then
      v_kind := 'confirmed';
    elsif new.status = 'cancelled' and old.status in ('pending', 'confirmed') then
      v_kind := 'cancelled';
      v_payload := jsonb_build_object('cancelled_by', new.cancelled_by);
    end if;
  elsif new.status in ('pending', 'confirmed')
        and (new.starts_at is distinct from old.starts_at or new.resource_id is distinct from old.resource_id) then
    v_kind := 'rescheduled';
    v_payload := jsonb_build_object('previous_starts_at', old.starts_at);
  end if;

  if v_kind is not null then
    insert into public.email_outbox (kind, appointment_id, to_email, payload)
    values (v_kind, new.id, v_email, v_payload);
  end if;
  return new;
end;
$$;

revoke execute on function private.enqueue_appointment_email() from public;
