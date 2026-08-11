drop policy if exists "Client can delete profile pictures"
  on storage.objects;

create policy "Client can delete profile pictures"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-pictures'
  and array_length(storage.foldername(name), 1) = 1
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png')
);
