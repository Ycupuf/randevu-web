-- Çifte rezervasyon fiziksel olarak mümkün değil: EXCLUDE kısıtı (başlangıç - blocks_until, yalnızca pending/confirmed)
do $$
declare v_biz uuid; v_res uuid; v_cust uuid; v_ts timestamptz := now() + interval '40 days'; v_ok boolean;
begin
  select id into v_biz from public.businesses where slug = 'demo-berber';
  select id into v_res from public.resources where business_id = v_biz and name = 'Burak';
  select id into v_cust from public.customers where business_id = v_biz limit 1;
  if v_cust is null then
    insert into public.customers (business_id, full_name) values (v_biz, 'T') returning id into v_cust;
  end if;
  insert into public.appointments (business_id, customer_id, resource_id, starts_at, ends_at, blocks_until, status, source)
    values (v_biz, v_cust, v_res, v_ts, v_ts + interval '30 minutes', v_ts + interval '35 minutes', 'confirmed', 'online');

  v_ok := false;
  begin  -- birebir aynı saat
    insert into public.appointments (business_id, customer_id, resource_id, starts_at, ends_at, blocks_until, status, source)
      values (v_biz, v_cust, v_res, v_ts, v_ts + interval '30 minutes', v_ts + interval '35 minutes', 'confirmed', 'online');
  exception when exclusion_violation then v_ok := true; end;
  assert v_ok, 'aynı saat reddedilmedi';

  v_ok := false;
  begin  -- kısmen çakışan
    insert into public.appointments (business_id, customer_id, resource_id, starts_at, ends_at, blocks_until, status, source)
      values (v_biz, v_cust, v_res, v_ts + interval '20 minutes', v_ts + interval '50 minutes', v_ts + interval '55 minutes', 'pending', 'online');
  exception when exclusion_violation then v_ok := true; end;
  assert v_ok, 'kısmi çakışma reddedilmedi';

  v_ok := false;
  begin  -- hazırlık payına (blocks_until) giren
    insert into public.appointments (business_id, customer_id, resource_id, starts_at, ends_at, blocks_until, status, source)
      values (v_biz, v_cust, v_res, v_ts + interval '32 minutes', v_ts + interval '62 minutes', v_ts + interval '67 minutes', 'confirmed', 'online');
  exception when exclusion_violation then v_ok := true; end;
  assert v_ok, 'hazırlık payı çakışması reddedilmedi';

  -- iptal edilmiş randevu saati bloklamaz
  update public.appointments set status = 'cancelled', cancelled_by = 'business' where resource_id = v_res and starts_at = v_ts;
  insert into public.appointments (business_id, customer_id, resource_id, starts_at, ends_at, blocks_until, status, source)
    values (v_biz, v_cust, v_res, v_ts, v_ts + interval '30 minutes', v_ts + interval '35 minutes', 'confirmed', 'online');

  raise exception 'TEST_OK: cakisma kisiti';
end $$;
