-- is_demo bayrağı: koruma, yayın engeli ve kullanıcının bayrağı kendi kendine veremeyeceği.
do $$
declare v_owner uuid; v_biz uuid; v_other uuid; v_failed boolean := false; v_appt uuid; v_stuck uuid; v_ok uuid; v_n int;
begin
  select id into v_owner from auth.users where email = 'demo-isletme@randevu.test';
  select id into v_biz from public.businesses where slug = 'demo-berber';
  assert (select is_demo from public.businesses where id = v_biz), 'demo-berber is_demo değil';

  -- 1) Kullanıcı kendi işletmesine is_demo = true veremez (sütun yetkisi yok)
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.businesses (slug, name, sector, is_demo) values ('is-demo-deneme', 'X', 'berber', true);
  exception when insufficient_privilege then v_failed := true; end;
  assert v_failed, 'kullanıcı is_demo ile işletme ekleyebildi';
  v_failed := false;
  begin
    update public.businesses set is_demo = false where id = v_biz;
  exception when insufficient_privilege then v_failed := true; end;
  assert v_failed, 'kullanıcı is_demo güncelleyebildi';
  reset role;

  -- 2) Bayrağı true olan işletme (slug demo- ile başlamasa da) silinemez
  insert into public.businesses (slug, name, sector, is_demo) values ('bayrakli-isletme', 'Bayraklı', 'berber', true) returning id into v_other;
  v_failed := false;
  begin
    delete from public.businesses where id = v_other;
  exception when others then v_failed := sqlerrm = 'demo_protected'; end;
  assert v_failed, 'is_demo=true işletme silinebildi';

  -- 3) E-posta kuyruğu: deneme sınırı çağıranın parametresi. Sınırı aşıp takılan satır 'failed' olur,
  --    taze satır alınır ve attempts artar.
  select id into v_appt from public.appointments limit 1;
  if v_appt is null then raise exception 'TEST_SKIPPED: randevu yok'; end if;
  insert into public.email_outbox (kind, appointment_id, to_email, status, attempts, claimed_at)
    values ('received', v_appt, 'stuck@example.com', 'sending', 3, now() - interval '10 minutes') returning id into v_stuck;
  insert into public.email_outbox (kind, appointment_id, to_email, status, attempts, send_after)
    values ('received', v_appt, 'fresh@example.com', 'pending', 0, now() - interval '1 minute') returning id into v_ok;
  perform * from public.claim_pending_emails(50, 3);
  assert (select status from public.email_outbox where id = v_stuck) = 'failed', 'sınırı aşan takılı satır kapanmadı';
  assert (select status from public.email_outbox where id = v_ok) = 'sending'
     and (select attempts from public.email_outbox where id = v_ok) = 1, 'taze satır alınmadı';

  raise exception 'TEST_OK: is_demo bayrağı ve e-posta deneme sınırı';
end $$;
