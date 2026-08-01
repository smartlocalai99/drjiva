create table public.patient_custom_medicines (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  hospital_id uuid references public.hospitals(id),
  custom_hospital_id uuid,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  normalized_name text not null check (char_length(btrim(normalized_name)) between 2 and 120),
  image_path text not null check (char_length(btrim(image_path)) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_custom_medicine_hospital_choice check (
    num_nonnulls(hospital_id, custom_hospital_id) = 1
  ),
  constraint patient_custom_medicine_custom_hospital_owner_fk
    foreign key (custom_hospital_id, owner_user_id)
    references public.patient_custom_hospitals(id, owner_user_id),
  unique (id, owner_user_id)
);

create unique index patient_custom_medicines_verified_name_idx
  on public.patient_custom_medicines(owner_user_id, hospital_id, normalized_name)
  where hospital_id is not null;

create unique index patient_custom_medicines_custom_name_idx
  on public.patient_custom_medicines(owner_user_id, custom_hospital_id, normalized_name)
  where custom_hospital_id is not null;

create index patient_custom_medicines_owner_patient_idx
  on public.patient_custom_medicines(owner_user_id, patient_id, created_at desc);

alter table public.patient_custom_medicines enable row level security;

grant select, insert, update, delete
  on public.patient_custom_medicines to authenticated;

create policy "Patients manage own custom medicines"
on public.patient_custom_medicines
for all to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-medicine-images',
  'patient-medicine-images',
  false,
  5242880,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Patients read own medicine images"
on storage.objects for select to authenticated
using (
  bucket_id = 'patient-medicine-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Patients upload own medicine images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'patient-medicine-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Patients update own medicine images"
on storage.objects for update to authenticated
using (
  bucket_id = 'patient-medicine-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'patient-medicine-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Patients delete own medicine images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'patient-medicine-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

alter table public.patient_medicine_courses
  alter column medicine_id drop not null,
  alter column duration_days drop not null;

alter table public.patient_medicine_courses
  add column custom_medicine_id uuid,
  add column schedule_mode text not null default 'finite',
  add column stopped_at timestamptz;

alter table public.patient_medicine_courses
  drop constraint if exists patient_medicine_courses_duration_days_check;

alter table public.patient_medicine_courses
  add constraint patient_medicine_course_source_choice
    check (num_nonnulls(medicine_id, custom_medicine_id) = 1),
  add constraint patient_medicine_course_schedule_valid check (
    (
      schedule_mode = 'finite'
      and duration_days between 1 and 7
      and stopped_at is null
    )
    or (
      schedule_mode = 'ongoing'
      and duration_days is null
      and day_pattern = 'daily'
    )
  ),
  add constraint patient_medicine_course_custom_medicine_owner_fk
    foreign key (custom_medicine_id, owner_user_id)
    references public.patient_custom_medicines(id, owner_user_id);

create index patient_medicine_courses_ongoing_idx
  on public.patient_medicine_courses(owner_user_id, patient_id, status, stopped_at)
  where schedule_mode = 'ongoing';
