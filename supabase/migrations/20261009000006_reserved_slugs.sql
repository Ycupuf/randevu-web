-- 6/6: İşletme adresi sitenin kendi sayfa adlarıyla çakışamaz (src/lib/slugs.ts ile aynı liste).
alter table public.businesses
  add constraint businesses_slug_not_reserved check (slug not in (
    'giris', 'kayit', 'cikis', 'randevularim', 'hesabim', 'gizlilik', 'randevu',
    'api', 'auth', 'admin', 'panel', 'static', 'assets', 'public'
  ));
