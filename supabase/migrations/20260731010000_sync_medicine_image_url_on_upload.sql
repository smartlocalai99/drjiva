-- The staff-side tool that uploads medicine photos to storage does not
-- reliably update medicines.image_url afterwards, leaving stale image
-- references in the shop/reminders. Storage filenames follow the
-- convention "<medicine id>_<upload timestamp>.<ext>", so a new upload can
-- be matched back to its medicine row and image_url kept in sync
-- automatically, independent of whatever tool performed the upload.
create or replace function public.sync_medicine_image_url()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_medicine_id uuid;
begin
  if new.bucket_id <> 'medicine-images' then
    return new;
  end if;

  matched_medicine_id := (regexp_match(new.name, '([0-9a-f-]{36})_[0-9]+\.[a-zA-Z]+$'))[1]::uuid;
  if matched_medicine_id is null then
    return new;
  end if;

  update public.medicines
  set image_url = 'https://jlvjnnltynebenflkcua.supabase.co/storage/v1/object/public/medicine-images/' || new.name
  where id = matched_medicine_id;

  return new;
end;
$$;

drop trigger if exists sync_medicine_image_url_on_upload on storage.objects;

create trigger sync_medicine_image_url_on_upload
after insert or update on storage.objects
for each row
execute function public.sync_medicine_image_url();
