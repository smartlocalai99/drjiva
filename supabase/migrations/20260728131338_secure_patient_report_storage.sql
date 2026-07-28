alter table public.patient_reports
  add column if not exists owner_user_id uuid references auth.users(id)
    on delete set null,
  add column if not exists report_type text,
  add column if not exists page_count integer not null default 1,
  add column if not exists storage_path text;

alter table public.patient_reports
  drop constraint if exists patient_reports_page_count_check,
  add constraint patient_reports_page_count_check
    check (page_count between 1 and 10),
  drop constraint if exists patient_reports_report_type_check,
  add constraint patient_reports_report_type_check
    check (
      report_type is null
      or report_type in (
        'Prescription',
        'OP Consultation',
        'Lab Report',
        'Imaging',
        'Discharge Summary',
        'Other'
      )
    );

create unique index if not exists patient_reports_storage_path_key
  on public.patient_reports (storage_path)
  where storage_path is not null;

create index if not exists patient_reports_owner_patient_created_idx
  on public.patient_reports (owner_user_id, patient_id, created_at desc);

alter table public.patient_reports enable row level security;

drop policy if exists "anon can create patient reports"
  on public.patient_reports;
drop policy if exists "anon can delete patient reports"
  on public.patient_reports;
drop policy if exists "anon can read patient reports"
  on public.patient_reports;
drop policy if exists "staff can create patient reports"
  on public.patient_reports;
drop policy if exists "staff can read patient reports"
  on public.patient_reports;

create policy "Patients can read own reports"
on public.patient_reports
for select
to authenticated
using ((select auth.uid()) = owner_user_id);

create policy "Patients can create own reports"
on public.patient_reports
for insert
to authenticated
with check (
  (select auth.uid()) = owner_user_id
  and uploaded_by = 'patient'
  and uploaded_by_staff_id is null
);

create policy "Patients can delete own reports"
on public.patient_reports
for delete
to authenticated
using (
  (select auth.uid()) = owner_user_id
  and uploaded_by = 'patient'
);

create policy "Staff can read patient reports"
on public.patient_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.staff_profiles
    where staff_profiles.id = (select auth.uid())
  )
);

create policy "Staff can create patient reports"
on public.patient_reports
for insert
to authenticated
with check (
  exists (
    select 1
    from public.staff_profiles
    where staff_profiles.id = (select auth.uid())
  )
  and uploaded_by = 'staff'
  and uploaded_by_staff_id = (select auth.uid())
);

update storage.buckets
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array['application/pdf']
where id = 'patient-reports';

drop policy if exists "patient reports anon delete"
  on storage.objects;
drop policy if exists "patient reports anon read"
  on storage.objects;
drop policy if exists "patient reports anon upload"
  on storage.objects;
drop policy if exists "patient reports staff read"
  on storage.objects;
drop policy if exists "patient reports staff upload"
  on storage.objects;

create policy "Patients can upload own report files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'patient-reports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.extension(name)) = 'pdf'
);

create policy "Patients can read own report files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'patient-reports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Patients can delete own report files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'patient-reports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Staff can read report files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'patient-reports'
  and exists (
    select 1
    from public.staff_profiles
    where staff_profiles.id = (select auth.uid())
  )
);
