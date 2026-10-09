-- 2/4: Yardımcı fonksiyonlar ve Satır Düzeyi Güvenlik (RLS)
--
-- İlke: tüm tablolarda RLS açık. Randevu yazma işlemleri (oluştur, iptal, taşı, durum) doğrudan
-- tabloya değil, doğrulama yapan RPC fonksiyonlarına gider (bir sonraki migration); bu yüzden
-- `appointments` ve `appointment_items` için yazma politikası YOKTUR.

-- Politika içinde kullanılan yardımcılar. security definer: business_members tablosunun kendi
-- RLS'ine takılmadan üyeliği kontrol eder (aksi halde özyineleme olurdu).
create or replace function private.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_business_owner(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

-- Giriş yapan kişi, bu kaynağa bağlı personel mi?
create or replace function private.is_resource_staff(p_resource_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.resources r
    where r.id = p_resource_id and r.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_business_member(uuid) from public;
revoke execute on function private.is_business_owner(uuid) from public;
revoke execute on function private.is_resource_staff(uuid) from public;
grant execute on function private.is_business_member(uuid) to anon, authenticated;
grant execute on function private.is_business_owner(uuid) to anon, authenticated;
grant execute on function private.is_resource_staff(uuid) to anon, authenticated;

alter table public.businesses enable row level security;
alter table public.business_settings enable row level security;
alter table public.business_members enable row level security;
alter table public.services enable row level security;
alter table public.service_variants enable row level security;
alter table public.resources enable row level security;
alter table public.resource_services enable row level security;
alter table public.working_hours enable row level security;
alter table public.time_off enable row level security;
alter table public.booking_fields enable row level security;
alter table public.customers enable row level security;
alter table public.customer_notes enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_items enable row level security;
alter table public.data_requests enable row level security;

-- İşletme: yayındaysa herkes okur; üyeler yayında olmasa da görür. Yeni işletme `create_business` RPC'si ile açılır.
create policy businesses_select on public.businesses
  for select to anon, authenticated
  using (published or (select private.is_business_member(id)));
create policy businesses_update on public.businesses
  for update to authenticated
  using ((select private.is_business_owner(id)))
  with check ((select private.is_business_owner(id)));
create policy businesses_delete on public.businesses
  for delete to authenticated
  using ((select private.is_business_owner(id)));

-- Ayarlar: işletmeyi görebilen okur (alt sorgu businesses'in RLS'inden geçer), sahibi günceller.
create policy business_settings_select on public.business_settings
  for select to anon, authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id));
create policy business_settings_update on public.business_settings
  for update to authenticated
  using ((select private.is_business_owner(business_id)))
  with check ((select private.is_business_owner(business_id)));

-- Üyelik: kişi kendi üyeliğini, sahibi işletmesinin tüm üyelerini görür.
create policy business_members_select on public.business_members
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_business_owner(business_id)));
create policy business_members_insert on public.business_members
  for insert to authenticated
  with check ((select private.is_business_owner(business_id)) and role = 'staff');
create policy business_members_delete on public.business_members
  for delete to authenticated
  using ((select private.is_business_owner(business_id)) and user_id <> (select auth.uid()));

-- business_id'si doğrudan tabloda olanlar: herkes okur, sahibi yazar.
do $$
declare
  t text;
begin
  foreach t in array array['services', 'resources', 'booking_fields'] loop
    execute format(
      'create policy %I on public.%I for select to anon, authenticated
         using (exists (select 1 from public.businesses b where b.id = business_id))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check ((select private.is_business_owner(business_id)))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using ((select private.is_business_owner(business_id)))
         with check ((select private.is_business_owner(business_id)))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using ((select private.is_business_owner(business_id)))',
      t || '_delete', t);
  end loop;
end
$$;

-- Hizmet varyantı: hizmet üzerinden
create policy service_variants_select on public.service_variants
  for select to anon, authenticated
  using (exists (select 1 from public.services s where s.id = service_id));
create policy service_variants_insert on public.service_variants
  for insert to authenticated
  with check (exists (
    select 1 from public.services s
    where s.id = service_id and (select private.is_business_owner(s.business_id))));
create policy service_variants_update on public.service_variants
  for update to authenticated
  using (exists (
    select 1 from public.services s
    where s.id = service_id and (select private.is_business_owner(s.business_id))))
  with check (exists (
    select 1 from public.services s
    where s.id = service_id and (select private.is_business_owner(s.business_id))));
create policy service_variants_delete on public.service_variants
  for delete to authenticated
  using (exists (
    select 1 from public.services s
    where s.id = service_id and (select private.is_business_owner(s.business_id))));

-- Kaynak-hizmet eşlemesi ve çalışma saatleri: kaynak üzerinden
do $$
declare
  t text;
begin
  foreach t in array array['resource_services', 'working_hours'] loop
    execute format(
      'create policy %I on public.%I for select to anon, authenticated
         using (exists (select 1 from public.resources r where r.id = resource_id))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (exists (select 1 from public.resources r
           where r.id = resource_id and (select private.is_business_owner(r.business_id))))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (exists (select 1 from public.resources r
           where r.id = resource_id and (select private.is_business_owner(r.business_id))))
         with check (exists (select 1 from public.resources r
           where r.id = resource_id and (select private.is_business_owner(r.business_id))))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (exists (select 1 from public.resources r
           where r.id = resource_id and (select private.is_business_owner(r.business_id))))',
      t || '_delete', t);
  end loop;
end
$$;

-- İzin: gerekçesi özel olabilir, bu yüzden yalnızca üyeler okur. Müşteri tarafı dolu saatleri
-- `busy_slots` fonksiyonundan (gerekçesiz) alır.
create policy time_off_select on public.time_off
  for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy time_off_insert on public.time_off
  for insert to authenticated
  with check ((select private.is_business_owner(business_id)));
create policy time_off_update on public.time_off
  for update to authenticated
  using ((select private.is_business_owner(business_id)))
  with check ((select private.is_business_owner(business_id)));
create policy time_off_delete on public.time_off
  for delete to authenticated
  using ((select private.is_business_owner(business_id)));

-- Müşteri: kişi kendi kaydını, üyeler işletmenin tüm müşterilerini görür. Hesaplı müşteri kaydı
-- `create_appointment` içinde açılır; üyeler hesapsız (telefonla gelen) müşteri ekleyebilir.
create policy customers_select on public.customers
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_business_member(business_id)));
create policy customers_insert on public.customers
  for insert to authenticated
  with check ((select private.is_business_member(business_id)) and user_id is null);
create policy customers_update on public.customers
  for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_business_member(business_id)))
  with check (user_id = (select auth.uid()) or (select private.is_business_member(business_id)));
create policy customers_delete on public.customers
  for delete to authenticated
  using ((select private.is_business_member(business_id)));

-- Özel not: yalnızca işletme üyeleri
create policy customer_notes_select on public.customer_notes
  for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy customer_notes_insert on public.customer_notes
  for insert to authenticated
  with check ((select private.is_business_member(business_id)));
create policy customer_notes_update on public.customer_notes
  for update to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));
create policy customer_notes_delete on public.customer_notes
  for delete to authenticated
  using ((select private.is_business_member(business_id)));

-- Randevu: müşteri kendininkini, sahibi işletmeninkileri, personel kendi kaynağınınkileri görür.
-- Yazma politikası yok: yalnızca RPC fonksiyonları yazar.
create policy appointments_select on public.appointments
  for select to authenticated
  using (
    (select private.is_business_owner(business_id))
    or (select private.is_resource_staff(resource_id))
    or exists (
      select 1 from public.customers c
      where c.id = customer_id and c.user_id = (select auth.uid())
    )
  );

create policy appointment_items_select on public.appointment_items
  for select to authenticated
  using (exists (select 1 from public.appointments a where a.id = appointment_id));

-- KVKK talepleri: kişi yalnızca kendi talebini görür/açar
create policy data_requests_select on public.data_requests
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy data_requests_insert on public.data_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()));
