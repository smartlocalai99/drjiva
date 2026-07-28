-- supabase/migrations/0006_patient_report_anon_delete.sql

-- Enable public/anon deletion in patient_reports table
create policy "anon can delete patient reports" on public.patient_reports
  for delete to anon using (uploaded_by = 'patient');
grant delete on public.patient_reports to anon;
-- Enable public/anon deletion from patient-reports storage bucket
create policy "patient reports anon delete" on storage.objects
  for delete to public using (bucket_id = 'patient-reports');
