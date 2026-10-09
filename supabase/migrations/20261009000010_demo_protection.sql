-- 10/10: Paylaşılan demo işletmeleri ziyaretçi tarafından bozulamasın.
-- (1) Demo işletmelerinde işletme, hizmet, seçenek ve ekip kaydı SİLİNEMEZ (tetikleyici).
-- (2) reset_demo_owner demo işletmelerini tohum haline döndürür: yayın, bilgiler, ayarlar, hizmetler,
--     seçenekler, ek sorular, ekip, atamalar ve çalışma saatleri.
-- Tetikleyiciyi yalnızca sıfırlama işlevi, işlem içinde `app.demo_reset` ayarını açarak aşar.

create or replace function private.protect_demo_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  if coalesce(current_setting('app.demo_reset', true), '') = 'on' then
    return old;
  end if;
  if tg_table_name = 'businesses' then
    v_slug := old.slug;
  elsif tg_table_name in ('services', 'resources') then
    select b.slug into v_slug from public.businesses b where b.id = old.business_id;
  elsif tg_table_name = 'service_variants' then
    select b.slug into v_slug
      from public.services s join public.businesses b on b.id = s.business_id
     where s.id = old.service_id;
  end if;
  if v_slug in ('demo-berber', 'demo-guzellik', 'demo-oto-yikama') then
    raise exception 'demo_protected';
  end if;
  return old;
end;
$$;

revoke execute on function private.protect_demo_rows() from public;

create trigger protect_demo_businesses before delete on public.businesses
  for each row execute function private.protect_demo_rows();
create trigger protect_demo_services before delete on public.services
  for each row execute function private.protect_demo_rows();
create trigger protect_demo_variants before delete on public.service_variants
  for each row execute function private.protect_demo_rows();
create trigger protect_demo_resources before delete on public.resources
  for each row execute function private.protect_demo_rows();

create or replace function public.reset_demo_owner()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := (select auth.jwt() ->> 'email');
  v_count int := 0;
  sd record;
  v_biz uuid;
  v_tz text;
  v_res uuid;
  v_svc record;
  v_var_id uuid;
  v_var_name text;
  v_var_dur int;
  v_var_price int;
  v_cust uuid;
  v_date date;
  v_start timestamptz;
  v_end timestamptz;
  v_dur int;
  v_price int;
  v_name text;
  v_appt uuid;
  v_demo uuid[];
begin
  if v_uid is null or v_email is distinct from 'demo-isletme@randevu.test' then
    return 0;
  end if;

  -- 1) Temizle: yalnızca bu hesabın işletmeleri
  -- Yalnızca tohum ve elle girilen randevular (hesapsız müşteriler) silinir. Hesaplı müşterinin
  -- (demo müşteri ya da gerçek bir kullanıcı) aldığı randevu, panele girince kaybolmamalı.
  delete from public.appointments a
   using public.customers c
   where a.customer_id = c.id
     and c.user_id is null
     and a.business_id in (select business_id from public.business_members where user_id = v_uid);
  delete from public.time_off t
   where t.business_id in (select business_id from public.business_members where user_id = v_uid);
  delete from public.customer_notes n
   where n.business_id in (select business_id from public.business_members where user_id = v_uid);
  delete from public.customers c
   where c.business_id in (select business_id from public.business_members where user_id = v_uid)
     and c.user_id is null;


  -- 1b) Demo işletmelerini tohum haline döndür (ziyaretçi yayından kaldırmış, ad/saat/hizmet bozmuş olabilir).
  -- Hizmetler yerinde güncellenir (kimlikleri değişmez), böylece açık bir müşteri sihirbazı bozulmaz.
  select coalesce(array_agg(b.id), '{}') into v_demo
    from public.businesses b
    join public.business_members m on m.business_id = b.id and m.user_id = v_uid
   where b.slug in ('demo-berber', 'demo-guzellik', 'demo-oto-yikama');
  perform set_config('app.demo_reset', 'on', true);

  update public.businesses b set
      published = true, name = d.name, description = d.descr, address = d.addr, city = d.city, phone = d.phone
    from (values
      ('demo-berber', 'Demo Berber', 'Saç, sakal ve bakım. Randevusuz beklemek yok.', 'Örnek Mah. Cumhuriyet Cad. No:12', 'Gebze, Kocaeli', '0262 000 00 01'),
      ('demo-guzellik', 'Demo Güzellik Merkezi', 'Tırnak, cilt bakımı ve lazer epilasyon.', 'Örnek Mah. Lale Sok. No:5', 'Kadıköy, İstanbul', '0216 000 00 02'),
      ('demo-oto-yikama', 'Demo Oto Yıkama', 'Dış yıkama, iç temizlik ve detaylı temizlik. Aracını bırak, saatinde teslim al.', 'Sanayi Sitesi A Blok No:3', 'Pendik, İstanbul', '0216 000 00 03')
    ) as d(slug, name, descr, addr, city, phone)
   where b.slug = d.slug and b.id = any (v_demo);

  update public.business_settings s set
      approval_mode = 'auto', step_min = 15, min_notice_min = 60, horizon_days = 30,
      cancel_window_min = 120, max_active_per_customer = 3,
      resource_selection = case when b.sector = 'oto_yikama' then 'auto'::public.resource_selection else 'customer'::public.resource_selection end,
      resource_label = case b.sector when 'berber' then 'Personel' when 'guzellik' then 'Uzman' else 'Yıkama bayı' end
    from public.businesses b
   where b.id = s.business_id and b.id = any (v_demo);

  -- Hizmetler: değerleri sıra numarasına göre geri yaz, fazlalıkları sil
  update public.services s set
      name = v.name, category = v.cat, duration_min = v.dur, price_cents = v.price,
      buffer_after_min = v.buf, active = true
    from (values
      ('demo-berber', 1, 'Saç kesimi', 'Saç', 30, 35000, 5),
      ('demo-berber', 2, 'Sakal', 'Sakal', 20, 20000, 5),
      ('demo-berber', 3, 'Saç ve sakal', 'Saç', 45, 50000, 5),
      ('demo-berber', 4, 'Boya', 'Saç', 90, 120000, 10),
      ('demo-guzellik', 1, 'Manikür', 'Tırnak', 45, 40000, 10),
      ('demo-guzellik', 2, 'Pedikür', 'Tırnak', 60, 50000, 10),
      ('demo-guzellik', 3, 'Cilt bakımı', 'Cilt', 60, 90000, 15),
      ('demo-guzellik', 4, 'Kaş şekillendirme', 'Yüz', 20, 25000, 5),
      ('demo-guzellik', 5, 'Lazer epilasyon', 'Lazer', 15, 30000, 10),
      ('demo-oto-yikama', 1, 'Dış yıkama', 'Yıkama', 30, 25000, 10),
      ('demo-oto-yikama', 2, 'İç temizlik', 'Temizlik', 45, 40000, 10),
      ('demo-oto-yikama', 3, 'Detaylı temizlik', 'Temizlik', 150, 200000, 15)
    ) as v(slug, sort, name, cat, dur, price, buf)
    join public.businesses b on b.slug = v.slug
   where s.business_id = b.id and s.sort = v.sort and b.id = any (v_demo);
  delete from public.services s
   using public.businesses b
   where s.business_id = b.id and b.id = any (v_demo)
     and s.sort > case b.slug when 'demo-berber' then 4 when 'demo-guzellik' then 5 else 3 end;

  -- Seçenekler (araç tipi, lazer bölgesi): (hizmet sırası, seçenek sırası) ile geri yaz
  update public.service_variants sv set name = v.name, duration_min = v.dur, price_cents = v.price
    from (values
      ('demo-guzellik', 5, 0, 'Koltuk altı', 15, 30000),
      ('demo-guzellik', 5, 1, 'Kol', 30, 60000),
      ('demo-guzellik', 5, 2, 'Bacak', 45, 90000),
      ('demo-oto-yikama', 1, 0, 'Otomobil', 30, 25000),
      ('demo-oto-yikama', 1, 1, 'SUV', 40, 35000),
      ('demo-oto-yikama', 1, 2, 'Ticari', 50, 45000),
      ('demo-oto-yikama', 2, 0, 'Otomobil', 45, 40000),
      ('demo-oto-yikama', 2, 1, 'SUV', 60, 55000),
      ('demo-oto-yikama', 2, 2, 'Ticari', 75, 70000),
      ('demo-oto-yikama', 3, 0, 'Otomobil', 150, 200000),
      ('demo-oto-yikama', 3, 1, 'SUV', 180, 260000),
      ('demo-oto-yikama', 3, 2, 'Ticari', 210, 320000)
    ) as v(slug, ssort, vsort, name, dur, price)
    join public.businesses b on b.slug = v.slug
    join public.services s on s.business_id = b.id and s.sort = v.ssort
   where sv.service_id = s.id and sv.sort = v.vsort and b.id = any (v_demo);
  delete from public.service_variants sv
   using public.services s, public.businesses b
   where sv.service_id = s.id and s.business_id = b.id and b.id = any (v_demo)
     and sv.sort > 2;
  -- Seçeneği olmayan hizmete ziyaretçi seçenek eklemişse kaldır (yalnızca lazer ve oto yıkama hizmetlerinin seçeneği olur)
  delete from public.service_variants sv
   using public.services s, public.businesses b
   where sv.service_id = s.id and s.business_id = b.id and b.id = any (v_demo)
     and not ((b.slug = 'demo-guzellik' and s.sort = 5) or b.slug = 'demo-oto-yikama');

  -- Ek form soruları
  delete from public.booking_fields f where f.business_id = any (v_demo);
  insert into public.booking_fields (business_id, key, label, field_type, required, sort)
    select b.id, 'hassasiyet', 'Alerji ya da cilt hassasiyetin var mı?', 'textarea', false, 1
      from public.businesses b where b.slug = 'demo-guzellik' and b.id = any (v_demo);
  insert into public.booking_fields (business_id, key, label, field_type, required, sort)
    select b.id, k.key, k.label, 'text', k.req, k.sort
      from public.businesses b
      cross join (values ('plaka', 'Araç plakası', true, 1), ('arac_modeli', 'Araç markası ve modeli', false, 2)) as k(key, label, req, sort)
     where b.slug = 'demo-oto-yikama' and b.id = any (v_demo);

  -- Ekip: adları ve etkinliği geri yaz; randevusu olmayan fazlalıkları sil
  update public.resources r set name = v.name, active = true
    from (values
      ('demo-berber', 1, 'Mehmet'), ('demo-berber', 2, 'Ali'), ('demo-berber', 3, 'Burak'),
      ('demo-guzellik', 1, 'Selin'), ('demo-guzellik', 2, 'Derya'),
      ('demo-oto-yikama', 1, 'Bay 1'), ('demo-oto-yikama', 2, 'Bay 2'), ('demo-oto-yikama', 3, 'Bay 3')
    ) as v(slug, sort, name)
    join public.businesses b on b.slug = v.slug
   where r.business_id = b.id and r.sort = v.sort and b.id = any (v_demo);
  delete from public.resources r
   using public.businesses b
   where r.business_id = b.id and b.id = any (v_demo)
     and r.sort > case b.slug when 'demo-berber' then 3 when 'demo-guzellik' then 2 else 3 end
     and not exists (select 1 from public.appointments a where a.resource_id = r.id);

  -- Hizmet atamaları ve çalışma saatleri
  delete from public.resource_services rs using public.resources r
   where rs.resource_id = r.id and r.business_id = any (v_demo);
  delete from public.working_hours w using public.resources r
   where w.resource_id = r.id and r.business_id = any (v_demo);

  insert into public.resource_services (resource_id, service_id)
    select r.id, s.id
      from public.resources r
      join public.businesses b on b.id = r.business_id
      join public.services s on s.business_id = b.id
     where b.id = any (v_demo)
       and (b.slug in ('demo-berber', 'demo-oto-yikama')
            or (b.slug = 'demo-guzellik' and (
                 (r.name = 'Selin' and s.name in ('Manikür', 'Pedikür', 'Kaş şekillendirme'))
              or (r.name = 'Derya' and s.name in ('Cilt bakımı', 'Lazer epilasyon', 'Kaş şekillendirme')))))
    on conflict do nothing;

  insert into public.working_hours (resource_id, weekday, start_time, end_time)
    select r.id, d, t.s, t.e
      from public.resources r join public.businesses b on b.id = r.business_id
      cross join generate_series(1, 6) as d
      cross join (values ('09:00'::time, '13:00'::time), ('14:00'::time, '19:00'::time)) as t(s, e)
     where b.slug = 'demo-berber' and b.id = any (v_demo);
  insert into public.working_hours (resource_id, weekday, start_time, end_time)
    select r.id, d, '10:00'::time, '19:00'::time
      from public.resources r join public.businesses b on b.id = r.business_id
      cross join generate_series(2, 6) as d
     where b.slug = 'demo-guzellik' and b.id = any (v_demo);
  insert into public.working_hours (resource_id, weekday, start_time, end_time)
    select r.id, d, '08:00'::time, '18:00'::time
      from public.resources r join public.businesses b on b.id = r.business_id
      cross join generate_series(1, 6) as d
     where b.slug = 'demo-oto-yikama' and b.id = any (v_demo);
  insert into public.working_hours (resource_id, weekday, start_time, end_time)
    select r.id, 0, '10:00'::time, '16:00'::time
      from public.resources r join public.businesses b on b.id = r.business_id
     where b.slug = 'demo-oto-yikama' and b.id = any (v_demo);

  -- 2) Örnek randevular (gün farkı bugüne göre)
  for sd in
    select * from (values
      ('demo-berber', 'Mehmet', 0, '10:00', 'Saç kesimi', null, 'Ahmet Demir', '+905551110001', 'confirmed'),
      ('demo-berber', 'Mehmet', 0, '11:30', 'Saç ve sakal', null, 'Can Yıldız', '+905551110002', 'confirmed'),
      ('demo-berber', 'Ali', 0, '09:30', 'Sakal', null, 'Emre Çelik', '+905551110003', 'pending'),
      ('demo-berber', 'Ali', 0, '15:00', 'Boya', null, 'Serkan Aydın', '+905551110004', 'confirmed'),
      ('demo-berber', 'Burak', 0, '14:30', 'Saç kesimi', null, 'Kerem Tan', '+905551110005', 'confirmed'),
      ('demo-berber', 'Mehmet', 1, '09:15', 'Saç kesimi', null, 'Onur Acar', '+905551110006', 'confirmed'),
      ('demo-berber', 'Ali', 1, '16:00', 'Saç ve sakal', null, 'Barış Koç', '+905551110007', 'pending'),
      ('demo-berber', 'Burak', 1, '10:30', 'Sakal', null, 'Tolga Er', '+905551110009', 'confirmed'),
      ('demo-berber', 'Burak', -1, '10:30', 'Saç kesimi', null, 'Mert Şahin', '+905551110008', 'completed'),
      ('demo-berber', 'Mehmet', -1, '12:00', 'Sakal', null, 'Ahmet Demir', '+905551110001', 'completed'),
      ('demo-berber', 'Ali', -1, '14:15', 'Saç kesimi', null, 'Tolga Er', '+905551110009', 'no_show'),
      ('demo-berber', 'Burak', -2, '11:00', 'Boya', null, 'Yusuf Kara', '+905551110010', 'completed'),
      ('demo-berber', 'Mehmet', -2, '17:00', 'Saç ve sakal', null, 'Can Yıldız', '+905551110002', 'completed'),
      ('demo-berber', 'Ali', -3, '09:45', 'Saç kesimi', null, 'Emre Çelik', '+905551110003', 'completed'),
      ('demo-berber', 'Burak', -3, '15:30', 'Sakal', null, 'Kerem Tan', '+905551110005', 'no_show'),
      ('demo-berber', 'Mehmet', -4, '10:45', 'Saç kesimi', null, 'Onur Acar', '+905551110006', 'completed'),
      ('demo-berber', 'Ali', -5, '16:30', 'Saç ve sakal', null, 'Barış Koç', '+905551110007', 'completed'),
      ('demo-guzellik', 'Selin', 0, '11:00', 'Manikür', null, 'Elif Kaya', '+905552220001', 'confirmed'),
      ('demo-guzellik', 'Derya', 0, '10:30', 'Cilt bakımı', null, 'Selin Öztürk', '+905552220003', 'pending'),
      ('demo-guzellik', 'Selin', 1, '14:00', 'Pedikür', null, 'Zeynep Arslan', '+905552220002', 'confirmed'),
      ('demo-guzellik', 'Derya', 1, '15:30', 'Lazer epilasyon', 'Kol', 'Deniz Polat', '+905552220004', 'confirmed'),
      ('demo-guzellik', 'Selin', -1, '10:00', 'Manikür', null, 'Elif Kaya', '+905552220001', 'completed'),
      ('demo-guzellik', 'Derya', -2, '12:00', 'Cilt bakımı', null, 'Zeynep Arslan', '+905552220002', 'completed'),
      ('demo-guzellik', 'Selin', -2, '16:30', 'Kaş şekillendirme', null, 'Merve Çınar', '+905552220005', 'no_show'),
      ('demo-guzellik', 'Derya', -3, '13:30', 'Lazer epilasyon', 'Bacak', 'Selin Öztürk', '+905552220003', 'completed'),
      ('demo-oto-yikama', 'Bay 1', 0, '09:00', 'Dış yıkama', 'Otomobil', 'Murat Eren', '+905553330001', 'confirmed'),
      ('demo-oto-yikama', 'Bay 2', 0, '10:30', 'İç temizlik', 'SUV', 'Ozan Bulut', '+905553330002', 'confirmed'),
      ('demo-oto-yikama', 'Bay 1', 1, '13:00', 'Detaylı temizlik', 'Otomobil', 'Kaan Uçar', '+905553330003', 'pending'),
      ('demo-oto-yikama', 'Bay 3', -1, '11:00', 'Dış yıkama', 'Ticari', 'Murat Eren', '+905553330001', 'completed'),
      ('demo-oto-yikama', 'Bay 2', -2, '14:00', 'Dış yıkama', 'SUV', 'Ozan Bulut', '+905553330002', 'no_show'),
      ('demo-oto-yikama', 'Bay 1', -3, '09:30', 'İç temizlik', 'Otomobil', 'Kaan Uçar', '+905553330003', 'completed')
    ) as p(slug, res, day_off, t, svc, variant, cname, cphone, st)
  loop
    select b.id, b.timezone into v_biz, v_tz
      from public.businesses b
      join public.business_members m on m.business_id = b.id and m.user_id = v_uid
     where b.slug = sd.slug;
    continue when v_biz is null;

    select id into v_res from public.resources where business_id = v_biz and name = sd.res;
    select * into v_svc from public.services where business_id = v_biz and name = sd.svc;
    continue when v_res is null or v_svc.id is null;

    v_dur := v_svc.duration_min;
    v_price := v_svc.price_cents;
    v_name := v_svc.name;
    v_var_id := null;
    if sd.variant is not null then
      select v.id, v.name, v.duration_min, v.price_cents into v_var_id, v_var_name, v_var_dur, v_var_price
        from public.service_variants v where v.service_id = v_svc.id and v.name = sd.variant;
      if v_var_id is not null then
        v_dur := v_var_dur;
        v_price := v_var_price;
        v_name := v_svc.name || ' (' || v_var_name || ')';
      end if;
    end if;

    select id into v_cust from public.customers
     where business_id = v_biz and full_name = sd.cname and user_id is null limit 1;
    if v_cust is null then
      insert into public.customers (business_id, full_name, phone)
      values (v_biz, sd.cname, sd.cphone) returning id into v_cust;
    end if;

    -- Kapalı günlere denk gelirse ertesi açık güne kaydır (güzellik Pazar-Pazartesi kapalı, diğerleri Pazar)
    v_date := (now() at time zone v_tz)::date + sd.day_off;
    while extract(dow from v_date) = 0
       or (sd.slug = 'demo-guzellik' and extract(dow from v_date) = 1) loop
      v_date := v_date + 1;
    end loop;

    v_start := ((v_date + sd.t::time) at time zone v_tz);
    v_end := v_start + make_interval(mins => v_dur);

    begin
      insert into public.appointments (
        business_id, customer_id, resource_id, starts_at, ends_at, blocks_until,
        status, source, field_answers)
      values (
        v_biz, v_cust, v_res, v_start, v_end,
        v_end + make_interval(mins => v_svc.buffer_after_min),
        sd.st::public.appointment_status,
        case when sd.day_off % 2 = 0 then 'online'::public.appointment_source else 'manual'::public.appointment_source end,
        case when sd.slug = 'demo-oto-yikama' then '{"plaka": "34 DEM 042"}'::jsonb else '{}'::jsonb end)
      returning id into v_appt;

      insert into public.appointment_items (appointment_id, service_id, variant_id, name, duration_min, price_cents)
      values (v_appt, v_svc.id, v_var_id, v_name, v_dur, v_price);
      v_count := v_count + 1;
    exception when exclusion_violation then
      null; -- aynı kaynakta çakışan örnek satır atlanır
    end;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.reset_demo_owner() from public, anon;
grant execute on function public.reset_demo_owner() to authenticated;
