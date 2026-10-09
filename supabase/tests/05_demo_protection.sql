-- Paylaşılan demo hesabı: demo işletmeleri silinemez/yeniden adlandırılamaz, yeni işletme yayınlanamaz,
-- sıfırlama bozulan her şeyi onarır ve 20 saniyeden sık çalışmaz.
do $$
declare v_ou uuid; v_biz uuid; v_id uuid; v_denied boolean; v_n int;
begin
  select id into v_ou from auth.users where email = 'demo-isletme@randevu.test';
  select id into v_biz from public.businesses where slug = 'demo-guzellik';

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_ou, 'email', 'demo-isletme@randevu.test')::text, true);

  v_denied := false;
  begin update public.businesses set slug = 'x-tasindi' where id = v_biz; exception when insufficient_privilege then v_denied := true; end;
  assert v_denied, 'demo işletmenin slug değeri değiştirilebildi';

  v_denied := false;
  begin update public.businesses set timezone = 'Mars/Olympus' where id = v_biz; exception when insufficient_privilege then v_denied := true; end;
  assert v_denied, 'saat dilimi değiştirilebildi';

  v_denied := false;
  begin delete from public.businesses where id = v_biz; exception when others then v_denied := sqlerrm = 'demo_protected'; end;
  assert v_denied, 'demo işletme silinebildi';

  -- demo sahibi yeni işletme açabilir ama yayınlayamaz
  v_id := public.create_business('Spam', 'spam-deneme-x', 'berber');
  v_denied := false;
  begin update public.businesses set published = true where id = v_id; exception when others then v_denied := sqlerrm = 'demo_publish_blocked'; end;
  assert v_denied, 'demo sahibi yeni işletmeyi yayınlayabildi';

  -- bozulan demo verisi sıfırlamayla onarılır
  perform set_config('role', 'postgres', true);
  update public.businesses set published = false, name = 'HACK' where id = v_biz;
  delete from public.working_hours where resource_id in (select id from public.resources where business_id = v_biz);
  delete from private.demo_throttle;
  perform set_config('role', 'authenticated', true);
  assert public.reset_demo_owner() > 0, 'sıfırlama çalışmadı';
  assert public.reset_demo_owner() = 0, '20 saniye kısıtı çalışmıyor';
  perform set_config('role', 'postgres', true);
  select count(*) into v_n from public.businesses where id = v_biz and published and name = 'Demo Güzellik Merkezi';
  assert v_n = 1, 'işletme adı/yayın durumu geri gelmedi';
  select count(*) into v_n from public.working_hours w join public.resources r on r.id = w.resource_id where r.business_id = v_biz;
  assert v_n > 0, 'çalışma saatleri geri gelmedi';

  -- yabancı bir kullanıcı sıfırlamayı çağıramaz
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'email', 'baska@example.com')::text, true);
  assert public.reset_demo_owner() = 0, 'yabancı kullanıcı sıfırlamayı çalıştırdı';

  raise exception 'TEST_OK: demo korumalari';
end $$;
