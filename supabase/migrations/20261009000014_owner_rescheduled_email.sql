-- 14/14: Müşteri saat değiştirince işletmeye bildirim (+ iki düzeltme).
-- (1) appointments.rescheduled_by: saati kim değiştirdi? İşletmenin kendi değişikliği için kendisine e-posta gitmez.
-- (2) Düzeltme: onay modu "manuel" iken müşteri saat değiştirince durum 'pending'e döner ve eski tetikleyici
--     durum değişikliği dalına girip "saat değişti" e-postasını (müşteriye de) hiç üretmiyordu. Saat/kaynak
--     değişikliği artık durum değişikliğinden bağımsız ele alınır.

alter table public.appointments
  add column rescheduled_by text check (rescheduled_by in ('customer', 'business'));

alter table public.email_outbox drop constraint email_outbox_kind_check;
alter table public.email_outbox
  add constraint email_outbox_kind_check
  check (kind in ('received', 'booked', 'confirmed', 'cancelled', 'rescheduled', 'reminder',
                  'owner_new', 'owner_cancelled', 'owner_rescheduled'));

create or replace function public.reschedule_appointment(
  p_id uuid, p_new_starts_at timestamptz, p_resource_id uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_a public.appointments;
  v_biz public.businesses;
  v_set public.business_settings;
  v_is_member boolean;
  v_is_customer boolean;
  v_total int;
  v_buffer int;
  v_ends timestamptz;
  v_resource uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_a from public.appointments where id = p_id for update;
  if not found then
    raise exception 'appointment_not_found';
  end if;
  v_is_member := private.is_business_owner(v_a.business_id) or private.is_resource_staff(v_a.resource_id);
  v_is_customer := exists (
    select 1 from public.customers c where c.id = v_a.customer_id and c.user_id = v_uid);
  if not (v_is_member or v_is_customer) then
    raise exception 'appointment_not_found';
  end if;
  if v_a.status not in ('pending', 'confirmed') then
    raise exception 'not_modifiable';
  end if;

  select * into v_biz from public.businesses where id = v_a.business_id;
  select * into v_set from public.business_settings where business_id = v_a.business_id;
  if not v_is_member
     and v_a.starts_at - now() < make_interval(mins => v_set.cancel_window_min) then
    raise exception 'modify_window_passed';
  end if;

  select coalesce(sum(duration_min), 0) into v_total
    from public.appointment_items where appointment_id = p_id;
  select coalesce(max(s.buffer_after_min), 0) into v_buffer
    from public.appointment_items i join public.services s on s.id = i.service_id
   where i.appointment_id = p_id;
  v_ends := p_new_starts_at + make_interval(mins => v_total);
  v_resource := coalesce(p_resource_id, v_a.resource_id);

  if v_resource <> v_a.resource_id then
    if not exists (
      select 1 from public.resources r
      where r.id = v_resource and r.business_id = v_a.business_id and r.active) then
      raise exception 'resource_not_found';
    end if;
    if exists (
      select 1 from public.appointment_items i
      where i.appointment_id = p_id and i.service_id is not null
        and not exists (
          select 1 from public.resource_services rs
          where rs.resource_id = v_resource and rs.service_id = i.service_id)) then
      raise exception 'resource_cannot_perform';
    end if;
  end if;

  if not v_is_member then
    perform private.assert_bookable_start(
      p_new_starts_at, v_biz.timezone, v_set.step_min, v_set.min_notice_min, v_set.horizon_days);
  end if;
  if not private.within_working_hours(v_resource, v_biz.timezone, p_new_starts_at, v_ends)
     or private.has_time_off(v_a.business_id, v_resource, p_new_starts_at, v_ends) then
    raise exception 'slot_unavailable';
  end if;

  begin
    update public.appointments
       set resource_id = v_resource,
           starts_at = p_new_starts_at,
           ends_at = v_ends,
           blocks_until = v_ends + make_interval(mins => v_buffer),
           rescheduled_by = case when v_is_member then 'business' else 'customer' end,
           status = case
             when not v_is_member and v_set.approval_mode = 'manual' then 'pending'::public.appointment_status
             else status end
     where id = p_id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable';
  end;
end;
$$;

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

  v_moved := tg_op = 'UPDATE'
    and old.status in ('pending', 'confirmed') and new.status in ('pending', 'confirmed')
    and (new.starts_at is distinct from old.starts_at or new.resource_id is distinct from old.resource_id);

  -- 3) İşletmeye: müşteri randevu saatini (ya da kişiyi) değiştirdi
  if v_moved and new.rescheduled_by = 'customer' then
    insert into public.email_outbox (kind, appointment_id, to_email, payload)
    select 'owner_rescheduled', new.id, e, jsonb_build_object('previous_starts_at', old.starts_at)
      from private.appointment_owner_emails(new.business_id, new.resource_id) as e;
  end if;

  -- 4) Müşteriye
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
