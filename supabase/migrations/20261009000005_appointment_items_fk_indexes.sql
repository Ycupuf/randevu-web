-- 5/5: appointment_items yabancı anahtarları için indeks (Supabase performans uyarısı: unindexed_foreign_keys)
create index if not exists appointment_items_service_idx on public.appointment_items (service_id) where service_id is not null;
create index if not exists appointment_items_variant_idx on public.appointment_items (variant_id) where variant_id is not null;
