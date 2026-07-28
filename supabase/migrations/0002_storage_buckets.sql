-- supabase/migrations/0002_storage_buckets.sql
insert into storage.buckets (id, name, public) values
  ('medicine-images', 'medicine-images', true),
  ('patient-reports', 'patient-reports', false);
-- medicine-images: public read (Phase 2 patient app renders these without auth),
-- staff can upload and replace (upsert needs insert + select + update together).
create policy "medicine images public read" on storage.objects
  for select to public using (bucket_id = 'medicine-images');
create policy "medicine images staff upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'medicine-images');
create policy "medicine images staff replace" on storage.objects
  for update to authenticated using (bucket_id = 'medicine-images') with check (bucket_id = 'medicine-images');
-- patient-reports: private, staff-only for now (append-only, no replace needed).
create policy "patient reports staff read" on storage.objects
  for select to authenticated using (bucket_id = 'patient-reports');
create policy "patient reports staff upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'patient-reports');
