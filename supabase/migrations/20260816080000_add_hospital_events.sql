-- Free medical/dental camps hospitals run, shown on a new patient-facing
-- Camps tab. hospital_events is publicly readable (like hospitals/medicines
-- already are) since browsing camps doesn't need to expose anything
-- sensitive. Registering for one records the patient's mobile so the
-- hospital knows who to expect; a patient can register for the same event
-- only once.

create table public.hospital_events (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references public.hospitals(id),
  hospital_name text not null,
  hospital_logo_url text,
  title text not null,
  event_type text not null default 'other'
    check (event_type in ('medical', 'dental', 'other')),
  doctor_name text,
  description text,
  event_date date not null,
  start_time time,
  end_time time,
  location text,
  capacity integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index hospital_events_date_idx on public.hospital_events (event_date);

create table public.hospital_event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.hospital_events(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  mobile text not null,
  name text,
  created_at timestamptz not null default now(),
  unique (event_id, owner_user_id)
);

alter table public.hospital_events enable row level security;
alter table public.hospital_event_registrations enable row level security;

grant select on public.hospital_events to anon, authenticated;

create policy "Anyone can browse hospital events"
on public.hospital_events
for select to anon, authenticated
using (true);

grant select, insert on public.hospital_event_registrations to authenticated;

create policy "Patients manage their own event registrations"
on public.hospital_event_registrations
for all to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

-- A few real sample camps so the new tab isn't empty on first look — swap
-- or remove these once real camps are scheduled.
insert into public.hospital_events
  (hospital_id, hospital_name, title, event_type, doctor_name, description, event_date, start_time, end_time, location)
select
  h.id, h.name,
  'Free General Health Camp', 'medical', 'Dr. Sudarshan',
  'Free general checkups, BP and sugar screening for all ages.',
  current_date + 2, '09:00'::time, '13:00'::time, h.name
from public.hospitals h where h.name = 'Dhruva Hospitals'
union all
select
  h.id, h.name,
  'Free Dental Checkup Camp', 'dental', 'Dr. Mounika',
  'Free dental checkups and oral hygiene guidance.',
  current_date + 5, '10:00'::time, '14:00'::time, h.name
from public.hospitals h where h.name = 'Dhruva Hospitals'
union all
select
  h.id, h.name,
  'Free Diabetes Screening Camp', 'medical', 'Dr. Ritish Reddy',
  'Free blood sugar screening and diabetes consultation.',
  current_date + 9, '09:30'::time, '12:30'::time, h.name
from public.hospitals h where h.name = 'ASIAN MULTI SPECIALITY HOSPITALS';
