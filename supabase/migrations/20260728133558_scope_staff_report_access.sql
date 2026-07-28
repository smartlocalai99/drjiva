drop policy if exists "Staff can read patient reports"
  on public.patient_reports;
drop policy if exists "Staff can create patient reports"
  on public.patient_reports;

create policy "Staff can read hospital patient reports"
on public.patient_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.staff_profiles
    where staff_profiles.id = (select auth.uid())
      and staff_profiles.hospital_id = patient_reports.hospital_id
  )
);

create policy "Staff can create hospital patient reports"
on public.patient_reports
for insert
to authenticated
with check (
  exists (
    select 1
    from public.staff_profiles
    where staff_profiles.id = (select auth.uid())
      and staff_profiles.hospital_id = patient_reports.hospital_id
  )
  and uploaded_by = 'hospital'
  and uploaded_by_staff_id = (select auth.uid())
);

drop policy if exists "Staff can read report files"
  on storage.objects;

create policy "Staff can read hospital report files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'patient-reports'
  and exists (
    select 1
    from public.patient_reports
    join public.staff_profiles
      on staff_profiles.id = (select auth.uid())
      and staff_profiles.hospital_id = patient_reports.hospital_id
    where patient_reports.storage_path = name
  )
);

create index if not exists patient_reports_hospital_storage_path_idx
  on public.patient_reports (hospital_id, storage_path)
  where storage_path is not null;
