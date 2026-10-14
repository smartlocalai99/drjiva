-- My Care, part 5: day-based fertility cycles (OI-TI / IUI) and a doctor on
-- every row of the nurse's patient list. Additions only: four tables, new
-- functions, and new bodies for three part-2/3 functions nothing else uses
-- (care_nurse_directory, care_nurse_patient_v2, care_get_my_care_v2).
--
-- OI-TI / IUI (given by the hospital, 2026-10-14):
--   Day 1 = first day of the woman's period. Step date = Day 1 + (day - 1).
--   IUI / timed intercourse is always the trigger date + 1 day.

-- ---------------------------------------------------------------------
-- 1. Protocols and their steps
-- ---------------------------------------------------------------------

create table public.care_cycle_protocols (
  code text primary key,
  title_en text not null,
  title_te text not null,
  length_days integer not null check (length_days between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.care_cycle_protocol_steps (
  id uuid primary key default gen_random_uuid(),
  protocol_code text not null references public.care_cycle_protocols (code) on delete cascade,
  code text not null unique,
  day integer not null check (day >= 1),
  label_en text not null,
  label_te text not null,
  who text not null check (who in ('wife', 'husband', 'couple')),
  note_en text,
  note_te text,
  linked_step_code text references public.care_cycle_protocol_steps (code),
  linked_offset_days integer,
  sort_order integer not null,
  is_active boolean not null default true,
  check ((linked_step_code is null) = (linked_offset_days is null))
);

create index care_cycle_protocol_steps_protocol_idx on public.care_cycle_protocol_steps (protocol_code, sort_order);

insert into public.care_cycle_protocols (code, title_en, title_te, length_days)
values ('oi_ti_iui', 'OI-TI / IUI', 'OI-TI / IUI', 31);

insert into public.care_cycle_protocol_steps
  (protocol_code, code, day, label_en, label_te, who, note_en, note_te, linked_step_code, linked_offset_days, sort_order)
values
  ('oi_ti_iui', 'oi_baseline_scan', 2, 'Baseline scan', 'బేస్‌లైన్ స్కాన్', 'wife', null, null, null, null, 10),
  ('oi_ti_iui', 'oi_blood_test', 2, 'Blood test', 'రక్త పరీక్ష', 'wife', null, null, null, null, 20),
  ('oi_ti_iui', 'oi_semen_analysis', 2, 'Semen analysis', 'వీర్య పరీక్ష', 'husband',
     'Avoid intercourse 3–5 days before the test', 'పరీక్షకు 3–5 రోజుల ముందు కలయిక వద్దు', null, null, 30),
  ('oi_ti_iui', 'oi_injection_d5', 5, 'Injection', 'ఇంజెక్షన్', 'wife', null, null, null, null, 40),
  ('oi_ti_iui', 'oi_injection_d7', 7, 'Injection', 'ఇంజెక్షన్', 'wife', null, null, null, null, 50),
  ('oi_ti_iui', 'oi_hsg', 7, 'HSG – tube test', 'HSG – ట్యూబ్ పరీక్ష', 'wife', null, null, null, null, 60),
  ('oi_ti_iui', 'oi_follicle_d9', 9, 'Follicle scan', 'ఫాలికల్ స్కాన్', 'wife', null, null, null, null, 70),
  ('oi_ti_iui', 'oi_follicle_d11', 11, 'Follicle scan', 'ఫాలికల్ స్కాన్', 'wife', null, null, null, null, 80),
  ('oi_ti_iui', 'oi_trigger', 13, 'Trigger injection', 'ట్రిగ్గర్ ఇంజెక్షన్', 'wife', null, null, null, null, 90),
  ('oi_ti_iui', 'oi_urine_pregnancy_test', 31, 'Urine pregnancy test', 'మూత్ర గర్భ పరీక్ష', 'wife', null, null, null, null, 110);

insert into public.care_cycle_protocol_steps
  (protocol_code, code, day, label_en, label_te, who, linked_step_code, linked_offset_days, sort_order)
values
  ('oi_ti_iui', 'oi_iui', 14, 'IUI / Timed intercourse', 'IUI / నిర్ణీత సమయంలో కలయిక', 'couple', 'oi_trigger', 1, 100);

-- ---------------------------------------------------------------------
-- 2. A patient's cycles and what the nurse recorded
-- ---------------------------------------------------------------------

create table public.care_cycles (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  hospital_id uuid not null references public.hospitals (id) on delete restrict,
  protocol_code text not null references public.care_cycle_protocols (code),
  person_name text not null check (char_length(btrim(person_name)) between 2 and 80),
  partner_name text check (partner_name is null or char_length(btrim(partner_name)) between 2 and 80),
  anchor_date date not null,
  care_doctor_id uuid references public.care_doctors (id) on delete set null,
  doctor_name text,
  status text not null default 'active' check (status in ('active', 'positive', 'negative', 'stopped')),
  closed_on date,
  started_by_nurse_id uuid references public.care_nurses (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'active' or closed_on is not null)
);

create unique index care_cycles_one_active on public.care_cycles (patient_id) where status = 'active';
create index care_cycles_hospital_idx on public.care_cycles (hospital_id, patient_id, created_at desc);

create table public.care_cycle_step_records (
  cycle_id uuid not null references public.care_cycles (id) on delete cascade,
  step_id uuid not null references public.care_cycle_protocol_steps (id) on delete cascade,
  planned_date date,
  status text check (status in ('done', 'not_needed')),
  done_on date,
  nurse_id uuid references public.care_nurses (id) on delete set null,
  nurse_name text,
  updated_at timestamptz not null default now(),
  primary key (cycle_id, step_id),
  check ((status = 'done') = (done_on is not null))
);

alter table public.care_cycle_protocols enable row level security;
alter table public.care_cycle_protocol_steps enable row level security;
alter table public.care_cycles enable row level security;
alter table public.care_cycle_step_records enable row level security;
revoke all on table public.care_cycle_protocols, public.care_cycle_protocol_steps, public.care_cycles, public.care_cycle_step_records
  from public, anon, authenticated;

-- One cycle with every step and its date. A step's date is what the nurse
-- set, else the linked step's date + offset (IUI = trigger + 1), else
-- Day 1 + (day - 1).
create or replace function public.care_cycle_view(p_cycle_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cy as (
    select c.*, h.name as hospital_name, pr.title_en, pr.title_te, pr.length_days, sn.display_name as started_by_name
    from public.care_cycles c
    join public.hospitals h on h.id = c.hospital_id
    join public.care_cycle_protocols pr on pr.code = c.protocol_code
    left join public.care_nurses sn on sn.id = c.started_by_nurse_id
    where c.id = p_cycle_id
  ),
  base as (
    select s.*, r.planned_date, r.status, r.done_on, r.nurse_name, (cy.anchor_date + s.day - 1) as base_date
    from cy
    join public.care_cycle_protocol_steps s on s.protocol_code = cy.protocol_code and s.is_active
    left join public.care_cycle_step_records r on r.cycle_id = cy.id and r.step_id = s.id
  ),
  steps as (
    select b.*,
      coalesce(
        b.planned_date,
        (select coalesce(l.planned_date, l.base_date) + b.linked_offset_days from base l where l.code = b.linked_step_code),
        b.base_date
      ) as eff_date,
      (select l.id from base l where l.code = b.linked_step_code) as linked_step_id
    from base b
  )
  select jsonb_build_object(
    'id', cy.id,
    'kind', 'cycle',
    'protocol', cy.protocol_code,
    'titleEn', cy.title_en,
    'titleTe', cy.title_te,
    'lengthDays', cy.length_days,
    'personName', cy.person_name,
    'partnerName', cy.partner_name,
    'anchorDate', cy.anchor_date,
    'status', cy.status,
    'hospitalId', cy.hospital_id,
    'hospitalName', cy.hospital_name,
    'doctorName', cy.doctor_name,
    'startedByNurse', cy.started_by_name,
    'createdAt', cy.created_at,
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'code', s.code,
        'day', s.day,
        'labelEn', s.label_en,
        'labelTe', s.label_te,
        'who', s.who,
        'noteEn', s.note_en,
        'noteTe', s.note_te,
        'baseDate', s.base_date,
        'date', s.eff_date,
        'planned', s.planned_date is not null,
        'linkedStepId', s.linked_step_id,
        'linkedOffsetDays', s.linked_offset_days,
        'status', s.status,
        'doneOn', s.done_on,
        'nurseName', s.nurse_name
      ) order by s.eff_date, s.sort_order)
      from steps s
    ), '[]'::jsonb)
  )
  from cy;
$$;

-- ---------------------------------------------------------------------
-- 3. Nurse actions (Doctor Studio server only)
-- ---------------------------------------------------------------------

create or replace function public.care_nurse_start_cycle(
  p_nurse_id uuid,
  p_patient_id uuid,
  p_protocol text,
  p_person_name text,
  p_partner_name text,
  p_anchor date,
  p_care_doctor_id uuid default null,
  p_doctor_name text default null
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
  v_name text := btrim(coalesce(p_person_name, ''));
  v_partner text := nullif(btrim(coalesce(p_partner_name, '')), '');
  v_doctor_id uuid;
  v_doctor_name text;
  v_department text;
begin
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, p_patient_id);
  if not exists (select 1 from public.care_cycle_protocols where code = p_protocol and is_active) then
    raise exception 'unknown_protocol' using errcode = '22023';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 or (v_partner is not null and char_length(v_partner) not between 2 and 80) then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_anchor is null or p_anchor < v_today - 60 or p_anchor > v_today + 30 then
    raise exception 'invalid_cycle_date' using errcode = '22023';
  end if;
  if exists (select 1 from public.care_cycles where patient_id = p_patient_id and status = 'active') then
    raise exception 'cycle_exists' using errcode = '23505';
  end if;
  select r.care_doctor_id, r.doctor_name, r.department
  into v_doctor_id, v_doctor_name, v_department
  from public.care_nurse_resolve_doctor(v_nurse.hospital_id, p_care_doctor_id, p_doctor_name) r;

  insert into public.care_cycles
    (patient_id, hospital_id, protocol_code, person_name, partner_name, anchor_date, care_doctor_id, doctor_name, started_by_nurse_id)
  values
    (p_patient_id, v_nurse.hospital_id, p_protocol, v_name, v_partner, p_anchor, v_doctor_id, v_doctor_name, v_nurse.id);
  perform public.care_link_hospital_patient(v_nurse.hospital_id, p_patient_id, v_nurse.id);
  return public.care_nurse_patient_v2(p_nurse_id, p_patient_id);
end;
$$;

-- Correct Day 1 or the names (e.g. the period started a day later).
create or replace function public.care_nurse_update_cycle(
  p_nurse_id uuid,
  p_cycle_id uuid,
  p_anchor date,
  p_person_name text default null,
  p_partner_name text default null
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
  v_cycle public.care_cycles;
  v_partner text := nullif(btrim(coalesce(p_partner_name, '')), '');
begin
  select * into v_cycle from public.care_cycles where id = p_cycle_id and status = 'active';
  if v_cycle.id is null then
    raise exception 'unknown_plan' using errcode = '22023';
  end if;
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, v_cycle.patient_id);
  if p_anchor is null or p_anchor < v_today - 60 or p_anchor > v_today + 30 then
    raise exception 'invalid_cycle_date' using errcode = '22023';
  end if;
  if p_person_name is not null and char_length(btrim(p_person_name)) not between 2 and 80 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  update public.care_cycles
  set anchor_date = p_anchor,
      person_name = coalesce(nullif(btrim(p_person_name), ''), person_name),
      partner_name = case when p_partner_name is null then partner_name else v_partner end,
      updated_at = now()
  where id = p_cycle_id;
  return public.care_nurse_patient_v2(p_nurse_id, v_cycle.patient_id);
end;
$$;

create or replace function public.care_nurse_close_cycle(p_nurse_id uuid, p_cycle_id uuid, p_outcome text, p_date date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nurse public.care_nurses := public.care_require_nurse(p_nurse_id);
  v_today date := public.care_today();
  v_cycle public.care_cycles;
begin
  select * into v_cycle from public.care_cycles where id = p_cycle_id and status = 'active';
  if v_cycle.id is null then
    raise exception 'unknown_plan' using errcode = '22023';
  end if;
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, v_cycle.patient_id);
  if p_outcome not in ('positive', 'negative', 'stopped') then
    raise exception 'invalid_outcome' using errcode = '22023';
  end if;
  if p_date is null or p_date > v_today or p_date < v_today - 365 then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  update public.care_cycles set status = p_outcome, closed_on = p_date, updated_at = now() where id = p_cycle_id;
  return public.care_nurse_patient_v2(p_nurse_id, v_cycle.patient_id);
end;
$$;

-- Ticks and dates on cycle steps, saved with "Save visit".
-- p_items: [{ "cycleId", "stepId", "status"?: "done" | "not_needed" | "clear", "date"?: "YYYY-MM-DD" | null }]
-- "date" present = set that date (null = back to the plan's date).
create or replace function public.care_nurse_set_cycle_steps(p_nurse_id uuid, p_patient_id uuid, p_items jsonb)
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
  v_cycle_id uuid;
  v_step_id uuid;
  v_status text;
  v_date date;
  v_count integer := 0;
begin
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, p_patient_id);
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cycle_id := (v_item ->> 'cycleId')::uuid;
    v_step_id := (v_item ->> 'stepId')::uuid;
    if not exists (
      select 1
      from public.care_cycles c
      join public.care_cycle_protocol_steps s on s.protocol_code = c.protocol_code
      where c.id = v_cycle_id and c.patient_id = p_patient_id and c.status = 'active' and s.id = v_step_id
    ) then
      raise exception 'unknown_item' using errcode = '22023';
    end if;
    v_status := v_item ->> 'status';
    if v_status is not null and v_status not in ('done', 'not_needed', 'clear') then
      raise exception 'invalid_item_status' using errcode = '22023';
    end if;
    v_date := nullif(v_item ->> 'date', '')::date;
    if v_date is not null and (v_date < v_today - 60 or v_date > v_today + 120) then
      raise exception 'invalid_visit_date' using errcode = '22023';
    end if;

    insert into public.care_cycle_step_records (cycle_id, step_id, nurse_id, nurse_name)
    values (v_cycle_id, v_step_id, v_nurse.id, v_nurse.display_name)
    on conflict (cycle_id, step_id) do nothing;

    update public.care_cycle_step_records r
    set status = case when v_status is null then r.status when v_status = 'clear' then null else v_status end,
        done_on = case when v_status is null then r.done_on when v_status = 'done' then coalesce(r.done_on, v_today) else null end,
        planned_date = case when v_item ? 'date' then v_date else r.planned_date end,
        nurse_id = v_nurse.id,
        nurse_name = v_nurse.display_name,
        updated_at = now()
    where r.cycle_id = v_cycle_id and r.step_id = v_step_id;

    delete from public.care_cycle_step_records r
    where r.cycle_id = v_cycle_id and r.step_id = v_step_id and r.status is null and r.planned_date is null;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Pages that show cycles
-- ---------------------------------------------------------------------

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
      ), '[]'::jsonb),
      'cycles', coalesce((
        select jsonb_agg(public.care_cycle_view(c.id) order by c.created_at)
        from public.care_cycles c
        where c.patient_id = p_patient_id and c.status = 'active'
      ), '[]'::jsonb)
    );
end;
$$;

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

  return v_base || jsonb_build_object(
    'extraItems', coalesce((
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
    ), '[]'::jsonb),
    'cycles', coalesce((
      select jsonb_agg(public.care_cycle_view(c.id) order by c.created_at)
      from public.care_cycles c
      where c.patient_id = v_patient_id and c.status = 'active'
    ), '[]'::jsonb)
  );
end;
$$;

-- The nurse's patient list, now with each patient's doctor (latest of:
-- nurse follow-up, active pregnancy/child plan, active cycle, pharmacy
-- bill). Set-based: bill doctor names are matched once per distinct name.
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
    with seen as (
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
    ),
    bill_names as (
      select distinct on (c.patient_id) c.patient_id, btrim(c.doctor_name) as doctor_name, c.created_at
      from public.patient_medicine_courses c
      where c.hospital_id = v_nurse.hospital_id and c.source = 'hospital' and nullif(btrim(c.doctor_name), '') is not null
      order by c.patient_id, c.created_at desc
    ),
    bill_match as (
      select n.doctor_name, m.doctor_id
      from (select distinct doctor_name from bill_names) n
      left join lateral public.care_match_doctor(v_nurse.hospital_id, n.doctor_name) m on true
    ),
    doctors as (
      select distinct on (d.patient_id) d.patient_id, d.care_doctor_id
      from (
        select f.patient_id, f.care_doctor_id, f.created_at
        from public.care_followups f
        where f.hospital_id = v_nurse.hospital_id and f.care_doctor_id is not null
        union all
        select p.patient_id, p.care_doctor_id, p.created_at
        from public.care_plans p
        where p.hospital_id = v_nurse.hospital_id and p.status = 'active' and p.care_doctor_id is not null
        union all
        select cy.patient_id, cy.care_doctor_id, cy.created_at
        from public.care_cycles cy
        where cy.hospital_id = v_nurse.hospital_id and cy.status = 'active' and cy.care_doctor_id is not null
        union all
        select b.patient_id, bm.doctor_id, b.created_at
        from bill_names b
        join bill_match bm on bm.doctor_name = b.doctor_name
        where bm.doctor_id is not null
      ) d
      order by d.patient_id, d.created_at desc
    )
    select jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'mobile', p.mobile,
        'hospitalPatientId', hp.hospital_patient_id,
        'lastSeen', s.last_seen,
        'doctorId', dr.care_doctor_id
      )
      order by s.last_seen desc nulls last, p.name
    )
    from seen s
    join public.patients p on p.id = s.patient_id
    left join public.care_hospital_patients hp on hp.hospital_id = v_nurse.hospital_id and hp.patient_id = s.patient_id
    left join doctors dr on dr.patient_id = s.patient_id
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Who may call what
-- ---------------------------------------------------------------------

revoke all on function public.care_cycle_view(uuid) from public, anon, authenticated;
revoke all on function public.care_nurse_start_cycle(uuid, uuid, text, text, text, date, uuid, text) from public, anon, authenticated;
revoke all on function public.care_nurse_update_cycle(uuid, uuid, date, text, text) from public, anon, authenticated;
revoke all on function public.care_nurse_close_cycle(uuid, uuid, text, date) from public, anon, authenticated;
revoke all on function public.care_nurse_set_cycle_steps(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.care_nurse_start_cycle(uuid, uuid, text, text, text, date, uuid, text) to service_role;
grant execute on function public.care_nurse_update_cycle(uuid, uuid, date, text, text) to service_role;
grant execute on function public.care_nurse_close_cycle(uuid, uuid, text, date) to service_role;
grant execute on function public.care_nurse_set_cycle_steps(uuid, uuid, jsonb) to service_role;
