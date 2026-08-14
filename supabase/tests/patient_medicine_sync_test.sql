begin;

set local session_replication_role = replica;

do $$
declare
  privileged_signature text;
begin
  if to_regprocedure(
    'public.claim_patient_custom_medicine_sync(uuid,text)'
  ) is null then
    raise exception 'patient medicine sync feature is missing';
  end if;

  foreach privileged_signature in array array[
    'public.patient_medicine_sync_secret_is_valid(text)',
    'public.resolve_patient_custom_medicine_hospital(uuid)',
    'public.claim_patient_custom_medicine_sync(uuid,text)',
    'public.complete_patient_custom_medicine_sync(uuid,text,text)',
    'public.fail_patient_custom_medicine_sync(uuid,text,text)',
    'public.request_patient_custom_medicine_sync(uuid)',
    'public.enqueue_patient_custom_medicine_sync()',
    'public.enqueue_pending_patient_medicine_syncs(integer)'
  ] loop
    if has_function_privilege('anon', privileged_signature, 'execute')
      or has_function_privilege(
        'authenticated',
        privileged_signature,
        'execute'
      ) then
      raise exception 'client roles can execute privileged function %',
        privileged_signature;
    end if;
  end loop;
end;
$$;

insert into auth.users(id)
values ('10000000-0000-0000-0000-000000000011')
on conflict (id) do nothing;

insert into public.patients(id, mobile, name)
values (
  '20000000-0000-0000-0000-000000000011',
  '+919900000011',
  'Medicine Sync Test'
)
on conflict (id) do nothing;

insert into public.hospitals(id, name)
values (
  '30000000-0000-0000-0000-000000000011',
  'Codex Medicine Sync Hospital 91c4'
);

insert into public.patient_custom_hospitals(
  id,
  patient_id,
  owner_user_id,
  name,
  normalized_name
)
values (
  '40000000-0000-0000-0000-000000000011',
  '20000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000011',
  'CODEX---Medicine Sync Hospital 91c4!!!',
  'codex medicine sync hospital 91c4'
);

insert into public.patient_custom_medicines(
  id,
  patient_id,
  owner_user_id,
  custom_hospital_id,
  name,
  normalized_name,
  image_path
)
values (
  '50000000-0000-0000-0000-000000000011',
  '20000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000011',
  '40000000-0000-0000-0000-000000000011',
  'Codex Sync Tablet 91c4',
  'codex sync tablet 91c4',
  '10000000-0000-0000-0000-000000000011/private.jpg'
);

do $$
declare
  claim jsonb;
  completed jsonb;
  webhook_secret text;
begin
  select decrypted_secret
  into strict webhook_secret
  from vault.decrypted_secrets
  where name = 'patient_medicine_sync_webhook_secret';

  claim := public.claim_patient_custom_medicine_sync(
    '50000000-0000-0000-0000-000000000011',
    webhook_secret
  );

  if claim ->> 'imagePath'
      <> '10000000-0000-0000-0000-000000000011/private.jpg'
    or claim ->> 'sharedImagePath'
      <> 'patient-submissions/50000000-0000-0000-0000-000000000011.jpg' then
    raise exception 'claim did not return the expected storage paths: %', claim;
  end if;

  completed := public.complete_patient_custom_medicine_sync(
    '50000000-0000-0000-0000-000000000011',
    'patient-submissions/50000000-0000-0000-0000-000000000011.jpg',
    webhook_secret
  );

  if completed ->> 'hospitalId'
      <> '30000000-0000-0000-0000-000000000011' then
    raise exception 'custom hospital did not resolve to the official hospital';
  end if;

  if not exists (
    select 1
    from public.medicines as medicine
    where medicine.id = (completed ->> 'medicineId')::uuid
      and medicine.name = 'Codex Sync Tablet 91c4'
      and medicine.hospital_id = '30000000-0000-0000-0000-000000000011'
      and medicine.image_url like '%/medicine-images/patient-submissions/50000000-0000-0000-0000-000000000011.jpg'
  ) then
    raise exception 'shared medicine was not created for the official hospital';
  end if;

  if not exists (
    select 1
    from public.tablet_submissions
    where hospital_id = '30000000-0000-0000-0000-000000000011'
      and medicine_id = (completed ->> 'medicineId')::uuid
      and image_url like '%/medicine-images/patient-submissions/50000000-0000-0000-0000-000000000011.jpg'
  ) then
    raise exception 'tablet submission was not linked to the official hospital';
  end if;

  if (
    select sync_status
    from public.patient_custom_medicines
    where id = '50000000-0000-0000-0000-000000000011'
  ) <> 'completed' then
    raise exception 'patient medicine was not marked completed';
  end if;

  if public.claim_patient_custom_medicine_sync(
    '50000000-0000-0000-0000-000000000011',
    webhook_secret
  ) is not null then
    raise exception 'completed patient medicine was claimable again';
  end if;
end;
$$;

rollback;
