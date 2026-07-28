create policy "Staff can upload hospital report files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'patient-reports'
  and lower(storage.extension(name)) = 'pdf'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.staff_profiles
    where staff_profiles.id = (select auth.uid())
      and staff_profiles.hospital_id::text =
        (storage.foldername(name))[1]
  )
);
