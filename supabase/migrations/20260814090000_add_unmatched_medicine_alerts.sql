-- Tracks hospital-billed medicine names that didn't match anything in the
-- catalog (create_hospital_medicine_course's "medicine_not_found" skip
-- reason). Rather than emailing on every single occurrence, a daily pg_cron
-- job collects everything unsent since the last run and emails
-- medicokadapa@gmail.com one consolidated list, then marks those rows sent.
-- Mirrors the existing order-notification webhook pattern: a Vault secret
-- authenticates the pg_net -> Edge Function call.

create extension if not exists pg_cron with schema extensions;

create table public.unmatched_medicine_requests (
  id uuid primary key default gen_random_uuid(),
  medicine_name text not null,
  hospital_name text,
  mobile text,
  patient_id uuid references public.patients(id) on delete set null,
  resolved boolean not null default false,
  notification_sent_at timestamptz,
  notification_error text,
  created_at timestamptz not null default now()
);

alter table public.unmatched_medicine_requests enable row level security;
-- No grants to anon/authenticated — only security-definer functions and the
-- digest Edge Function (via service_role) touch this table.

do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'unmatched_medicine_webhook_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'unmatched_medicine_webhook_secret',
      'Authenticates unmatched-medicine-digest database webhooks'
    );
  end if;
end;
$$;

create or replace function public.unmatched_medicine_webhook_secret_is_valid(
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
      where decrypted.name = 'unmatched_medicine_webhook_secret'
      limit 1
    ),
    false
  );
$$;

revoke all on function public.unmatched_medicine_webhook_secret_is_valid(text) from public;

-- Called by the digest Edge Function (service_role) after it sends the
-- email, so it never needs direct table grants — just the shared secret.
create or replace function public.complete_unmatched_medicine_digest(
  p_request_ids uuid[],
  p_webhook_secret text,
  p_error text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.unmatched_medicine_webhook_secret_is_valid(p_webhook_secret) then
    raise exception using errcode = '42501', message = 'Invalid unmatched-medicine webhook secret.';
  end if;

  update public.unmatched_medicine_requests
  set notification_sent_at = case when p_error is null then now() else notification_sent_at end,
      notification_error = nullif(left(coalesce(p_error, ''), 500), '')
  where id = any(p_request_ids);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.complete_unmatched_medicine_digest(uuid[], text, text) from public;

-- Fired on a schedule (not per-row) — see cron.schedule below.
create or replace function public.enqueue_unmatched_medicine_digest()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_webhook_secret text;
  v_pending_count integer;
begin
  select count(*) into v_pending_count
  from public.unmatched_medicine_requests
  where notification_sent_at is null;

  if v_pending_count = 0 then
    return;
  end if;

  select decrypted.decrypted_secret
  into v_webhook_secret
  from vault.decrypted_secrets as decrypted
  where decrypted.name = 'unmatched_medicine_webhook_secret'
  limit 1;

  perform net.http_post(
    url := 'https://jlvjnnltynebenflkcua.supabase.co/functions/v1/notify-unmatched-medicine-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-unmatched-medicine-webhook-secret', v_webhook_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

select cron.schedule(
  'unmatched-medicine-digest',
  '30 17 * * *', -- 23:00 IST daily (end of day)
  $$select public.enqueue_unmatched_medicine_digest();$$
);

-- Log every "medicine_not_found" skip from the hospital-intake flow.
create or replace function public.create_hospital_medicine_course(
  p_mobile text,
  p_patient_name text,
  p_hospital_name text,
  p_doctor_name text,
  p_items jsonb,
  p_start_date date,
  p_duration_days integer,
  p_day_pattern text default 'daily'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mobile text;
  v_patient_id uuid;
  v_hospital_id uuid;
  v_item jsonb;
  v_medicine_id uuid;
  v_course_id uuid;
  v_created jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_slot text;
begin
  v_mobile := right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10);
  if length(v_mobile) <> 10 then
    raise exception 'Invalid mobile number: %', p_mobile;
  end if;
  v_mobile := '+91' || v_mobile;

  if p_duration_days is null or p_duration_days < 1 or p_duration_days > 365 then
    raise exception 'Invalid duration_days: %', p_duration_days;
  end if;

  if p_day_pattern not in ('daily', 'alternate') then
    raise exception 'Invalid day_pattern: %', p_day_pattern;
  end if;

  if p_start_date is null then
    raise exception 'start_date is required';
  end if;

  select id into v_hospital_id
  from public.hospitals
  where lower(name) = lower(p_hospital_name)
  limit 1;

  if v_hospital_id is null then
    select id into v_hospital_id
    from public.hospitals
    where name ilike '%' || p_hospital_name || '%'
    order by length(name) asc
    limit 1;
  end if;

  if v_hospital_id is null then
    raise exception 'Hospital not found: %', p_hospital_name;
  end if;

  insert into public.patients (mobile, name)
  values (v_mobile, nullif(btrim(coalesce(p_patient_name, '')), ''))
  on conflict (mobile) do update
    set name = coalesce(
      nullif(btrim(public.patients.name), ''),
      excluded.name
    )
  returning id into v_patient_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_medicine_id := null;

    select id into v_medicine_id
    from public.medicines
    where lower(name) = lower(v_item->>'name')
    order by length(name) asc
    limit 1;

    if v_medicine_id is null then
      select id into v_medicine_id
      from public.medicines
      where name ilike '%' || (v_item->>'name') || '%'
      order by length(name) asc
      limit 1;
    end if;

    if v_medicine_id is null then
      v_skipped := v_skipped || jsonb_build_object(
        'name', v_item->>'name',
        'reason', 'medicine_not_found'
      );
      insert into public.unmatched_medicine_requests (medicine_name, hospital_name, mobile, patient_id)
      values (v_item->>'name', p_hospital_name, v_mobile, v_patient_id);
      continue;
    end if;

    if coalesce((v_item->>'morning')::boolean, false) is false
      and coalesce((v_item->>'afternoon')::boolean, false) is false
      and coalesce((v_item->>'night')::boolean, false) is false
    then
      v_skipped := v_skipped || jsonb_build_object(
        'name', v_item->>'name',
        'reason', 'no_timing_selected'
      );
      continue;
    end if;

    insert into public.patient_medicine_courses (
      patient_id, owner_user_id, hospital_id, medicine_id,
      tablets_per_dose, start_date, duration_days, day_pattern,
      status, schedule_mode, source
    ) values (
      v_patient_id, null, v_hospital_id, v_medicine_id,
      1, p_start_date, p_duration_days, p_day_pattern,
      'active', 'finite', 'hospital'
    )
    returning id into v_course_id;

    foreach v_slot in array array['morning', 'afternoon', 'night']
    loop
      if coalesce((v_item->>v_slot)::boolean, false) then
        insert into public.patient_medicine_course_slots (course_id, owner_user_id, slot)
        values (v_course_id, null, v_slot);
      end if;
    end loop;

    v_created := v_created || jsonb_build_object(
      'course_id', v_course_id,
      'name', v_item->>'name'
    );
  end loop;

  return jsonb_build_object(
    'patient_id', v_patient_id,
    'mobile', v_mobile,
    'created', v_created,
    'skipped', v_skipped
  );
end;
$$;
