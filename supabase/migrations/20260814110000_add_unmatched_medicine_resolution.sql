-- Closes the loop on unmatched hospital medicines: adds the original
-- schedule (timing/duration/start date) to unmatched_medicine_requests so a
-- missed reminder can be recreated later, plus three RPCs a triage screen
-- (in Medico Kadapa / medisin_app) can call with the anon key, matching that
-- app's existing no-auth pattern:
--   - list_unmatched_medicine_requests(): pending items to review
--   - resolve_unmatched_medicine_request(): medicine now exists/has a photo
--     -> for the "wasn't in the catalog" case, creates the reminder that
--     was skipped, using the schedule captured at billing time
--   - dismiss_unmatched_medicine_request(): drop it without action

alter table public.unmatched_medicine_requests
  add column if not exists medicine_id uuid references public.medicines(id),
  add column if not exists morning boolean not null default false,
  add column if not exists afternoon boolean not null default false,
  add column if not exists night boolean not null default false,
  add column if not exists duration_days integer,
  add column if not exists start_date date,
  add column if not exists day_pattern text;

-- Log the original schedule alongside every skip, so it can be recreated.
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
  v_medicine_name text;
  v_medicine_has_image boolean;
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
    v_medicine_name := null;
    v_medicine_has_image := null;

    select id, name, (image_url is not null and btrim(image_url) <> '')
      into v_medicine_id, v_medicine_name, v_medicine_has_image
    from public.medicines
    where lower(name) = lower(v_item->>'name')
    order by length(name) asc
    limit 1;

    if v_medicine_id is null then
      select id, name, (image_url is not null and btrim(image_url) <> '')
        into v_medicine_id, v_medicine_name, v_medicine_has_image
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
      insert into public.unmatched_medicine_requests
        (medicine_name, hospital_name, mobile, patient_id, reason,
         morning, afternoon, night, duration_days, start_date, day_pattern)
      values (
        v_item->>'name', p_hospital_name, v_mobile, v_patient_id, 'medicine_not_found',
        coalesce((v_item->>'morning')::boolean, false),
        coalesce((v_item->>'afternoon')::boolean, false),
        coalesce((v_item->>'night')::boolean, false),
        p_duration_days, p_start_date, p_day_pattern
      );
      continue;
    end if;

    if not v_medicine_has_image then
      insert into public.unmatched_medicine_requests
        (medicine_name, hospital_name, mobile, patient_id, reason, medicine_id)
      values (v_medicine_name, p_hospital_name, v_mobile, v_patient_id, 'no_image', v_medicine_id);
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

create or replace function public.list_unmatched_medicine_requests()
returns table (
  id uuid,
  medicine_name text,
  hospital_name text,
  mobile text,
  reason text,
  medicine_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select id, medicine_name, hospital_name, mobile, reason, medicine_id, created_at
  from public.unmatched_medicine_requests
  where resolved = false
  order by created_at asc;
$$;

revoke all on function public.list_unmatched_medicine_requests() from public;
grant execute on function public.list_unmatched_medicine_requests() to anon;

create or replace function public.resolve_unmatched_medicine_request(
  p_request_id uuid,
  p_medicine_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.unmatched_medicine_requests%rowtype;
  v_hospital_id uuid;
  v_course_id uuid;
begin
  select * into v_request
  from public.unmatched_medicine_requests
  where id = p_request_id and resolved = false;

  if v_request.id is null then
    raise exception 'Request not found or already resolved: %', p_request_id;
  end if;

  if v_request.reason = 'medicine_not_found' then
    select id into v_hospital_id
    from public.hospitals
    where lower(name) = lower(v_request.hospital_name)
    limit 1;

    if v_hospital_id is null then
      select id into v_hospital_id
      from public.hospitals
      where name ilike '%' || v_request.hospital_name || '%'
      order by length(name) asc
      limit 1;
    end if;

    if v_hospital_id is not null and v_request.patient_id is not null then
      insert into public.patient_medicine_courses (
        patient_id, owner_user_id, hospital_id, medicine_id,
        tablets_per_dose, start_date, duration_days, day_pattern,
        status, schedule_mode, source
      ) values (
        v_request.patient_id, null, v_hospital_id, p_medicine_id,
        1, coalesce(v_request.start_date, current_date),
        coalesce(v_request.duration_days, 5),
        coalesce(v_request.day_pattern, 'daily'),
        'active', 'finite', 'hospital'
      )
      returning id into v_course_id;

      if v_request.morning then
        insert into public.patient_medicine_course_slots (course_id, owner_user_id, slot)
        values (v_course_id, null, 'morning');
      end if;
      if v_request.afternoon then
        insert into public.patient_medicine_course_slots (course_id, owner_user_id, slot)
        values (v_course_id, null, 'afternoon');
      end if;
      if v_request.night then
        insert into public.patient_medicine_course_slots (course_id, owner_user_id, slot)
        values (v_course_id, null, 'night');
      end if;
    end if;
  end if;

  update public.unmatched_medicine_requests
  set resolved = true
  where id = p_request_id;

  return v_course_id;
end;
$$;

revoke all on function public.resolve_unmatched_medicine_request(uuid, uuid) from public;
grant execute on function public.resolve_unmatched_medicine_request(uuid, uuid) to anon;

create or replace function public.dismiss_unmatched_medicine_request(p_request_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.unmatched_medicine_requests
  set resolved = true
  where id = p_request_id;
$$;

revoke all on function public.dismiss_unmatched_medicine_request(uuid) from public;
grant execute on function public.dismiss_unmatched_medicine_request(uuid) to anon;
