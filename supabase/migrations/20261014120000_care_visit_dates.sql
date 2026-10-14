-- My Care, part 3: a date the nurse sets for each visit / scan / test card
-- on the timeline. Additions only (one table, two functions) plus a new
-- body for care_nurse_patient_v2 (added in part 2, nothing else uses it).

create table public.care_plan_visit_dates (
  plan_id uuid not null references public.care_plans (id) on delete cascade,
  visit_id uuid not null references public.care_schedule_visits (id) on delete cascade,
  planned_date date not null,
  nurse_id uuid references public.care_nurses (id) on delete set null,
  nurse_name text not null,
  updated_at timestamptz not null default now(),
  primary key (plan_id, visit_id)
);

alter table public.care_plan_visit_dates enable row level security;
revoke all on table public.care_plan_visit_dates from public, anon, authenticated;

-- Dates set on the timeline, saved together with "Save visit".
-- p_visits: [{ "planId": uuid, "visitId": uuid, "date": "YYYY-MM-DD" | null }]  (null = remove)
-- p_extras: [{ "id": uuid, "date": "YYYY-MM-DD" }]                                (extra tests)
create or replace function public.care_nurse_set_dates(
  p_nurse_id uuid,
  p_patient_id uuid,
  p_visits jsonb,
  p_extras jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nurse public.care_nurses := public.care_require_nurse(p_nurse_id);
  v_today date := public.care_today();
  v_entry jsonb;
  v_date date;
  v_plan public.care_plans;
  v_count integer := 0;
begin
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, p_patient_id);
  if jsonb_typeof(coalesce(p_visits, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_extras, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_visits, '[]'::jsonb)) + jsonb_array_length(coalesce(p_extras, '[]'::jsonb)) > 100 then
    raise exception 'invalid_dates' using errcode = '22023';
  end if;

  for v_entry in select * from jsonb_array_elements(coalesce(p_visits, '[]'::jsonb)) loop
    select * into v_plan from public.care_plans p
    where p.id = (v_entry ->> 'planId')::uuid and p.patient_id = p_patient_id and p.status = 'active';
    if v_plan.id is null or not exists (
      select 1 from public.care_schedule_visits v
      where v.id = (v_entry ->> 'visitId')::uuid and v.plan_type = v_plan.plan_type
    ) then
      raise exception 'unknown_plan' using errcode = '22023';
    end if;
    v_date := nullif(v_entry ->> 'date', '')::date;
    if v_date is null then
      delete from public.care_plan_visit_dates d
      where d.plan_id = v_plan.id and d.visit_id = (v_entry ->> 'visitId')::uuid;
    else
      if v_date < v_today - 60 or v_date > v_today + 2000 then
        raise exception 'invalid_visit_date' using errcode = '22023';
      end if;
      insert into public.care_plan_visit_dates (plan_id, visit_id, planned_date, nurse_id, nurse_name)
      values (v_plan.id, (v_entry ->> 'visitId')::uuid, v_date, v_nurse.id, v_nurse.display_name)
      on conflict (plan_id, visit_id) do update
        set planned_date = excluded.planned_date, nurse_id = excluded.nurse_id,
            nurse_name = excluded.nurse_name, updated_at = now();
    end if;
    v_count := v_count + 1;
    v_plan := null;
  end loop;

  for v_entry in select * from jsonb_array_elements(coalesce(p_extras, '[]'::jsonb)) loop
    v_date := nullif(v_entry ->> 'date', '')::date;
    if v_date is null or v_date < v_today - 60 or v_date > v_today + 400 then
      raise exception 'invalid_test_date' using errcode = '22023';
    end if;
    update public.care_extra_items e
    set due_date = v_date, updated_at = now()
    where e.id = (v_entry ->> 'id')::uuid and e.patient_id = p_patient_id and e.hospital_id = v_nurse.hospital_id
      and (e.status is null or e.status <> 'done' or v_date <= v_today);
    if not found then
      raise exception 'unknown_item' using errcode = '22023';
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- The nurse's patient page: existing view + extra tests + timeline dates.
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
    || jsonb_build_object(
      'extraItems', public.care_extra_items_json(v_nurse.hospital_id, p_patient_id),
      'visitDates', coalesce((
        select jsonb_agg(jsonb_build_object(
          'planId', d.plan_id,
          'visitId', d.visit_id,
          'date', d.planned_date,
          'nurseName', d.nurse_name
        ))
        from public.care_plan_visit_dates d
        join public.care_plans p on p.id = d.plan_id
        where p.patient_id = p_patient_id and p.status = 'active'
      ), '[]'::jsonb)
    );
end;
$$;

revoke all on function public.care_nurse_set_dates(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.care_nurse_set_dates(uuid, uuid, jsonb, jsonb) to service_role;
