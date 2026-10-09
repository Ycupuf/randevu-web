-- Personel telefonla gelen müşteriyi ekleyip randevu açabilir (migration 19-20 gerilemesi). Müşteri RPC ile oluşturulur:
-- yetki denetimi içeride, kopya müşteri oluşmaz, istemcinin customers'a doğrudan INSERT yetkisi yoktur.
do $$
declare v_ou uuid; v_su uuid; v_cu uuid; v_biz uuid; v_ali uuid; v_svc uuid; v_id1 uuid; v_id2 uuid; v_appt uuid; v_d date; v_ts timestamptz; v_denied boolean; v_n int;
begin
  select id into v_ou from auth.users where email = 'demo-isletme@randevu.test';
  select id into v_cu from auth.users where email = 'demo-musteri@randevu.test';
  select id into v_su from auth.users where id not in (v_ou, v_cu) order by created_at limit 1;
  if v_su is null then raise exception 'TEST_SKIPPED: 3. auth kullanıcısı yok (personel hesabı gerekir)'; end if;
  select id into v_biz from public.businesses where slug = 'demo-berber';
  select id into v_ali from public.resources where business_id = v_biz and name = 'Ali';
  select id into v_svc from public.services where business_id = v_biz and name = 'Saç kesimi';
  insert into public.business_members (business_id, user_id, role) values (v_biz, v_su, 'staff') on conflict do nothing;
  update public.resources set user_id = v_su where id = v_ali;

  v_d := (now() at time zone 'Europe/Istanbul')::date + 23;
  while extract(dow from v_d) = 0 loop v_d := v_d + 1; end loop;
  v_ts := ((v_d + time '15:00') at time zone 'Europe/Istanbul');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_su)::text, true);

  v_id1 := public.create_walkin_customer(v_biz, 'Telefonla Gelen', '+905550009988');
  v_id2 := public.create_walkin_customer(v_biz, 'Telefonla Gelen', '+905550009988');
  assert v_id1 is not null and v_id1 = v_id2, 'aynı telefon için kopya müşteri oluştu';

  v_appt := public.create_appointment(
    p_business_id := v_biz, p_starts_at := v_ts, p_customer_id := v_id1,
    p_items := jsonb_build_array(jsonb_build_object('service_id', v_svc)), p_resource_id := v_ali);
  assert v_appt is not null, 'personel elle randevu açamadı';

  select count(*) into v_n from public.customers where id = v_id1;
  assert v_n = 1, 'randevu açıldıktan sonra personel müşteriyi göremiyor';

  v_denied := false;
  begin insert into public.customers (business_id, full_name) values (v_biz, 'Doğrudan'); exception when insufficient_privilege then v_denied := true; end;
  assert v_denied, 'istemci customers tablosuna doğrudan ekleyebiliyor';

  v_denied := false;
  begin perform public.create_walkin_customer(v_biz, 'X', '+905550009988'); exception when others then v_denied := sqlerrm = 'invalid_customer'; end;
  assert v_denied, 'çok kısa ad kabul edildi';
  v_denied := false;
  begin perform public.create_walkin_customer(v_biz, 'Geçerli Ad', '05321234567'); exception when others then v_denied := sqlerrm = 'invalid_customer'; end;
  assert v_denied, '+90 biçiminde olmayan telefon kabul edildi';

  -- işletme üyesi olmayan kullanıcı müşteri ekleyemez
  perform set_config('request.jwt.claims', json_build_object('sub', v_cu)::text, true);
  v_denied := false;
  begin perform public.create_walkin_customer(v_biz, 'Yabancı Kişi', null); exception when others then v_denied := sqlerrm = 'forbidden'; end;
  assert v_denied, 'üye olmayan kullanıcı müşteri ekleyebildi';
  perform set_config('role', 'postgres', true);

  raise exception 'TEST_OK: personel elle randevu';
end $$;
