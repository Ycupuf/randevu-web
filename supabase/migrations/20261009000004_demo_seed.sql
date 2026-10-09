-- 4/4: Demo verisi: üç sektörden birer örnek işletme (herkese açık, sahibi yok).
-- Gerçek bir işletme `create_business` ile kurulur; bunlar yalnızca siteyi denemek içindir.

do $$
declare
  v_biz uuid;
  v_res uuid;
  v_name text;
  v_sort int;
begin
  -- 1) Kuaför / berber
  insert into public.businesses (slug, name, sector, description, address, city, phone, published)
  values ('demo-berber', 'Demo Berber', 'berber',
          'Saç, sakal ve bakım. Randevusuz beklemek yok.',
          'Örnek Mah. Cumhuriyet Cad. No:12', 'Gebze, Kocaeli', '0262 000 00 01', true)
  returning id into v_biz;
  insert into public.business_settings (business_id, resource_selection, resource_label)
  values (v_biz, 'customer', 'Personel');
  perform private.apply_sector_template(v_biz, 'berber');
  v_sort := 0;
  foreach v_name in array array['Mehmet', 'Ali', 'Burak'] loop
    v_sort := v_sort + 1;
    insert into public.resources (business_id, name, kind, sort)
    values (v_biz, v_name, 'person', v_sort) returning id into v_res;
    insert into public.resource_services (resource_id, service_id)
      select v_res, s.id from public.services s where s.business_id = v_biz;
    insert into public.working_hours (resource_id, weekday, start_time, end_time)
      select v_res, d, t.s, t.e
      from generate_series(1, 6) as d
      cross join (values ('09:00'::time, '13:00'::time), ('14:00'::time, '19:00'::time)) as t(s, e);
  end loop;

  -- 2) Güzellik merkezi
  insert into public.businesses (slug, name, sector, description, address, city, phone, published)
  values ('demo-guzellik', 'Demo Güzellik Merkezi', 'guzellik',
          'Tırnak, cilt bakımı ve lazer epilasyon.',
          'Örnek Mah. Lale Sok. No:5', 'Kadıköy, İstanbul', '0216 000 00 02', true)
  returning id into v_biz;
  insert into public.business_settings (business_id, resource_selection, resource_label)
  values (v_biz, 'customer', 'Uzman');
  perform private.apply_sector_template(v_biz, 'guzellik');

  insert into public.resources (business_id, name, kind, sort)
  values (v_biz, 'Selin', 'person', 1) returning id into v_res;
  insert into public.resource_services (resource_id, service_id)
    select v_res, s.id from public.services s
    where s.business_id = v_biz and s.name in ('Manikür', 'Pedikür', 'Kaş şekillendirme');
  insert into public.working_hours (resource_id, weekday, start_time, end_time)
    select v_res, d, '10:00'::time, '19:00'::time from generate_series(2, 6) as d;

  insert into public.resources (business_id, name, kind, sort)
  values (v_biz, 'Derya', 'person', 2) returning id into v_res;
  insert into public.resource_services (resource_id, service_id)
    select v_res, s.id from public.services s
    where s.business_id = v_biz and s.name in ('Cilt bakımı', 'Lazer epilasyon', 'Kaş şekillendirme');
  insert into public.working_hours (resource_id, weekday, start_time, end_time)
    select v_res, d, '10:00'::time, '19:00'::time from generate_series(2, 6) as d;

  -- 3) Oto yıkama (müşteri bay seçmez, otomatik atanır)
  insert into public.businesses (slug, name, sector, description, address, city, phone, published)
  values ('demo-oto-yikama', 'Demo Oto Yıkama', 'oto_yikama',
          'Dış yıkama, iç temizlik ve detaylı temizlik. Aracını bırak, saatinde teslim al.',
          'Sanayi Sitesi A Blok No:3', 'Pendik, İstanbul', '0216 000 00 03', true)
  returning id into v_biz;
  insert into public.business_settings (business_id, resource_selection, resource_label)
  values (v_biz, 'auto', 'Yıkama bayı');
  perform private.apply_sector_template(v_biz, 'oto_yikama');
  v_sort := 0;
  foreach v_name in array array['Bay 1', 'Bay 2', 'Bay 3'] loop
    v_sort := v_sort + 1;
    insert into public.resources (business_id, name, kind, sort)
    values (v_biz, v_name, 'bay', v_sort) returning id into v_res;
    insert into public.resource_services (resource_id, service_id)
      select v_res, s.id from public.services s where s.business_id = v_biz;
    insert into public.working_hours (resource_id, weekday, start_time, end_time)
      select v_res, d, '08:00'::time, '18:00'::time from generate_series(1, 6) as d;
    insert into public.working_hours (resource_id, weekday, start_time, end_time)
    values (v_res, 0, '10:00', '16:00');
  end loop;
end
$$;
