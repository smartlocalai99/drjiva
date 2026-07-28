create table public.patient_notification_settings (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  morning_time time not null default '08:00',
  afternoon_time time not null default '13:00',
  night_time time not null default '20:00',
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_notification_times_ordered
    check (morning_time < afternoon_time and afternoon_time < night_time),
  unique (patient_id, owner_user_id)
);

create table public.patient_custom_hospitals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  normalized_name text not null
    check (char_length(btrim(normalized_name)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, normalized_name),
  unique (id, owner_user_id)
);

create table public.patient_medicine_courses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  hospital_id uuid references public.hospitals(id),
  custom_hospital_id uuid,
  medicine_id uuid not null references public.medicines(id),
  tablets_per_dose numeric(4,2) not null
    check (
      tablets_per_dose between 0.25 and 10
      and mod(tablets_per_dose * 100, 25) = 0
    ),
  start_date date not null,
  duration_days integer not null check (duration_days between 1 and 365),
  day_pattern text not null check (day_pattern in ('daily', 'alternate')),
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_medicine_course_hospital_choice check (
    (hospital_id is not null and custom_hospital_id is null)
    or (hospital_id is null and custom_hospital_id is not null)
  ),
  constraint patient_medicine_course_custom_hospital_owner_fk
    foreign key (custom_hospital_id, owner_user_id)
    references public.patient_custom_hospitals(id, owner_user_id),
  unique (id, owner_user_id)
);

create table public.patient_medicine_course_slots (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null check (slot in ('morning', 'afternoon', 'night')),
  created_at timestamptz not null default now(),
  constraint patient_medicine_slot_course_owner_fk
    foreign key (course_id, owner_user_id)
    references public.patient_medicine_courses(id, owner_user_id)
    on delete cascade,
  unique (course_id, slot)
);

create table public.patient_medicine_dose_events (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_for timestamptz not null,
  slot text not null check (slot in ('morning', 'afternoon', 'night')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'missed', 'cancelled')),
  completed_at timestamptz,
  notification_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_medicine_event_course_owner_fk
    foreign key (course_id, owner_user_id)
    references public.patient_medicine_courses(id, owner_user_id)
    on delete cascade,
  constraint patient_medicine_event_completion_consistent check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  ),
  unique (course_id, scheduled_for)
);

create index patient_custom_hospitals_owner_patient_idx
  on public.patient_custom_hospitals(owner_user_id, patient_id);
create index patient_medicine_courses_owner_patient_status_idx
  on public.patient_medicine_courses(owner_user_id, patient_id, status);
create index patient_medicine_events_owner_scheduled_idx
  on public.patient_medicine_dose_events
    (owner_user_id, patient_id, scheduled_for);

alter table public.patient_notification_settings enable row level security;
alter table public.patient_custom_hospitals enable row level security;
alter table public.patient_medicine_courses enable row level security;
alter table public.patient_medicine_course_slots enable row level security;
alter table public.patient_medicine_dose_events enable row level security;

grant select, insert, update, delete
  on public.patient_notification_settings,
     public.patient_custom_hospitals,
     public.patient_medicine_courses,
     public.patient_medicine_course_slots,
     public.patient_medicine_dose_events
  to authenticated;

create policy "Patients manage own notification settings"
on public.patient_notification_settings
for all to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

create policy "Patients manage own custom hospitals"
on public.patient_custom_hospitals
for all to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

create policy "Patients manage own medicine courses"
on public.patient_medicine_courses
for all to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

create policy "Patients manage own medicine course slots"
on public.patient_medicine_course_slots
for all to authenticated
using ((select auth.uid()) = owner_user_id)
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1
    from public.patient_medicine_courses course
    where course.id = course_id
      and course.owner_user_id = (select auth.uid())
  )
);

create policy "Patients manage own medicine dose events"
on public.patient_medicine_dose_events
for all to authenticated
using ((select auth.uid()) = owner_user_id)
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1
    from public.patient_medicine_courses course
    where course.id = course_id
      and course.patient_id = patient_id
      and course.owner_user_id = (select auth.uid())
  )
);
