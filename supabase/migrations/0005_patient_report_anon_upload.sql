-- supabase/migrations/0005_patient_report_anon_upload.sql

-- Enable public/anon insertion in patient_reports table
create policy "anon can create patient reports" on public.patient_reports
  for insert to anon with check (true);
grant insert on public.patient_reports to anon;
-- Enable public/anon access to patient-reports storage bucket
create policy "patient reports anon read" on storage.objects
  for select to public using (bucket_id = 'patient-reports');
create policy "patient reports anon upload" on storage.objects
  for insert to public with check (bucket_id = 'patient-reports');
