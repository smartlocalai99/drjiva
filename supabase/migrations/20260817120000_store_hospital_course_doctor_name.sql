-- The MSCureChain popup already sends the doctor's name at billing time
-- (p_doctor_name), but create_hospital_medicine_course silently discarded
-- it — never stored anywhere. This adds a column to keep it and updates the
-- function to actually save it, so the app can show the real doctor's photo
-- against hospital-billed medicines instead of a generic placeholder.

alter table public.patient_medicine_courses
  add column if not exists doctor_name text;

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
  v_doctor_name text;
begin
  v_mobile := right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10);
  if length(v_mobile) <> 10 then
    raise exception 'Invalid mobile number: %', p_mobile;
  end if;

  if p_duration_days is null or p_duration_days < 1 or p_duration_days > 365 then
    raise exception 'Invalid duration_days: %', p_duration_days;
  end if;

  if p_day_pattern not in ('daily', 'alternate') then
    raise exception 'Invalid day_pattern: %', p_day_pattern;
  end if;

  if p_start_date is null then
    raise exception 'start_date is required';
  end if;

  v_doctor_name := nullif(btrim(coalesce(p_doctor_name, '')), '');

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
      status, schedule_mode, source, doctor_name
    ) values (
      v_patient_id, null, v_hospital_id, v_medicine_id,
      1, p_start_date, p_duration_days, p_day_pattern,
      'active', 'finite', 'hospital', v_doctor_name
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
