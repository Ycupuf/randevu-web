-- Hesaplı müşterinin e-postası her zaman hesabın e-postasıdır (RPC ya da doğrudan güncelleme fark etmez).
do $$
declare v_biz uuid; v_res uuid; v_svc uuid; v_cu uuid; v_ts timestamptz; v_appt uuid; v_mail text; v_d date; v_n int;
begin
  select id into v_biz from public.businesses where slug = 'demo-berber';
  select id into v_res from public.resources where business_id = v_biz and name = 'Mehmet';
  select id into v_svc from public.services where business_id = v_biz and name = 'Saç kesimi';
  select id into v_cu from auth.users where email = 'demo-musteri@randevu.test';
  update auth.users set email = 'gercek-hesap@example.com' where id = v_cu;
  delete from public.appointments where customer_id in (select id from public.customers where business_id = v_biz and user_id = v_cu);
  delete from public.customers where business_id = v_biz and user_id = v_cu;
  delete from public.email_outbox;

  v_d := (now() at time zone 'Europe/Istanbul')::date + 22;
  while extract(dow from v_d) = 0 loop v_d := v_d + 1; end loop;
  v_ts := ((v_d + time '10:00') at time zone 'Europe/Istanbul');

  perform set_config('request.jwt.claims', json_build_object('sub', v_cu, 'email', 'gercek-hesap@example.com')::text, true);
  v_appt := public.create_appointment(
    p_business_id := v_biz, p_starts_at := v_ts,
    p_items := jsonb_build_array(jsonb_build_object('service_id', v_svc)), p_resource_id := v_res,
    p_customer := jsonb_build_object('full_name', 'Saldirgan', 'phone', '+905551112233', 'email', 'KURBAN@example.com'));

  select email into v_mail from public.customers where user_id = v_cu and business_id = v_biz;
  assert v_mail = 'gercek-hesap@example.com', format('RPC istemci e-postasını kabul etti: %s', v_mail);
  select count(*) into v_n from public.email_outbox where to_email like 'kurban%';
  assert v_n = 0, 'kurbanın adresine e-posta kuyruğa girdi';

  update public.customers set email = 'kurban2@example.com' where user_id = v_cu and business_id = v_biz;
  select email into v_mail from public.customers where user_id = v_cu and business_id = v_biz;
  assert v_mail = 'gercek-hesap@example.com', 'doğrudan güncelleme e-postayı değiştirebildi';

  raise exception 'TEST_OK: musteri e-posta butunlugu';
end $$;
