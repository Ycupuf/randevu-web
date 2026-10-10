-- demo-real-user-purge cron'u: demo işletmelerde GERÇEK hesapla alınan 24 saatten eski randevuları siler,
-- ama 'demo-' ile başlayan GERÇEK bir işletmeye (örn. demo-salon) dokunmaz.
do $$
declare v_cu uuid; v_biz uuid; v_demo_res uuid; v_real uuid; v_real_res uuid; v_c1 uuid; v_c2 uuid; v_cmd text; v_ts timestamptz := now() + interval '50 days'; v_n int;
begin
  select id into v_cu from auth.users where email = 'demo-musteri@randevu.test';
  select id into v_biz from public.businesses where slug = 'demo-berber';
  select id into v_demo_res from public.resources where business_id = v_biz and name = 'Burak';
  update auth.users set email = 'gercek-kisi@example.com' where id = v_cu;   -- "gerçek" hesap

  insert into public.businesses (slug, name, sector) values ('demo-salon-test', 'Gerçek Salon', 'berber') returning id into v_real;
  insert into public.resources (business_id, name, kind) values (v_real, 'R1', 'person') returning id into v_real_res;

  -- Temiz başlangıç: demo müşterinin canlı randevuları FK nedeniyle önce gitmeli (işlem geri alınır)
  delete from public.appointments where customer_id in (select id from public.customers where user_id = v_cu and business_id in (v_biz, v_real));
  delete from public.customers where user_id = v_cu and business_id in (v_biz, v_real);
  insert into public.customers (business_id, user_id, full_name, created_at) values (v_biz, v_cu, 'Gercek A', now() - interval '25 hours') returning id into v_c1;
  insert into public.customers (business_id, user_id, full_name, created_at) values (v_real, v_cu, 'Gercek B', now() - interval '25 hours') returning id into v_c2;

  insert into public.appointments (business_id, customer_id, resource_id, starts_at, ends_at, blocks_until, status, source, created_at)
    values (v_biz, v_c1, v_demo_res, v_ts, v_ts + interval '30 minutes', v_ts + interval '35 minutes', 'confirmed', 'online', now() - interval '25 hours');
  insert into public.appointments (business_id, customer_id, resource_id, starts_at, ends_at, blocks_until, status, source, created_at)
    values (v_real, v_c2, v_real_res, v_ts, v_ts + interval '30 minutes', v_ts + interval '35 minutes', 'confirmed', 'online', now() - interval '25 hours');

  select command into v_cmd from cron.job where jobname = 'demo-real-user-purge';
  assert v_cmd is not null, 'cron işi tanımlı değil';
  execute v_cmd;

  select count(*) into v_n from public.appointments where customer_id = v_c1;
  assert v_n = 0, 'demo işletmedeki gerçek hesap randevusu silinmedi';
  select count(*) into v_n from public.customers where id = v_c1;
  assert v_n = 0, 'demo işletmedeki randevusuz gerçek müşteri silinmedi';
  select count(*) into v_n from public.appointments where customer_id = v_c2;
  assert v_n = 1, 'GERÇEK işletmenin randevusu silindi (demo- ile başlayan slug)';
  select count(*) into v_n from public.customers where id = v_c2;
  assert v_n = 1, 'GERÇEK işletmenin müşterisi silindi';

  raise exception 'TEST_OK: demo temizlik cron';
end $$;
