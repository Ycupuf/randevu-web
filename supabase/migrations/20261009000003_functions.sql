-- 3/4: İş mantığı fonksiyonları (RPC)
--
-- Randevuyla ilgili TÜM yazma işlemleri buradan geçer ve burada doğrulanır. Tarayıcıdaki
-- boş-saat hesabı (src/lib/slots.ts) yalnızca kullanıcıya gösterim içindir; yetki ve doğruluk
-- bu fonksiyonlardadır. Çakışmanın son sözünü `no_double_booking` kısıtı söyler.
-- Hata kodları düz anahtar kelimelerdir (örn. 'slot_unavailable'); uygulama bunları Türkçeye çevirir.

-- ---------------------------------------------------------------------------
-- Yardımcılar (private: API'ye açık değil)
-- ---------------------------------------------------------------------------

-- Randevu, kaynağın çalışma aralıklarından birinin içine tamamen sığıyor mu? (yerel saat, aynı gün)
create or replace function private.within_working_hours(
  p_resource_id uuid, p_tz text, p_starts timestamptz, p_ends timestamptz
) returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_ls timestamp := p_starts at time zone p_tz;
  v_le timestamp := p_ends at time zone p_tz;
  v_day timestamp := date_trunc('day', v_ls);
  v_s interval := v_ls - v_day;
  v_e interval := v_le - v_day;
begin
  if v_e > interval '24 hours' then
    return false;
  end if;
  return exists (
    select 1 from public.working_hours w
    where w.resource_id = p_resource_id
      and w.weekday = extract(dow from v_ls)::int
      and (w.start_time - time '00:00') <= v_s
      and v_e <= (w.end_time - time '00:00')
  );
end;
$$;

-- Kaynak (ya da tüm işletme) bu aralıkta izinli mi?
create or replace function private.has_time_off(
  p_business_id uuid, p_resource_id uuid, p_starts timestamptz, p_ends timestamptz
) returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.time_off t
    where t.business_id = p_business_id
      and (t.resource_id is null or t.resource_id = p_resource_id)
      and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(p_starts, p_ends, '[)')
  );
$$;

-- Müşteri için başlangıç kuralları: slot adımına hizalı, yeterince ileride, ufuk içinde.
create or replace function private.assert_bookable_start(
  p_start timestamptz, p_tz text, p_step int, p_min_notice int, p_horizon int
) returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_local timestamp := p_start at time zone p_tz;
begin
  if extract(second from v_local) <> 0
     or ((extract(hour from v_local)::int * 60 + extract(minute from v_local)::int) % p_step) <> 0 then
    raise exception 'invalid_time';
  end if;
  if p_start < now() + make_interval(mins => p_min_notice) then
    raise exception 'too_soon';
  end if;
  if (v_local::date - (now() at time zone p_tz)::date) > p_horizon then
    raise exception 'too_far';
  end if;
end;
$$;

-- Hizmeti şablon verileriyle ekler (varyant verilmişse süre/fiyat ilk varyanttan alınır).
create or replace function private.add_service(
  p_business_id uuid, p_name text, p_category text, p_duration int, p_price int,
  p_buffer int, p_sort int, p_variants jsonb default null
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_dur int := p_duration;
  v_price int := p_price;
begin
  if p_variants is not null then
    v_dur := (p_variants->0->>'duration_min')::int;
    v_price := nullif(p_variants->0->>'price_cents', '')::int;
  end if;
  insert into public.services (business_id, name, category, duration_min, price_cents, buffer_after_min, sort)
  values (p_business_id, p_name, p_category, v_dur, v_price, p_buffer, p_sort)
  returning id into v_id;
  if p_variants is not null then
    insert into public.service_variants (service_id, name, duration_min, price_cents, sort)
    select v_id, v->>'name', (v->>'duration_min')::int, nullif(v->>'price_cents', '')::int, (o - 1)::int
    from jsonb_array_elements(p_variants) with ordinality as t(v, o);
  end if;
  return v_id;
end;
$$;

-- Sektör şablonu: kurulumda hazır gelen hizmetler ve ekstra alanlar (fiyatlar kuruş cinsinden örnektir).
create or replace function private.apply_sector_template(p_business_id uuid, p_sector text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_sector = 'berber' then
    perform private.add_service(p_business_id, 'Saç kesimi', 'Saç', 30, 35000, 5, 1);
    perform private.add_service(p_business_id, 'Sakal', 'Sakal', 20, 20000, 5, 2);
    perform private.add_service(p_business_id, 'Saç ve sakal', 'Saç', 45, 50000, 5, 3);
    perform private.add_service(p_business_id, 'Boya', 'Saç', 90, 120000, 10, 4);

  elsif p_sector = 'guzellik' then
    perform private.add_service(p_business_id, 'Manikür', 'Tırnak', 45, 40000, 10, 1);
    perform private.add_service(p_business_id, 'Pedikür', 'Tırnak', 60, 50000, 10, 2);
    perform private.add_service(p_business_id, 'Cilt bakımı', 'Cilt', 60, 90000, 15, 3);
    perform private.add_service(p_business_id, 'Kaş şekillendirme', 'Yüz', 20, 25000, 5, 4);
    perform private.add_service(p_business_id, 'Lazer epilasyon', 'Lazer', 30, null, 10, 5, jsonb_build_array(
      jsonb_build_object('name', 'Koltuk altı', 'duration_min', 15, 'price_cents', 30000),
      jsonb_build_object('name', 'Kol', 'duration_min', 30, 'price_cents', 60000),
      jsonb_build_object('name', 'Bacak', 'duration_min', 45, 'price_cents', 90000)));
    insert into public.booking_fields (business_id, key, label, field_type, required, sort)
    values (p_business_id, 'hassasiyet', 'Alerji ya da cilt hassasiyetin var mı?', 'textarea', false, 1);

  elsif p_sector = 'oto_yikama' then
    perform private.add_service(p_business_id, 'Dış yıkama', 'Yıkama', 30, null, 10, 1, jsonb_build_array(
      jsonb_build_object('name', 'Otomobil', 'duration_min', 30, 'price_cents', 25000),
      jsonb_build_object('name', 'SUV', 'duration_min', 40, 'price_cents', 35000),
      jsonb_build_object('name', 'Ticari', 'duration_min', 50, 'price_cents', 45000)));
    perform private.add_service(p_business_id, 'İç temizlik', 'Temizlik', 45, null, 10, 2, jsonb_build_array(
      jsonb_build_object('name', 'Otomobil', 'duration_min', 45, 'price_cents', 40000),
      jsonb_build_object('name', 'SUV', 'duration_min', 60, 'price_cents', 55000),
      jsonb_build_object('name', 'Ticari', 'duration_min', 75, 'price_cents', 70000)));
    perform private.add_service(p_business_id, 'Detaylı temizlik', 'Temizlik', 150, null, 15, 3, jsonb_build_array(
      jsonb_build_object('name', 'Otomobil', 'duration_min', 150, 'price_cents', 200000),
      jsonb_build_object('name', 'SUV', 'duration_min', 180, 'price_cents', 260000),
      jsonb_build_object('name', 'Ticari', 'duration_min', 210, 'price_cents', 320000)));
    insert into public.booking_fields (business_id, key, label, field_type, required, sort)
    values
      (p_business_id, 'plaka', 'Araç plakası', 'text', true, 1),
      (p_business_id, 'arac_modeli', 'Araç markası ve modeli', 'text', false, 2);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Randevu oluştur (müşteri kendisi için, ya da işletme üyesi bir müşteri adına)
-- ---------------------------------------------------------------------------
-- p_items: [{"service_id": "...", "variant_id": "..." | null}] (1-5 hizmet)
-- p_resource_id: boş = "fark etmez / otomatik", ilk uygun kaynak seçilir
-- p_customer: {"full_name", "phone" (+905XXXXXXXXX), "email"}; çevrimiçi müşteri için zorunlu
-- p_customer_id: dolu ise işletme üyesinin manuel randevusu (müşteri o işletmeye ait olmalı)
create or replace function public.create_appointment(
  p_business_id uuid,
  p_starts_at timestamptz,
  p_items jsonb,
  p_resource_id uuid default null,
  p_customer jsonb default null,
  p_customer_id uuid default null,
  p_field_answers jsonb default '{}'::jsonb,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_biz public.businesses;
  v_set public.business_settings;
  v_manual boolean := p_customer_id is not null;
  v_customer_id uuid;
  v_lines jsonb := '[]'::jsonb;
  v_item record;
  v_service public.services;
  v_variant public.service_variants;
  v_service_ids uuid[] := '{}';
  v_total_min int := 0;
  v_buffer int := 0;
  v_dur int;
  v_price int;
  v_name text;
  v_answers jsonb;
  v_ends timestamptz;
  v_blocks timestamptz;
  v_status public.appointment_status;
  v_appt_id uuid;
  v_candidate uuid;
  v_active int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_biz from public.businesses where id = p_business_id;
  if not found then
    raise exception 'business_not_found';
  end if;
  select * into v_set from public.business_settings where business_id = p_business_id;

  -- Müşteri kaydı
  if v_manual then
    if not private.is_business_member(p_business_id) then
      raise exception 'forbidden';
    end if;
    perform 1 from public.customers where id = p_customer_id and business_id = p_business_id;
    if not found then
      raise exception 'customer_not_found';
    end if;
    v_customer_id := p_customer_id;
  else
    if not v_biz.published then
      raise exception 'business_not_found';
    end if;
    if p_customer is null
       or char_length(coalesce(trim(p_customer->>'full_name'), '')) not between 2 and 80
       or coalesce(p_customer->>'email', '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
       or coalesce(p_customer->>'phone', '') !~ '^\+905[0-9]{9}$' then
      raise exception 'invalid_customer';
    end if;
    insert into public.customers (business_id, user_id, full_name, phone, email)
    values (p_business_id, v_uid, trim(p_customer->>'full_name'), p_customer->>'phone', lower(p_customer->>'email'))
    on conflict (business_id, user_id) do update
      set full_name = excluded.full_name, phone = excluded.phone, email = excluded.email
    returning id into v_customer_id;
  end if;

  -- Hizmetler: süre ve fiyat veritabanındaki kayıtlardan hesaplanır, istemciye güvenilmez
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 5 then
    raise exception 'invalid_items';
  end if;
  for v_item in
    select (e->>'service_id')::uuid as service_id, nullif(e->>'variant_id', '')::uuid as variant_id
    from jsonb_array_elements(p_items) as e
  loop
    select * into v_service from public.services s
      where s.id = v_item.service_id and s.business_id = p_business_id and s.active;
    if not found then
      raise exception 'service_not_found';
    end if;
    if v_item.service_id = any (v_service_ids) then
      raise exception 'duplicate_service';
    end if;
    v_service_ids := v_service_ids || v_item.service_id;

    if v_item.variant_id is not null then
      select * into v_variant from public.service_variants v
        where v.id = v_item.variant_id and v.service_id = v_service.id;
      if not found then
        raise exception 'variant_not_found';
      end if;
      v_dur := v_variant.duration_min;
      v_price := v_variant.price_cents;
      v_name := v_service.name || ' (' || v_variant.name || ')';
    else
      if exists (select 1 from public.service_variants v where v.service_id = v_service.id) then
        raise exception 'variant_required';
      end if;
      v_dur := v_service.duration_min;
      v_price := v_service.price_cents;
      v_name := v_service.name;
    end if;

    v_total_min := v_total_min + v_dur;
    v_buffer := greatest(v_buffer, v_service.buffer_after_min);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'service_id', v_service.id, 'variant_id', v_item.variant_id,
      'name', v_name, 'duration_min', v_dur, 'price_cents', v_price));
  end loop;

  -- Ekstra alanlar: yalnızca tanımlı anahtarlar saklanır; zorunlu olanlar dolu olmalı (çevrimiçi)
  select coalesce(
           jsonb_object_agg(f.key, left(trim(p_field_answers->>f.key), 200))
             filter (where nullif(trim(p_field_answers->>f.key), '') is not null),
           '{}'::jsonb)
    into v_answers
    from public.booking_fields f
   where f.business_id = p_business_id;
  if not v_manual and exists (
    select 1 from public.booking_fields f
    where f.business_id = p_business_id and f.required and not (v_answers ? f.key)
  ) then
    raise exception 'field_required';
  end if;

  v_ends := p_starts_at + make_interval(mins => v_total_min);
  v_blocks := v_ends + make_interval(mins => v_buffer);

  -- Çevrimiçi müşteriye özel kurallar
  if not v_manual then
    perform private.assert_bookable_start(
      p_starts_at, v_biz.timezone, v_set.step_min, v_set.min_notice_min, v_set.horizon_days);
    select count(*) into v_active from public.appointments a
      where a.customer_id = v_customer_id
        and a.status in ('pending', 'confirmed')
        and a.ends_at > now();
    if v_active >= v_set.max_active_per_customer then
      raise exception 'too_many_active';
    end if;
  end if;

  v_status := case
    when v_manual or v_set.approval_mode = 'auto' then 'confirmed'::public.appointment_status
    else 'pending'::public.appointment_status
  end;

  -- Kaynak: istenen kaynak, yoksa hizmetlerin hepsini yapabilen ilk uygun kaynak
  for v_candidate in
    select r.id from public.resources r
    where r.business_id = p_business_id
      and r.active
      and (p_resource_id is null or r.id = p_resource_id)
      and not exists (
        select 1 from unnest(v_service_ids) as sid
        where not exists (
          select 1 from public.resource_services rs
          where rs.resource_id = r.id and rs.service_id = sid))
    order by r.sort, r.created_at
  loop
    continue when not private.within_working_hours(v_candidate, v_biz.timezone, p_starts_at, v_ends);
    continue when private.has_time_off(p_business_id, v_candidate, p_starts_at, v_ends);
    begin
      insert into public.appointments (
        business_id, customer_id, resource_id, starts_at, ends_at, blocks_until,
        status, source, field_answers, note)
      values (
        p_business_id, v_customer_id, v_candidate, p_starts_at, v_ends, v_blocks,
        v_status,
        case when v_manual then 'manual'::public.appointment_source else 'online'::public.appointment_source end,
        v_answers, nullif(left(trim(coalesce(p_note, '')), 500), ''))
      returning id into v_appt_id;
      exit;
    exception when exclusion_violation then
      v_appt_id := null; -- başkası aynı anda aldı, sıradaki kaynağı dene
    end;
  end loop;

  if v_appt_id is null then
    raise exception 'slot_unavailable';
  end if;

  insert into public.appointment_items (appointment_id, service_id, variant_id, name, duration_min, price_cents)
  select v_appt_id, (l->>'service_id')::uuid, nullif(l->>'variant_id', '')::uuid,
         l->>'name', (l->>'duration_min')::int, nullif(l->>'price_cents', '')::int
  from jsonb_array_elements(v_lines) as l;

  return v_appt_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Randevu iptal
-- ---------------------------------------------------------------------------
create or replace function public.cancel_appointment(p_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_a public.appointments;
  v_set public.business_settings;
  v_is_member boolean;
  v_is_customer boolean;
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
    raise exception 'appointment_not_found'; -- varlığını sızdırma
  end if;
  if v_a.status not in ('pending', 'confirmed') then
    raise exception 'not_modifiable';
  end if;
  select * into v_set from public.business_settings where business_id = v_a.business_id;
  if not v_is_member
     and v_a.starts_at - now() < make_interval(mins => v_set.cancel_window_min) then
    raise exception 'modify_window_passed';
  end if;
  update public.appointments
     set status = 'cancelled',
         cancelled_by = case when v_is_member then 'business' else 'customer' end,
         cancel_reason = nullif(left(trim(coalesce(p_reason, '')), 300), '')
   where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Randevu taşı (tek adımda; yeni saat doluysa eski randevu olduğu gibi kalır)
-- ---------------------------------------------------------------------------
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
           status = case
             when not v_is_member and v_set.approval_mode = 'manual' then 'pending'::public.appointment_status
             else status end
     where id = p_id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Durum değiştir (yalnızca işletme tarafı: onay, geldi, gelmedi, iptal)
-- ---------------------------------------------------------------------------
create or replace function public.set_appointment_status(p_id uuid, p_status public.appointment_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_a public.appointments;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_a from public.appointments where id = p_id for update;
  if not found
     or not (private.is_business_owner(v_a.business_id) or private.is_resource_staff(v_a.resource_id)) then
    raise exception 'appointment_not_found';
  end if;

  if not (
       (v_a.status = 'pending'   and p_status in ('confirmed', 'cancelled'))
    or (v_a.status = 'confirmed' and p_status in ('completed', 'no_show', 'cancelled'))
  ) then
    raise exception 'invalid_transition';
  end if;
  if p_status in ('completed', 'no_show') and v_a.starts_at > now() then
    raise exception 'too_early';
  end if;

  update public.appointments
     set status = p_status,
         cancelled_by = case when p_status = 'cancelled' then 'business' else cancelled_by end
   where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dolu zamanlar: müşteri tarafı boş saat hesabı için. Kimin randevusu olduğunu ya da izin
-- gerekçesini ASLA döndürmez, yalnızca zaman aralıklarını.
-- ---------------------------------------------------------------------------
create or replace function public.busy_slots(
  p_resource_ids uuid[], p_from timestamptz, p_to timestamptz
) returns table (resource_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_to <= p_from or p_to - p_from > interval '62 days' then
    raise exception 'invalid_range';
  end if;
  return query
    select a.resource_id, a.starts_at, a.blocks_until
    from public.appointments a
    join public.businesses b on b.id = a.business_id
    where a.resource_id = any (p_resource_ids)
      and a.status in ('pending', 'confirmed')
      and tstzrange(a.starts_at, a.blocks_until, '[)') && tstzrange(p_from, p_to, '[)')
      and (b.published or private.is_business_member(b.id))
    union all
    select r.id, t.starts_at, t.ends_at
    from public.resources r
    join public.businesses b on b.id = r.business_id
    join public.time_off t
      on t.business_id = r.business_id and (t.resource_id is null or t.resource_id = r.id)
    where r.id = any (p_resource_ids)
      and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(p_from, p_to, '[)')
      and (b.published or private.is_business_member(b.id));
end;
$$;

-- ---------------------------------------------------------------------------
-- İşletme kur: işletme + varsayılan ayarlar + sahip üyeliği + sektör şablonu
-- ---------------------------------------------------------------------------
create or replace function public.create_business(
  p_name text, p_slug text, p_sector text,
  p_phone text default null, p_address text default null, p_city text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if (select count(*) from public.business_members m where m.user_id = v_uid and m.role = 'owner') >= 5 then
    raise exception 'business_limit';
  end if;

  begin
    insert into public.businesses (name, slug, sector, phone, address, city)
    values (trim(p_name), lower(trim(p_slug)), p_sector,
            nullif(trim(coalesce(p_phone, '')), ''),
            nullif(trim(coalesce(p_address, '')), ''),
            nullif(trim(coalesce(p_city, '')), ''))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'slug_taken';
  end;

  insert into public.business_settings (business_id, resource_selection, resource_label)
  values (
    v_id,
    case p_sector when 'oto_yikama' then 'auto'::public.resource_selection else 'customer'::public.resource_selection end,
    case p_sector
      when 'berber' then 'Personel'
      when 'guzellik' then 'Uzman'
      when 'oto_yikama' then 'Yıkama bayı'
      else 'Kaynak' end);

  insert into public.business_members (business_id, user_id, role) values (v_id, v_uid, 'owner');
  perform private.apply_sector_template(v_id, p_sector);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler: yazma RPC'leri yalnızca giriş yapmış kullanıcıya; busy_slots herkese (RLS dışı ama sızıntısız)
-- ---------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_appointment', 'cancel_appointment', 'reschedule_appointment',
                        'set_appointment_status', 'create_business')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;

  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'busy_slots'
  loop
    execute format('revoke all on function %s from public', f.sig);
    execute format('grant execute on function %s to anon, authenticated', f.sig);
  end loop;
end
$$;

-- private şemasındaki iş fonksiyonları yalnızca yukarıdaki security definer fonksiyonlardan çağrılır
revoke execute on function private.within_working_hours(uuid, text, timestamptz, timestamptz) from public;
revoke execute on function private.has_time_off(uuid, uuid, timestamptz, timestamptz) from public;
revoke execute on function private.assert_bookable_start(timestamptz, text, int, int, int) from public;
revoke execute on function private.add_service(uuid, text, text, int, int, int, int, jsonb) from public;
revoke execute on function private.apply_sector_template(uuid, text) from public;
revoke execute on function private.touch_updated_at() from public;
