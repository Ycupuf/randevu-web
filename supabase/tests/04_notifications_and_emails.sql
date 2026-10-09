-- Yeni müşteri + yeni randevu bildirimi, müşterinin kişi/saat değişikliği (eski kişiye e-posta), RLS görünürlüğü,
-- okunmamış sayacı ve işletmenin kendi işlemlerinde işletmeye bildirim/e-posta üretilmemesi.
do $$
declare
  v_biz uuid; v_ali uuid; v_burak uuid; v_svc uuid; v_cu uuid; v_ou uuid; v_su uuid; v_d date; v_ts timestamptz; v_appt uuid;
  v_n int; v_mails text; v_types text;
begin
  select id into v_biz from public.businesses where slug = 'demo-berber';
  select id into v_ali from public.resources where business_id = v_biz and name = 'Ali';
  select id into v_burak from public.resources where business_id = v_biz and name = 'Burak';
  select id into v_svc from public.services where business_id = v_biz and name = 'Saç kesimi';
  select id into v_cu from auth.users where email = 'demo-musteri@randevu.test';
  select id into v_ou from auth.users where email = 'demo-isletme@randevu.test';
  select id into v_su from auth.users where id not in (v_cu, v_ou) order by created_at limit 1;
  if v_su is null then raise exception 'TEST_SKIPPED: 3. auth kullanıcısı yok (personel hesabı gerekir)'; end if;

  update auth.users set email = 'sahip-test@example.com' where id = v_ou;
  update auth.users set email = 'staff-test@example.com' where id = v_su;
  insert into public.business_members (business_id, user_id, role) values (v_biz, v_su, 'staff') on conflict do nothing;
  update public.resources set user_id = v_su where id = v_ali;       -- Ali'nin personeli

  delete from public.appointments where customer_id in (select id from public.customers where business_id = v_biz and user_id = v_cu);
  delete from public.customers where business_id = v_biz and user_id = v_cu;
  delete from public.notifications where business_id = v_biz;
  delete from public.email_outbox;

  v_d := (now() at time zone 'Europe/Istanbul')::date + 21;
  while extract(dow from v_d) = 0 loop v_d := v_d + 1; end loop;
  v_ts := ((v_d + time '10:00') at time zone 'Europe/Istanbul');

  -- (1) yeni müşteri randevu alır
  perform set_config('request.jwt.claims', json_build_object('sub', v_cu, 'email', 'demo-musteri@randevu.test')::text, true);
  v_appt := public.create_appointment(
    p_business_id := v_biz, p_starts_at := v_ts,
    p_items := jsonb_build_array(jsonb_build_object('service_id', v_svc)), p_resource_id := v_ali,
    p_customer := jsonb_build_object('full_name', 'Yeni Musteri', 'phone', '+905551234567', 'email', 'x@example.com'));
  select string_agg(type, ',' order by type) into v_types from public.notifications where business_id = v_biz;
  assert v_types = 'appointment_new,customer_registered', format('yeni müşteri bildirimleri yanlış: %s', v_types);

  -- (2) müşteri Ali'den Burak'a geçer: sahip + ESKİ kişinin (Ali) personeli bilgilendirilir
  perform public.reschedule_appointment(v_appt, v_ts + interval '1 hour', v_burak);
  select string_agg(to_email, ',' order by to_email) into v_mails from public.email_outbox where appointment_id = v_appt and kind = 'owner_rescheduled';
  assert v_mails = 'sahip-test@example.com,staff-test@example.com', format('saat değişikliği alıcıları yanlış: %s', v_mails);
  assert (select payload ->> 'previous_resource_name' from public.email_outbox where appointment_id = v_appt and kind = 'owner_rescheduled' limit 1) = 'Ali', 'önceki kişi adı yok';

  -- (3) RLS: sahip hepsini, Ali'nin personeli yalnızca Ali'yi ilgilendirenleri, müşteri hiçbirini görmez
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_ou)::text, true);
  select count(*) into v_n from public.notifications where business_id = v_biz;
  assert v_n = 3, format('sahip %s bildirim görüyor (3 olmalı)', v_n);
  assert public.unread_notification_count(v_biz) = 3, 'okunmamış sayacı yanlış';
  perform public.mark_notifications_read(v_biz);
  assert public.unread_notification_count(v_biz) = 0, 'okundu işaretleme çalışmadı';

  perform set_config('request.jwt.claims', json_build_object('sub', v_su)::text, true);
  select count(*) into v_n from public.notifications where business_id = v_biz;
  assert v_n = 2, format('personel %s bildirim görüyor (2 olmalı)', v_n);

  perform set_config('request.jwt.claims', json_build_object('sub', v_cu)::text, true);
  select count(*) into v_n from public.notifications where business_id = v_biz;
  assert v_n = 0, 'müşteri işletme bildirimlerini görüyor';
  perform set_config('role', 'postgres', true);

  -- (4) İŞLETME saat değiştirince işletmeye e-posta gitmez, müşteriye gider
  select count(*) into v_n from public.email_outbox where appointment_id = v_appt and kind = 'owner_rescheduled';
  perform set_config('request.jwt.claims', json_build_object('sub', v_ou, 'email', 'sahip-test@example.com')::text, true);
  perform public.reschedule_appointment(v_appt, v_ts + interval '4 hours', v_burak);   -- 14:00 (13:00-14:00 öğle arası)
  assert (select count(*) from public.email_outbox where appointment_id = v_appt and kind = 'owner_rescheduled') = v_n, 'işletmenin kendi taşıması işletmeye e-posta üretti';

  raise exception 'TEST_OK: bildirimler ve e-postalar';
end $$;
