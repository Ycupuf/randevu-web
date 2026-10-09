-- 1/4: Eklentiler, tipler ve tablolar
-- Zaman her yerde UTC (timestamptz) saklanır; gün/saat hesabı işletmenin saat diliminde yapılır.

create extension if not exists btree_gist with schema extensions;

-- RLS yardımcı fonksiyonları burada durur. `private` şeması API'ye açılmaz.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create type public.member_role as enum ('owner', 'staff');
create type public.resource_kind as enum ('person', 'bay', 'room');
create type public.approval_mode as enum ('auto', 'manual');
create type public.resource_selection as enum ('customer', 'any', 'auto');
create type public.appointment_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.appointment_source as enum ('online', 'manual');

-- İşletme (kiracı)
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  name text not null check (char_length(name) between 2 and 80),
  sector text not null check (sector in ('berber', 'guzellik', 'oto_yikama', 'diger')),
  description text check (char_length(description) <= 500),
  address text check (char_length(address) <= 200),
  city text check (char_length(city) <= 60),
  phone text check (char_length(phone) <= 30),
  timezone text not null default 'Europe/Istanbul',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.business_settings (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  step_min int not null default 15 check (step_min in (5, 10, 15, 20, 30, 60)),
  min_notice_min int not null default 60 check (min_notice_min >= 0),
  horizon_days int not null default 30 check (horizon_days between 1 and 365),
  cancel_window_min int not null default 120 check (cancel_window_min >= 0),
  max_active_per_customer int not null default 3 check (max_active_per_customer >= 1),
  approval_mode public.approval_mode not null default 'auto',
  resource_selection public.resource_selection not null default 'customer',
  service_label text not null default 'Hizmet',
  resource_label text not null default 'Personel'
);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

-- Hizmetler. Varyant yoksa süre ve fiyat hizmetin kendisindedir; varyant varsa (araç tipi, bölge)
-- randevuda varyant seçmek zorunludur ve süre/fiyat varyanttan gelir.
create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 300),
  category text,
  duration_min int not null check (duration_min between 5 and 720),
  price_cents int check (price_cents >= 0),
  buffer_after_min int not null default 0 check (buffer_after_min between 0 and 120),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.service_variants (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  duration_min int not null check (duration_min between 5 and 720),
  price_cents int check (price_cents >= 0),
  sort int not null default 0
);

-- Kaynak: personel, yıkama bayı, oda. `user_id` doluysa o kişi panele giriş yapıp kendi takvimini görür.
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind public.resource_kind not null default 'person',
  user_id uuid references auth.users (id) on delete set null,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.resource_services (
  resource_id uuid not null references public.resources (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (resource_id, service_id)
);

-- weekday: 0 = Pazar ... 6 = Cumartesi (PostgreSQL `dow` ile aynı).
-- Aynı gün için birden fazla satır = mola. Gün sonu için end_time '24:00' olabilir.
create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);

-- İzin / kapalı gün. resource_id boşsa tüm işletme kapalı.
create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  resource_id uuid references public.resources (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (char_length(reason) <= 200),
  check (ends_at > starts_at)
);

-- Sektöre özel ekstra alanlar (plaka, alerji notu...)
create table public.booking_fields (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]+$'),
  label text not null check (char_length(label) between 1 and 80),
  field_type text not null default 'text' check (field_type in ('text', 'textarea')),
  required boolean not null default false,
  sort int not null default 0,
  unique (business_id, key)
);

-- İşletmenin müşterisi. user_id boşsa telefonla/yüz yüze eklenen (hesapsız) müşteri.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null check (char_length(full_name) between 2 and 80),
  phone text check (char_length(phone) <= 20),
  email text check (char_length(email) <= 254),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

-- İşletmenin müşteri hakkındaki özel notu: müşterinin kendisi göremez, bu yüzden ayrı tablo.
create table public.customer_notes (
  customer_id uuid primary key references public.customers (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  note text not null check (char_length(note) <= 1000),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  resource_id uuid not null references public.resources (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Kaynağın tekrar müsait olduğu an: bitiş + hazırlık payı. Çakışma buna göre denetlenir.
  blocks_until timestamptz not null,
  status public.appointment_status not null default 'confirmed',
  source public.appointment_source not null default 'online',
  field_answers jsonb not null default '{}'::jsonb,
  note text check (char_length(note) <= 500),
  cancelled_by text check (cancelled_by in ('customer', 'business')),
  cancel_reason text check (char_length(cancel_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (blocks_until >= ends_at),
  -- ÇAKIŞMA GARANTİSİ: aynı kaynağın, iptal edilmemiş iki randevusunun aralığı kesişemez.
  constraint no_double_booking exclude using gist (
    resource_id with =,
    tstzrange(starts_at, blocks_until, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);

-- Randevudaki hizmetlerin o anki kopyası (fiyat/süre sonradan değişse de geçmiş bozulmaz)
create table public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  variant_id uuid references public.service_variants (id) on delete set null,
  name text not null,
  duration_min int not null check (duration_min > 0),
  price_cents int check (price_cents >= 0)
);

-- KVKK: kullanıcının veri dışa aktarma / silme talepleri
create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('export', 'delete')),
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);

-- İndeksler (yabancı anahtarlar ve sık sorgular)
create index business_members_user_idx on public.business_members (user_id);
create index services_business_idx on public.services (business_id, sort);
create index service_variants_service_idx on public.service_variants (service_id, sort);
create index resources_business_idx on public.resources (business_id, sort);
create index resources_user_idx on public.resources (user_id) where user_id is not null;
create index resource_services_service_idx on public.resource_services (service_id);
create index working_hours_resource_idx on public.working_hours (resource_id, weekday);
create index time_off_business_idx on public.time_off (business_id, starts_at);
create index time_off_resource_idx on public.time_off (resource_id, starts_at);
create index booking_fields_business_idx on public.booking_fields (business_id, sort);
create index customers_business_idx on public.customers (business_id);
create index customers_user_idx on public.customers (user_id) where user_id is not null;
create index customer_notes_business_idx on public.customer_notes (business_id);
create index appointments_business_start_idx on public.appointments (business_id, starts_at);
create index appointments_resource_start_idx on public.appointments (resource_id, starts_at);
create index appointments_customer_idx on public.appointments (customer_id, starts_at desc);
create index appointment_items_appointment_idx on public.appointment_items (appointment_id);
create index data_requests_user_idx on public.data_requests (user_id);

-- updated_at otomatik güncellensin
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger appointments_touch_updated_at
  before update on public.appointments
  for each row execute function private.touch_updated_at();
