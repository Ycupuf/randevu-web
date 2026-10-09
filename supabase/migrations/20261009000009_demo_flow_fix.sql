-- 9/9: Demo akışı düzeltmesi ve yeni ayrılmış adres.
-- (1) reset_demo_owner artık hesaplı müşterilerin randevularını silmez: müşteri sitesinde alınan randevu,
--     demo sahibi panele girdiğinde de görünür kalır.
-- (2) /proje sayfası (HR tanıtım sayfası) için işletme adresi olarak "proje" ayrılır.

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
  r record;
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

  -- 2) Örnek randevular (gün farkı bugüne göre)
  for r in
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
     where b.slug = r.slug;
    continue when v_biz is null;

    select id into v_res from public.resources where business_id = v_biz and name = r.res;
    select * into v_svc from public.services where business_id = v_biz and name = r.svc;
    continue when v_res is null or v_svc.id is null;

    v_dur := v_svc.duration_min;
    v_price := v_svc.price_cents;
    v_name := v_svc.name;
    v_var_id := null;
    if r.variant is not null then
      select v.id, v.name, v.duration_min, v.price_cents into v_var_id, v_var_name, v_var_dur, v_var_price
        from public.service_variants v where v.service_id = v_svc.id and v.name = r.variant;
      if v_var_id is not null then
        v_dur := v_var_dur;
        v_price := v_var_price;
        v_name := v_svc.name || ' (' || v_var_name || ')';
      end if;
    end if;

    select id into v_cust from public.customers
     where business_id = v_biz and full_name = r.cname and user_id is null limit 1;
    if v_cust is null then
      insert into public.customers (business_id, full_name, phone)
      values (v_biz, r.cname, r.cphone) returning id into v_cust;
    end if;

    -- Kapalı günlere denk gelirse ertesi açık güne kaydır (güzellik Pazar-Pazartesi kapalı, diğerleri Pazar)
    v_date := (now() at time zone v_tz)::date + r.day_off;
    while extract(dow from v_date) = 0
       or (r.slug = 'demo-guzellik' and extract(dow from v_date) = 1) loop
      v_date := v_date + 1;
    end loop;

    v_start := ((v_date + r.t::time) at time zone v_tz);
    v_end := v_start + make_interval(mins => v_dur);

    begin
      insert into public.appointments (
        business_id, customer_id, resource_id, starts_at, ends_at, blocks_until,
        status, source, field_answers)
      values (
        v_biz, v_cust, v_res, v_start, v_end,
        v_end + make_interval(mins => v_svc.buffer_after_min),
        r.st::public.appointment_status,
        case when r.day_off % 2 = 0 then 'online'::public.appointment_source else 'manual'::public.appointment_source end,
        case when r.slug = 'demo-oto-yikama' then '{"plaka": "34 DEM 042"}'::jsonb else '{}'::jsonb end)
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

alter table public.businesses drop constraint businesses_slug_not_reserved;
alter table public.businesses
  add constraint businesses_slug_not_reserved check (slug not in (
    'giris', 'kayit', 'cikis', 'randevularim', 'hesabim', 'gizlilik', 'randevu',
    'api', 'auth', 'admin', 'panel', 'static', 'assets', 'public', 'proje'
  ));
