alter table public.patients
  add column if not exists avatar_url text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-pictures',
  'profile-pictures',
  true,
  5242880,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Client can create versioned profile pictures"
  on storage.objects;

create policy "Client can create versioned profile pictures"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'profile-pictures'
  and array_length(storage.foldername(name), 1) = 1
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png')
);
