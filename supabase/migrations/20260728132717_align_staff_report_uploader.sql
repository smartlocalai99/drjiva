drop policy if exists "Staff can create patient reports"
  on public.patient_reports;

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
  and uploaded_by = 'hospital'
  and uploaded_by_staff_id = (select auth.uid())
);
