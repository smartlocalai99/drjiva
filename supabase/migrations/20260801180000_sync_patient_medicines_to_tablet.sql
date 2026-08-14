alter table public.patient_custom_medicines
  add column sync_status text not null default 'pending',
  add column sync_claimed_at timestamptz,
  add column sync_completed_at timestamptz,
  add column sync_error text,
  add column shared_image_path text,
  add column synced_medicine_id uuid references public.medicines(id)
    on delete set null;

alter table public.patient_custom_medicines
  add constraint patient_custom_medicines_sync_status_check
  check (sync_status in ('pending', 'syncing', 'completed', 'error'));

create index patient_custom_medicines_sync_queue_idx
  on public.patient_custom_medicines(sync_status, sync_claimed_at, created_at)
  where sync_status <> 'completed';

do $$
begin
  if not exists (
    select 1
    from vault.secrets
    where name = 'patient_medicine_sync_webhook_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'patient_medicine_sync_webhook_secret',
      'Authenticates patient medicine database webhooks.'
    );
  end if;
end;
$$;

create or replace function public.patient_medicine_sync_secret_is_valid(
  p_webhook_secret text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select decrypted.decrypted_secret = coalesce(p_webhook_secret, '')
      from vault.decrypted_secrets as decrypted
      where decrypted.name = 'patient_medicine_sync_webhook_secret'
      limit 1
    ),
    false
  );
$$;

create or replace function public.resolve_patient_custom_medicine_hospital(
  p_custom_medicine_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(custom_medicine.hospital_id, official_hospital.id)
  from public.patient_custom_medicines as custom_medicine
  left join public.patient_custom_hospitals as custom_hospital
    on custom_hospital.id = custom_medicine.custom_hospital_id
  left join public.hospitals as official_hospital
    on official_hospital.normalized_name =
      public.normalize_hospital_name(custom_hospital.name)
  where custom_medicine.id = p_custom_medicine_id;
$$;

create or replace function public.claim_patient_custom_medicine_sync(
  p_custom_medicine_id uuid,
  p_webhook_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  custom_medicine public.patient_custom_medicines%rowtype;
  official_hospital_id uuid;
  shared_path text;
begin
  if not public.patient_medicine_sync_secret_is_valid(p_webhook_secret) then
    raise exception using
      errcode = '42501',
      message = 'Invalid patient medicine sync webhook secret.';
  end if;

  official_hospital_id :=
    public.resolve_patient_custom_medicine_hospital(p_custom_medicine_id);

  if official_hospital_id is null then
    update public.patient_custom_medicines
    set sync_status = 'error',
        sync_error = 'Matching official hospital was not found.',
        sync_claimed_at = now()
    where id = p_custom_medicine_id
      and sync_status <> 'completed';
    return null;
  end if;

  update public.patient_custom_medicines
  set sync_status = 'syncing',
      sync_claimed_at = now(),
      sync_error = null
  where id = p_custom_medicine_id
    and (
      sync_status in ('pending', 'error')
      or (
        sync_status = 'syncing'
        and sync_claimed_at < now() - interval '5 minutes'
      )
    )
  returning * into custom_medicine;

  if not found then
    return null;
  end if;

  shared_path :=
    'patient-submissions/' || custom_medicine.id::text || '.jpg';

  return jsonb_build_object(
    'imagePath', custom_medicine.image_path,
    'sharedImagePath', shared_path
  );
end;
$$;

create or replace function public.complete_patient_custom_medicine_sync(
  p_custom_medicine_id uuid,
  p_shared_image_path text,
  p_webhook_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  custom_medicine public.patient_custom_medicines%rowtype;
  official_hospital public.hospitals%rowtype;
  shared_image_url text;
  shared_medicine_id uuid;
begin
  if not public.patient_medicine_sync_secret_is_valid(p_webhook_secret) then
    raise exception using
      errcode = '42501',
      message = 'Invalid patient medicine sync webhook secret.';
  end if;

  select *
  into strict custom_medicine
  from public.patient_custom_medicines
  where id = p_custom_medicine_id
  for update;

  if p_shared_image_path <>
      'patient-submissions/' || custom_medicine.id::text || '.jpg' then
    raise exception using
      errcode = '22023',
      message = 'Invalid shared patient medicine image path.';
  end if;

  select *
  into strict official_hospital
  from public.hospitals
  where id = public.resolve_patient_custom_medicine_hospital(
    p_custom_medicine_id
  );

  shared_image_url :=
    'https://jlvjnnltynebenflkcua.supabase.co/storage/v1/object/public/' ||
    'medicine-images/' || p_shared_image_path;

  select medicine.id
  into shared_medicine_id
  from public.medicines as medicine
  where lower(btrim(medicine.name)) = lower(btrim(custom_medicine.name))
  order by medicine.created_at, medicine.id
  limit 1
  for update;

  if shared_medicine_id is null then
    shared_medicine_id := gen_random_uuid();
    insert into public.medicines(
      id,
      name,
      image_url,
      category,
      hospital_name,
      hospital_id,
      code
    )
    values (
      shared_medicine_id,
      custom_medicine.name,
      shared_image_url,
      'General',
      official_hospital.name,
      official_hospital.id::text,
      'PAT' || upper(substr(replace(shared_medicine_id::text, '-', ''), 1, 12))
    );
  else
    update public.medicines
    set image_url = case
          when nullif(btrim(coalesce(image_url, '')), '') is null
            then shared_image_url
          else image_url
        end
    where id = shared_medicine_id;
  end if;

  update public.tablet_submissions
  set image_url = shared_image_url
  where hospital_id = official_hospital.id
    and medicine_id = shared_medicine_id;

  if not found then
    insert into public.tablet_submissions(
      hospital_id,
      medicine_id,
      image_url,
      created_by
    )
    values (
      official_hospital.id,
      shared_medicine_id,
      shared_image_url,
      null
    );
  end if;

  update public.patient_custom_medicines
  set sync_status = 'completed',
      sync_completed_at = now(),
      sync_error = null,
      shared_image_path = p_shared_image_path,
      synced_medicine_id = shared_medicine_id
  where id = p_custom_medicine_id;

  return jsonb_build_object(
    'hospitalId', official_hospital.id,
    'medicineId', shared_medicine_id
  );
end;
$$;

create or replace function public.fail_patient_custom_medicine_sync(
  p_custom_medicine_id uuid,
  p_error text,
  p_webhook_secret text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.patient_medicine_sync_secret_is_valid(p_webhook_secret) then
    raise exception using
      errcode = '42501',
      message = 'Invalid patient medicine sync webhook secret.';
  end if;

  update public.patient_custom_medicines
  set sync_status = 'error',
      sync_error = left(coalesce(p_error, 'Unknown sync error'), 500),
      sync_claimed_at = now()
  where id = p_custom_medicine_id
    and sync_status <> 'completed';

  return found;
end;
$$;

create or replace function public.request_patient_custom_medicine_sync(
  p_custom_medicine_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_secret text;
  request_id bigint;
begin
  select decrypted.decrypted_secret
  into webhook_secret
  from vault.decrypted_secrets as decrypted
  where decrypted.name = 'patient_medicine_sync_webhook_secret'
  limit 1;

  if webhook_secret is null then
    raise exception 'Patient medicine sync webhook secret is unavailable.';
  end if;

  select net.http_post(
    url := 'https://jlvjnnltynebenflkcua.supabase.co/functions/v1/' ||
      'sync-patient-medicine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-patient-medicine-sync-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'custom_medicine_id', p_custom_medicine_id
    ),
    timeout_milliseconds := 10000
  )
  into request_id;

  return request_id;
end;
$$;

create or replace function public.enqueue_patient_custom_medicine_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.request_patient_custom_medicine_sync(new.id);
  return new;
end;
$$;

create or replace function public.enqueue_pending_patient_medicine_syncs(
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  custom_medicine record;
  enqueued integer := 0;
begin
  for custom_medicine in
    select id
    from public.patient_custom_medicines
    where sync_status in ('pending', 'error')
      or (
        sync_status = 'syncing'
        and sync_claimed_at < now() - interval '5 minutes'
      )
    order by created_at
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  loop
    perform public.request_patient_custom_medicine_sync(custom_medicine.id);
    enqueued := enqueued + 1;
  end loop;

  return enqueued;
end;
$$;

revoke all on function public.patient_medicine_sync_secret_is_valid(text)
  from public;
revoke all on function public.resolve_patient_custom_medicine_hospital(uuid)
  from public;
revoke all on function public.claim_patient_custom_medicine_sync(uuid, text)
  from public;
revoke all on function public.complete_patient_custom_medicine_sync(
  uuid,
  text,
  text
) from public;
revoke all on function public.fail_patient_custom_medicine_sync(
  uuid,
  text,
  text
) from public;
revoke all on function public.request_patient_custom_medicine_sync(uuid)
  from public;
revoke all on function public.enqueue_patient_custom_medicine_sync()
  from public;
revoke all on function public.enqueue_pending_patient_medicine_syncs(integer)
  from public;

grant execute on function public.claim_patient_custom_medicine_sync(uuid, text)
  to service_role;
grant execute on function public.complete_patient_custom_medicine_sync(
  uuid,
  text,
  text
) to service_role;
grant execute on function public.fail_patient_custom_medicine_sync(
  uuid,
  text,
  text
) to service_role;

drop trigger if exists patient_custom_medicines_enqueue_sync
  on public.patient_custom_medicines;

create trigger patient_custom_medicines_enqueue_sync
after insert on public.patient_custom_medicines
for each row
execute function public.enqueue_patient_custom_medicine_sync();

select cron.unschedule(jobid)
from cron.job
where jobname = 'retry-patient-medicine-sync';

select cron.schedule(
  'retry-patient-medicine-sync',
  '*/5 * * * *',
  $$select public.enqueue_pending_patient_medicine_syncs(100);$$
);

select public.enqueue_pending_patient_medicine_syncs(100);
