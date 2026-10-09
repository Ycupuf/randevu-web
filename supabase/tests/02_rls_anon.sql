-- Anonim (anon) rol: yalnızca herkese açık katalog tablolarını okuyabilir; yazamaz; özel tablolara erişemez.
do $$
declare t text; v_denied boolean; v_n int;
begin
  perform set_config('role', 'anon', true);

  foreach t in array array['customers', 'appointments', 'appointment_items', 'business_members', 'customer_notes',
                           'time_off', 'data_requests', 'email_outbox', 'notifications', 'notification_reads'] loop
    v_denied := false;
    begin
      execute format('select count(*) from public.%I', t) into v_n;
    exception when insufficient_privilege then v_denied := true; end;
    assert v_denied, format('anon %s tablosunu okuyabiliyor', t);
  end loop;

  foreach t in array array['businesses', 'services', 'service_variants', 'resources', 'resource_services',
                           'working_hours', 'booking_fields', 'business_settings'] loop
    execute format('select count(*) from public.%I', t) into v_n;   -- hata vermemeli
  end loop;

  v_denied := false;
  begin
    update public.businesses set name = 'HACK';
  exception when insufficient_privilege then v_denied := true; end;
  assert v_denied, 'anon işletme güncelleyebiliyor';

  v_denied := false;
  begin
    perform public.create_business('x', 'anon-deneme', 'berber');
  exception when insufficient_privilege then v_denied := true; end;
  assert v_denied, 'anon create_business çağırabiliyor';

  v_denied := false;
  begin
    perform public.claim_pending_emails(1);
  exception when insufficient_privilege then v_denied := true; end;
  assert v_denied, 'anon claim_pending_emails çağırabiliyor';

  perform set_config('role', 'postgres', true);
  raise exception 'TEST_OK: anon yetkileri';
end $$;
