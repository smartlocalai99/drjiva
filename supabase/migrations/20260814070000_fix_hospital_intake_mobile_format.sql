-- Bug fix: create_hospital_medicine_course, claim_hospital_medicine_courses,
-- and link_patient_device were normalizing mobile numbers to a bare 10-digit
-- string, but every other patient lookup in the app (getPatientByPhone,
-- checkPatientExists, via toIndianE164) stores/queries patients.mobile as
-- "+91XXXXXXXXXX". This meant hospital-created patients were never found by
-- the app's own Reminders/Home screens even though the underlying course,
-- slot, dose-event, and device-link rows were all correct. Switching these
-- three functions to the same +91-prefixed format fixes lookups for all new
-- hospital intake going forward; a follow-up statement repairs the two
-- existing test rows.

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

create or replace function public.claim_hospital_medicine_courses(p_mobile text)
returns table (
  course_id uuid,
  patient_id uuid,
  hospital_id uuid,
  medicine_id uuid,
  tablets_per_dose numeric,
  start_date date,
  duration_days integer,
  day_pattern text,
  slots text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_mobile text;
  v_patient_id uuid;
begin
  if v_owner is null then
    raise exception 'Not authenticated';
  end if;

  v_mobile := right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10);
  if length(v_mobile) <> 10 then
    return;
  end if;
  v_mobile := '+91' || v_mobile;

  select id into v_patient_id
  from public.patients
  where mobile = v_mobile;

  if v_patient_id is null then
    return;
  end if;

  update public.patient_medicine_courses
    set owner_user_id = v_owner, updated_at = now()
    where patient_medicine_courses.patient_id = v_patient_id
      and owner_user_id is null;

  update public.patient_medicine_course_slots s
    set owner_user_id = v_owner
    from public.patient_medicine_courses c
    where s.course_id = c.id
      and c.patient_id = v_patient_id
      and c.owner_user_id = v_owner
      and s.owner_user_id is null;

  return query
  select
    c.id,
    c.patient_id,
    c.hospital_id,
    c.medicine_id,
    c.tablets_per_dose,
    c.start_date,
    c.duration_days,
    c.day_pattern,
    array_agg(s.slot order by s.slot)
  from public.patient_medicine_courses c
  join public.patient_medicine_course_slots s on s.course_id = c.id
  where c.patient_id = v_patient_id
    and c.owner_user_id = v_owner
    and c.source = 'hospital'
    and c.status = 'active'
    and not exists (
      select 1 from public.patient_medicine_dose_events e where e.course_id = c.id
    )
  group by c.id;
end;
$$;

create or replace function public.link_patient_device(p_mobile text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_mobile text;
  v_patient_id uuid;
begin
  if v_owner is null then
    raise exception 'Not authenticated';
  end if;

  v_mobile := right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10);
  if length(v_mobile) <> 10 then
    return;
  end if;
  v_mobile := '+91' || v_mobile;

  select id into v_patient_id
  from public.patients
  where mobile = v_mobile;

  if v_patient_id is null then
    return;
  end if;

  insert into public.patient_device_links (patient_id, owner_user_id)
  values (v_patient_id, v_owner)
  on conflict (patient_id, owner_user_id) do nothing;
end;
$$;
