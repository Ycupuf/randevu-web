-- Personel yalnızca kendi kaynağında randevusu olan müşterileri görür, özel not göremez, müşteri silemez;
-- çalışma saatleri tek işlemde (atomik) değişir; müşteri kendi satırının business_id'sini değiştiremez;
-- e-posta hız sınırı.
do $$
declare v_ou uuid; v_su uuid; v_cu uuid; v_biz uuid; v_other uuid; v_ali uuid; v_burak uuid; v_total int; v_staff int; v_before int; v_after int; v_n int; v_cust uuid; v_denied boolean;
begin
  select id into v_ou from auth.users where email = 'demo-isletme@randevu.test';
  select id into v_cu from auth.users where email = 'demo-musteri@randevu.test';
  select id into v_su from auth.users where id not in (v_ou, v_cu) order by created_at limit 1;
  if v_su is null then raise exception 'TEST_SKIPPED: 3. auth kullanıcısı yok (personel hesabı gerekir)'; end if;
  select id into v_biz from public.businesses where slug = 'demo-berber';
  select id into v_other from public.businesses where slug = 'demo-oto-yikama';
  select id into v_ali from public.resources where business_id = v_biz and name = 'Ali';
  select id into v_burak from public.resources where business_id = v_biz and name = 'Burak';
  insert into public.business_members (business_id, user_id, role) values (v_biz, v_su, 'staff') on conflict do nothing;
  update public.resources set user_id = v_su where id = v_ali;
  select count(*) into v_total from public.customers where business_id = v_biz;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_su)::text, true);
  select count(*) into v_staff from public.customers where business_id = v_biz;
  assert v_staff > 0 and v_staff < v_total, format('personel %s/%s müşteri görüyor', v_staff, v_total);
  assert (select count(*) from public.customer_notes where business_id = v_biz) = 0, 'personel müşteri notu görüyor';
  delete from public.customers where business_id = v_biz;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'personel müşteri silebildi';

  -- atomik çalışma saati kaydı (sahip olarak)
  perform set_config('request.jwt.claims', json_build_object('sub', v_ou, 'email', 'demo-isletme@randevu.test')::text, true);
  select count(*) into v_before from public.working_hours where resource_id = v_burak;
  begin
    perform public.replace_working_hours(v_burak, '[{"weekday":1,"start_time":"09:00","end_time":"13:00"},{"weekday":2,"start_time":"saat degil","end_time":"13:00"}]'::jsonb);
    assert false, 'bozuk saat kaydı kabul edildi';
  exception when others then
    if sqlerrm like 'bozuk saat%' then raise; end if;
  end;
  select count(*) into v_after from public.working_hours where resource_id = v_burak;
  assert v_before = v_after, format('bozuk kayıt eski saatleri sildi: %s -> %s', v_before, v_after);

  -- müşteri business_id değiştiremez
  perform set_config('role', 'postgres', true);
  select id into v_cust from public.customers where user_id = v_cu limit 1;
  if v_cust is null then
    insert into public.customers (business_id, user_id, full_name, phone) values (v_biz, v_cu, 'T', '+905551110000') returning id into v_cust;
  end if;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_cu, 'email', 'demo-musteri@randevu.test')::text, true);
  v_denied := false;
  begin update public.customers set business_id = v_other where id = v_cust; exception when insufficient_privilege then v_denied := true; end;
  assert v_denied, 'müşteri business_id değiştirebildi';
  perform set_config('role', 'postgres', true);

  -- e-posta hız sınırı: aynı alıcıya saatte en fazla 30
  insert into public.email_outbox (kind, appointment_id, to_email)
    select 'booked', (select id from public.appointments limit 1), 'bombala@example.com' from generate_series(1, 45);
  select count(*) into v_n from public.email_outbox where to_email = 'bombala@example.com';
  assert v_n = 30, format('e-posta sınırı: %s (30 olmalı)', v_n);

  raise exception 'TEST_OK: gizlilik, atomiklik, hiz siniri';
end $$;
