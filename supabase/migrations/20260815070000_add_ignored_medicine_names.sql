-- Lets the team permanently mark a billed item name as "not a medicine"
-- (surgical gloves, registration fees, etc.) so it never gets flagged again
-- in triage, and the userscript popup can skip it too. Matching is on a
-- normalized (lowercased, trimmed) name, so small formatting differences in
-- how the same item gets billed still match.

create table public.ignored_hospital_medicine_names (
  name_normalized text primary key,
  original_name text not null,
  created_at timestamptz not null default now()
);

alter table public.ignored_hospital_medicine_names enable row level security;
-- No public grants — read/write only through the functions below.

create or replace function public.normalize_hospital_medicine_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

-- Called from Triage's "Not a medicine" button.
create or replace function public.ignore_hospital_medicine_name(
  p_request_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ignored_hospital_medicine_names (name_normalized, original_name)
  values (public.normalize_hospital_medicine_name(p_name), btrim(p_name))
  on conflict (name_normalized) do nothing;

  if p_request_id is not null then
    update public.unmatched_medicine_requests
    set resolved = true
    where id = p_request_id;
  end if;
end;
$$;

revoke all on function public.ignore_hospital_medicine_name(uuid, text) from public;
grant execute on function public.ignore_hospital_medicine_name(uuid, text) to anon;

-- The userscript popup calls this before rendering, so items your team has
-- already marked "not a medicine" don't show up to ask about at all.
create or replace function public.list_ignored_hospital_medicine_names()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(name_normalized), array[]::text[])
  from public.ignored_hospital_medicine_names;
$$;

revoke all on function public.list_ignored_hospital_medicine_names() from public;
grant execute on function public.list_ignored_hospital_medicine_names() to anon;

-- Skip logging a triage entry at all for names already marked "not a
-- medicine" or that obviously aren't one (registration fees, gloves, etc.).
-- A short, conservative built-in list — the exact-match ignore list above is
-- the real long-term mechanism, this just avoids day-one noise for the most
-- unambiguous cases.
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
  v_item_name text;
  v_normalized_name text;
  v_medicine_id uuid;
  v_medicine_name text;
  v_medicine_has_image boolean;
  v_course_id uuid;
  v_created jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_slot text;
  v_builtin_non_medicine_terms text[] := array[
    'registration fee', 'consultation fee', 'admission fee', 'room rent',
    'nursing charge', 'procedure charge', 'lab charge', 'surgical gloves',
    'hand gloves', 'cotton roll', 'bandage', 'gauze', 'syringe', 'needle',
    'iv set', 'cannula', 'apron', 'sanitizer'
  ];
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
    v_item_name := v_item->>'name';
    v_normalized_name := public.normalize_hospital_medicine_name(v_item_name);

    if exists (
      select 1 from public.ignored_hospital_medicine_names
      where name_normalized = v_normalized_name
    ) or exists (
      select 1 from unnest(v_builtin_non_medicine_terms) as term
      where v_normalized_name ilike '%' || term || '%'
    ) then
      continue;
    end if;

    select id, name, (image_url is not null and btrim(image_url) <> '')
      into v_medicine_id, v_medicine_name, v_medicine_has_image
    from public.medicines
    where lower(name) = lower(v_item_name)
    order by length(name) asc
    limit 1;

    if v_medicine_id is null then
      select id, name, (image_url is not null and btrim(image_url) <> '')
        into v_medicine_id, v_medicine_name, v_medicine_has_image
      from public.medicines
      where name ilike '%' || v_item_name || '%'
      order by length(name) asc
      limit 1;
    end if;

    if v_medicine_id is null then
      v_skipped := v_skipped || jsonb_build_object(
        'name', v_item_name,
        'reason', 'medicine_not_found'
      );
      insert into public.unmatched_medicine_requests
        (medicine_name, hospital_name, mobile, patient_id, reason,
         morning, afternoon, night, duration_days, start_date, day_pattern)
      values (
        v_item_name, p_hospital_name, v_mobile, v_patient_id, 'medicine_not_found',
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
        'name', v_item_name,
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
      'name', v_item_name
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
