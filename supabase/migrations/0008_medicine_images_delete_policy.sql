-- Enable public/anon deletion from medicine-images storage bucket
create policy "medicine images anon delete" on storage.objects
  for delete to anon using (bucket_id = 'medicine-images');
