-- 17/17: Sertleştirme (bağımsız inceleme bulguları).
--
-- (1) Tablo yetkileri: Supabase varsayılanı anon ve authenticated'a TÜM tablolarda her yetkiyi (TRUNCATE dahil)
--     verir ve tek savunma RLS olur. TRUNCATE ve TRIGGER yetkileri RLS'e tabi değildir. Burada en az yetkiye
--     inilir: anon yalnızca herkese açık katalog tablolarını OKUR; authenticated TRUNCATE/TRIGGER/REFERENCES almaz.
--     Gelecekte eklenecek tablolar da aynı varsayılanla gelir (gerekli yetki migration'da açıkça verilmelidir).
-- (2) Paylaşılan demo sahibi hesabıyla açılan yeni işletme yayınlanamaz ve 30 dakika sonra silinir
--     (herkes demo sahibi olabildiği için aksi halde herkese açık siteye içerik konabiliyordu).
-- (3) Bildirim tablolarında eksik yabancı anahtar indeksleri.

-- 1) Yetkiler
revoke all on all tables in schema public from anon;
grant select on
  public.businesses, public.business_settings, public.services, public.service_variants,
  public.resources, public.resource_services, public.working_hours, public.booking_fields
to anon;

revoke truncate, trigger, references on all tables in schema public from authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke truncate, trigger, references on tables from authenticated;

-- 2) Demo sahibi yeni işletmeyi yayınlayamaz, 30 dakikada silinir
create function private.block_demo_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.published
     and new.slug not in ('demo-berber', 'demo-guzellik', 'demo-oto-yikama')
     and exists (
       select 1 from public.business_members m
         join auth.users u on u.id = m.user_id
        where m.business_id = new.id and u.email = 'demo-isletme@randevu.test') then
    raise exception 'demo_publish_blocked';
  end if;
  return new;
end;
$$;

revoke execute on function private.block_demo_publish() from public;

create trigger businesses_block_demo_publish
  before update of published on public.businesses
  for each row execute function private.block_demo_publish();

select cron.schedule(
  'demo-extra-businesses-purge',
  '*/15 * * * *',
  $cron$
    delete from public.businesses b
     using public.business_members m, auth.users u
     where m.business_id = b.id and u.id = m.user_id and u.email = 'demo-isletme@randevu.test'
       and b.slug not in ('demo-berber', 'demo-guzellik', 'demo-oto-yikama')
       and b.created_at < now() - interval '30 minutes'
  $cron$
);

-- 3) İndeksler
create index notifications_resource_idx on public.notifications (resource_id);
create index notifications_extra_resource_idx on public.notifications (extra_resource_id) where extra_resource_id is not null;
create index notification_reads_user_idx on public.notification_reads (user_id);
