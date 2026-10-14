-- My Care, part 2: the nurse's patient list and extra tests from the case sheet.
-- Additions only: one table, two indexes, new functions. Nothing existing is
-- changed, renamed or dropped.
--
-- Load: the patient list is read once per nurse session (and cached for two
-- minutes on the Doctor Studio server), and search suggestions are made in
-- the browser from that list, so typing never hits the database.

-- ---------------------------------------------------------------------
-- 1. Indexes for the patient list
-- ---------------------------------------------------------------------

-- A hospital's billed patients, newest bill first (index-only scan).
create index if not exists care_pmc_hospital_patients_idx
  on public.patient_medicine_courses (hospital_id, patient_id, created_at desc)
  where source = 'hospital';

create index if not exists care_followups_hospital_idx
  on public.care_followups (hospital_id, patient_id, created_at desc);

-- ---------------------------------------------------------------------
-- 2. Patient list for the nurse's hospital, most recently seen first
--    (billed here, linked by a nurse, or given a follow-up here).
-- ---------------------------------------------------------------------

create or replace function public.care_nurse_directory(p_nurse_id uuid, p_limit integer default 3000)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nurse public.care_nurses := public.care_require_nurse(p_nurse_id);
  v_limit integer := greatest(1, least(coalesce(p_limit, 3000), 5000));
begin
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'mobile', p.mobile,
        'hospitalPatientId', hp.hospital_patient_id,
        'lastSeen', s.last_seen
      )
      order by s.last_seen desc nulls last, p.name
    )
    from (
      select x.patient_id, max(x.seen) as last_seen
      from (
        select hp0.patient_id, hp0.updated_at as seen
        from public.care_hospital_patients hp0
        where hp0.hospital_id = v_nurse.hospital_id
        union all
        select c.patient_id, max(c.created_at)
        from public.patient_medicine_courses c
        where c.hospital_id = v_nurse.hospital_id and c.source = 'hospital'
        group by c.patient_id
        union all
        select f.patient_id, max(f.created_at)
        from public.care_followups f
        where f.hospital_id = v_nurse.hospital_id
        group by f.patient_id
      ) x
      group by x.patient_id
      order by max(x.seen) desc nulls last
      limit v_limit
    ) s
    join public.patients p on p.id = s.patient_id
    left join public.care_hospital_patients hp
      on hp.hospital_id = v_nurse.hospital_id and hp.patient_id = s.patient_id
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Extra tests and scans the doctor wrote on the case sheet
-- ---------------------------------------------------------------------

create table public.care_extra_items (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete cascade,
  plan_id uuid references public.care_plans (id) on delete set null,
  label text not null check (char_length(btrim(label)) between 2 and 80),
  due_date date not null,
  status text check (status in ('done', 'not_needed')),
  done_on date,
  status_by_nurse_id uuid references public.care_nurses (id) on delete set null,
  status_by_nurse_name text,
  added_by_nurse_id uuid references public.care_nurses (id) on delete set null,
  added_by_nurse_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'done') = (done_on is not null))
);

create index care_extra_items_patient_idx
  on public.care_extra_items (patient_id, hospital_id, due_date);

alter table public.care_extra_items enable row level security;
revoke all on table public.care_extra_items from public, anon, authenticated;

create or replace function public.care_extra_items_json(p_hospital_id uuid, p_patient_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'planId', e.plan_id,
      'label', e.label,
      'dueDate', e.due_date,
      'status', e.status,
      'doneOn', e.done_on,
      'statusBy', e.status_by_nurse_name,
      'addedBy', e.added_by_nurse_name,
      'createdAt', e.created_at
    )
    order by e.due_date desc, e.created_at desc
  ), '[]'::jsonb)
  from (
    select * from public.care_extra_items x
    where x.patient_id = p_patient_id and x.hospital_id = p_hospital_id
    order by x.due_date desc, x.created_at desc
    limit 100
  ) e;
$$;

-- The nurse's patient page: the existing view plus the extra tests.
create or replace function public.care_nurse_patient_v2(p_nurse_id uuid, p_patient_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nurse public.care_nurses := public.care_require_nurse(p_nurse_id);
begin
  return public.care_nurse_patient(p_nurse_id, p_patient_id)
    || jsonb_build_object('extraItems', public.care_extra_items_json(v_nurse.hospital_id, p_patient_id));
end;
$$;

create or replace function public.care_nurse_add_extra_item(
  p_nurse_id uuid,
  p_patient_id uuid,
  p_label text,
  p_due_date date,
  p_done boolean default false,
  p_plan_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nurse public.care_nurses := public.care_require_nurse(p_nurse_id);
  v_today date := public.care_today();
  v_label text := btrim(regexp_replace(coalesce(p_label, ''), '\s+', ' ', 'g'));
  v_plan_id uuid;
begin
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, p_patient_id);
  if char_length(v_label) < 2 or char_length(v_label) > 80 then
    raise exception 'invalid_test_name' using errcode = '22023';
  end if;
  if p_due_date is null or p_due_date < v_today - 60 or p_due_date > v_today + 400 then
    raise exception 'invalid_test_date' using errcode = '22023';
  end if;
  if coalesce(p_done, false) and p_due_date > v_today then
    raise exception 'invalid_test_date' using errcode = '22023';
  end if;
  if p_plan_id is not null then
    select p.id into v_plan_id
    from public.care_plans p
    where p.id = p_plan_id and p.patient_id = p_patient_id and p.status = 'active';
    if v_plan_id is null then
      raise exception 'unknown_plan' using errcode = '22023';
    end if;
  end if;

  insert into public.care_extra_items
    (hospital_id, patient_id, plan_id, label, due_date, status, done_on,
     status_by_nurse_id, status_by_nurse_name, added_by_nurse_id, added_by_nurse_name)
  values
    (v_nurse.hospital_id, p_patient_id, v_plan_id, v_label, p_due_date,
     case when coalesce(p_done, false) then 'done' end,
     case when coalesce(p_done, false) then v_today end,
     case when coalesce(p_done, false) then v_nurse.id end,
     case when coalesce(p_done, false) then v_nurse.display_name end,
     v_nurse.id, v_nurse.display_name);

  perform public.care_link_hospital_patient(v_nurse.hospital_id, p_patient_id, v_nurse.id);
  return public.care_nurse_patient_v2(p_nurse_id, p_patient_id);
end;
$$;

-- Ticks on extra tests, saved together with "Save visit".
-- p_items: [{ "id": uuid, "status": "done" | "not_needed" | "clear" }]
create or replace function public.care_nurse_set_extra_items(p_nurse_id uuid, p_patient_id uuid, p_items jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nurse public.care_nurses := public.care_require_nurse(p_nurse_id);
  v_today date := public.care_today();
  v_item jsonb;
  v_status text;
  v_count integer := 0;
begin
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, p_patient_id);
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_status := v_item ->> 'status';
    if v_status not in ('done', 'not_needed', 'clear') then
      raise exception 'invalid_item_status' using errcode = '22023';
    end if;
    update public.care_extra_items e
    set status = nullif(v_status, 'clear'),
        done_on = case when v_status = 'done' then coalesce(e.done_on, v_today) end,
        status_by_nurse_id = case when v_status = 'clear' then null else v_nurse.id end,
        status_by_nurse_name = case when v_status = 'clear' then null else v_nurse.display_name end,
        updated_at = now()
    where e.id = (v_item ->> 'id')::uuid
      and e.patient_id = p_patient_id
      and e.hospital_id = v_nurse.hospital_id;
    if not found then
      raise exception 'unknown_item' using errcode = '22023';
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Remove a test added by mistake (only while it is not ticked).
create or replace function public.care_nurse_remove_extra_item(p_nurse_id uuid, p_item_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nurse public.care_nurses := public.care_require_nurse(p_nurse_id);
  v_patient_id uuid;
begin
  delete from public.care_extra_items e
  where e.id = p_item_id and e.hospital_id = v_nurse.hospital_id and e.status is null
  returning e.patient_id into v_patient_id;
  if v_patient_id is null then
    raise exception 'unknown_item' using errcode = '22023';
  end if;
  return public.care_nurse_patient_v2(p_nurse_id, v_patient_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Patient app: My Care plus extra tests still to do
-- ---------------------------------------------------------------------

create or replace function public.care_get_my_care_v2(p_mobile text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb := public.care_get_my_care(p_mobile);
  v_patient_id uuid;
begin
  if not coalesce((v_base ->> 'linked')::boolean, false) then
    return v_base;
  end if;

  select p.id into v_patient_id
  from public.patients p
  join public.patient_device_links dl
    on dl.patient_id = p.id and dl.owner_user_id = auth.uid()
  where p.mobile = public.care_e164(p_mobile);

  return v_base || jsonb_build_object('extraItems', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id,
      'hospitalId', e.hospital_id,
      'label', e.label,
      'dueDate', e.due_date
    ) order by e.due_date, e.created_at)
    from public.care_extra_items e
    where e.patient_id = v_patient_id
      and e.status is null
      and e.due_date >= public.care_today()
  ), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Who may call what
-- ---------------------------------------------------------------------

revoke all on function public.care_get_my_care_v2(text) from public, anon;
grant execute on function public.care_get_my_care_v2(text) to authenticated;

revoke all on function public.care_extra_items_json(uuid, uuid) from public, anon, authenticated;

revoke all on function public.care_nurse_directory(uuid, integer) from public, anon, authenticated;
revoke all on function public.care_nurse_patient_v2(uuid, uuid) from public, anon, authenticated;
revoke all on function public.care_nurse_add_extra_item(uuid, uuid, text, date, boolean, uuid) from public, anon, authenticated;
revoke all on function public.care_nurse_set_extra_items(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.care_nurse_remove_extra_item(uuid, uuid) from public, anon, authenticated;
grant execute on function public.care_nurse_directory(uuid, integer) to service_role;
grant execute on function public.care_nurse_patient_v2(uuid, uuid) to service_role;
grant execute on function public.care_nurse_add_extra_item(uuid, uuid, text, date, boolean, uuid) to service_role;
grant execute on function public.care_nurse_set_extra_items(uuid, uuid, jsonb) to service_role;
grant execute on function public.care_nurse_remove_extra_item(uuid, uuid) to service_role;
