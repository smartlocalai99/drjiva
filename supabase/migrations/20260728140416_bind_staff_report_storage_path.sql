drop policy if exists "Staff can create hospital patient reports"
  on public.patient_reports;

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
  and storage_path like
    patient_reports.hospital_id::text
      || '/'
      || (select auth.uid())::text
      || '/%.pdf'
  and file_url = storage_path
  and file_type = 'pdf'
);
