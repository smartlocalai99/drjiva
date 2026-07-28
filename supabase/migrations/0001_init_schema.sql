-- supabase/migrations/0001_init_schema.sql
create extension if not exists pgcrypto;
create table public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  created_at timestamptz not null default now()
);
create table public.staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  hospital_id uuid not null references public.hospitals(id),
  full_name text not null,
  created_at timestamptz not null default now()
);
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  mobile text not null unique,
  name text,
  age int,
  gender text check (gender in ('male', 'female', 'other')),
  created_at timestamptz not null default now()
);
create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  category text,
  created_at timestamptz not null default now()
);
create unique index medicines_name_lower_idx on public.medicines (lower(name));
create table public.dispenses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  hospital_id uuid not null references public.hospitals(id),
  staff_id uuid not null references public.staff_profiles(id),
  notes text,
  created_at timestamptz not null default now()
);
create index dispenses_patient_id_idx on public.dispenses (patient_id);
create table public.dispense_items (
  id uuid primary key default gen_random_uuid(),
  dispense_id uuid not null references public.dispenses(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id),
  timing text[] not null,
  food_instruction text not null check (food_instruction in ('before_food', 'after_food')),
  quantity text not null,
  duration_days int not null check (duration_days > 0),
  created_at timestamptz not null default now(),
  constraint dispense_items_timing_valid check (
    timing <@ array['morning', 'afternoon', 'night']::text[] and cardinality(timing) > 0
  )
);
create index dispense_items_dispense_id_idx on public.dispense_items (dispense_id);
-- file_url semantics differ by uploaded_by: for hospital uploads this is a storage
-- object path in the private 'patient-reports' bucket (resolved to a signed URL on
-- read); Phase 2 patient self-uploads will follow the same convention.
create table public.patient_reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  hospital_id uuid references public.hospitals(id),
  uploaded_by text not null check (uploaded_by in ('patient', 'hospital')),
  uploaded_by_staff_id uuid references public.staff_profiles(id),
  label text,
  file_url text not null,
  file_type text not null check (file_type in ('image', 'pdf')),
  created_at timestamptz not null default now()
);
create index patient_reports_patient_id_idx on public.patient_reports (patient_id);
-- Phase 2 tables (patient mobile app). Created now for forward compatibility.
-- RLS enabled, zero policies: fully locked down until Phase 2 defines patient-side access.
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  expo_push_token text not null unique,
  device_info text,
  created_at timestamptz not null default now()
);
create table public.dose_logs (
  id uuid primary key default gen_random_uuid(),
  dispense_item_id uuid not null references public.dispense_items(id),
  patient_id uuid not null references public.patients(id),
  slot text not null check (slot in ('morning', 'afternoon', 'night')),
  dose_date date not null,
  taken_at timestamptz not null default now(),
  unique (dispense_item_id, dose_date, slot)
);
-- Row Level Security
alter table public.hospitals enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.patients enable row level security;
alter table public.medicines enable row level security;
alter table public.dispenses enable row level security;
alter table public.dispense_items enable row level security;
alter table public.patient_reports enable row level security;
alter table public.push_tokens enable row level security;
alter table public.dose_logs enable row level security;
-- Per spec §3: patient records are intentionally shared across all hospitals, not
-- siloed per staff account. These "USING (true)" policies are a deliberate design
-- choice, not an oversight — see spec §10 for the accepted trade-off.
create policy "staff can read hospitals" on public.hospitals
  for select to authenticated using (true);
create policy "staff can read staff profiles" on public.staff_profiles
  for select to authenticated using (true);
create policy "staff can read patients" on public.patients
  for select to authenticated using (true);
create policy "staff can create patients" on public.patients
  for insert to authenticated with check (true);
create policy "staff can update patients" on public.patients
  for update to authenticated using (true) with check (true);
create policy "staff can read medicines" on public.medicines
  for select to authenticated using (true);
create policy "staff can create medicines" on public.medicines
  for insert to authenticated with check (true);
create policy "staff can update medicines" on public.medicines
  for update to authenticated using (true) with check (true);
create policy "staff can read dispenses" on public.dispenses
  for select to authenticated using (true);
create policy "staff can create dispenses" on public.dispenses
  for insert to authenticated with check (true);
create policy "staff can read dispense items" on public.dispense_items
  for select to authenticated using (true);
create policy "staff can create dispense items" on public.dispense_items
  for insert to authenticated with check (true);
create policy "staff can read patient reports" on public.patient_reports
  for select to authenticated using (true);
create policy "staff can create patient reports" on public.patient_reports
  for insert to authenticated with check (true);
-- Data API exposure (required since the 2026-04-28 platform change — RLS alone is
-- not enough, tables need an explicit grant to be reachable via the REST API).
grant select on public.hospitals to authenticated;
grant select on public.staff_profiles to authenticated;
grant select, insert, update on public.patients to authenticated;
grant select, insert, update on public.medicines to authenticated;
grant select, insert on public.dispenses to authenticated;
grant select, insert on public.dispense_items to authenticated;
grant select, insert on public.patient_reports to authenticated;
