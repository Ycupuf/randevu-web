-- 19/19: Kod inceleme bulguları (2. tur).
--
-- (1) replace_working_hours: panel saatleri önce siliyor sonra ekliyordu; ikinci adım hata verirse kaynağın tüm
--     saatleri silinmiş kalıyordu. Tek işlevde (tek işlem) atomik yapılır. RLS'i çağıran kullanıcı adına uygular.
-- (2) Personelin müşteri verisi: customers/customer_notes tüm üyelere açıktı; personel işletmenin TÜM müşterilerinin
--     telefon, e-posta ve notlarını görüp silebiliyordu. Artık: sahip hepsini, personel yalnızca kendi kaynağında
--     randevusu olan müşterileri görür; güncelleme/silme ve özel not yalnızca sahip.
--     (Doğrudan appointments alt sorgusu RLS özyinelemesi yaratır; security definer yardımcı işlev kullanılır.)
-- (3) Panelin kendi rotası /yeni işletme adresi olamaz.

create function public.replace_working_hours(p_resource_id uuid, p_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.working_hours where resource_id = p_resource_id;
  insert into public.working_hours (resource_id, weekday, start_time, end_time)
  select p_resource_id, (e ->> 'weekday')::smallint, (e ->> 'start_time')::time, (e ->> 'end_time')::time
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as e;
end;
$$;

revoke all on function public.replace_working_hours(uuid, jsonb) from public, anon;
grant execute on function public.replace_working_hours(uuid, jsonb) to authenticated;

create function private.staff_serves_customer(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.appointments a
      join public.resources r on r.id = a.resource_id
     where a.customer_id = p_customer_id and r.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.staff_serves_customer(uuid) from public;
-- RLS politikası bu işlevi çağırır: yetki verilmezse customers okuması herkes için "permission denied" olur.
grant execute on function private.staff_serves_customer(uuid) to authenticated;

drop policy customers_select on public.customers;
create policy customers_select on public.customers
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_business_owner(business_id))
    or (select private.staff_serves_customer(id))
  );

drop policy customers_update on public.customers;
create policy customers_update on public.customers
  for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_business_owner(business_id)))
  with check (user_id = (select auth.uid()) or (select private.is_business_owner(business_id)));

drop policy customers_delete on public.customers;
create policy customers_delete on public.customers
  for delete to authenticated
  using ((select private.is_business_owner(business_id)));

drop policy customer_notes_select on public.customer_notes;
drop policy customer_notes_insert on public.customer_notes;
drop policy customer_notes_update on public.customer_notes;
drop policy customer_notes_delete on public.customer_notes;
create policy customer_notes_select on public.customer_notes
  for select to authenticated using ((select private.is_business_owner(business_id)));
create policy customer_notes_insert on public.customer_notes
  for insert to authenticated with check ((select private.is_business_owner(business_id)));
create policy customer_notes_update on public.customer_notes
  for update to authenticated
  using ((select private.is_business_owner(business_id)))
  with check ((select private.is_business_owner(business_id)));
create policy customer_notes_delete on public.customer_notes
  for delete to authenticated using ((select private.is_business_owner(business_id)));

alter table public.businesses drop constraint businesses_slug_not_reserved;
alter table public.businesses
  add constraint businesses_slug_not_reserved check (slug not in (
    'giris', 'kayit', 'cikis', 'randevularim', 'hesabim', 'gizlilik', 'randevu',
    'api', 'auth', 'admin', 'panel', 'static', 'assets', 'public', 'proje', 'yeni'
  ));
