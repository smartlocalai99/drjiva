-- My Care, part 4: a hospital can have its own pregnancy schedule.
-- Dhruva Hospitals' plan (given by the hospital, 2026-10-14):
--   week 6 sugar + CBC + TD 1st dose, week 8 dating scan, week 12 NT scan +
--   double marker + TD 2nd dose, week 14 check-up, week 20 TIFFA, week 24
--   OGTT, week 28 ICT (Rh-negative only), week 32 CBP + Hb + growth scan &
--   Doppler, week 34 basic checks, week 36 CBP + basic checks, weeks 37-40
--   weekly doctor visits.
-- Additions only: one nullable column + index, new rows, and a new body for
-- care_plan_view (identical except the hospital rule). Other hospitals keep
-- the standard schedule.

alter table public.care_schedule_visits
  add column if not exists hospital_id uuid references public.hospitals (id) on delete cascade;

create index if not exists care_schedule_visits_hospital_idx
  on public.care_schedule_visits (plan_type, hospital_id) where hospital_id is not null;

create or replace function public.care_plan_view(p_plan_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cp as (
    select
      p.*,
      h.name as hospital_name,
      case when p.plan_type = 'pregnancy' then p.edd_date - 280 else p.birth_date end as start_date,
      sn.display_name as started_by_name
    from public.care_plans p
    join public.hospitals h on h.id = p.hospital_id
    left join public.care_nurses sn on sn.id = p.started_by_nurse_id
    where p.id = p_plan_id
  ),
  visits as (
    select v.id, v.code, v.title_en, v.title_te, v.sort_order, w.from_date, w.to_date
    from cp
    join public.care_schedule_visits v on v.plan_type = cp.plan_type and v.is_active
      -- The hospital's own schedule if it has one, else the standard one.
      and v.hospital_id is not distinct from (
        select hs.hospital_id
        from public.care_schedule_visits hs
        where hs.plan_type = cp.plan_type and hs.hospital_id = cp.hospital_id and hs.is_active
        limit 1
      )
    cross join lateral public.care_window(cp.start_date, v.due_unit, v.due_from, v.due_to) w
  ),
  items as (
    select
      i.id,
      i.code,
      i.label_en,
      i.label_te,
      i.sort_order,
      vis.id as visit_id,
      (i.is_conditional or (i.only_for_gender is not null and cp.child_gender is null)) as conditional,
      coalesce(iw.from_date, vis.from_date) as from_date,
      coalesce(iw.to_date, vis.to_date) as to_date,
      pi.status,
      pi.done_on,
      pn.display_name as nurse_name
    from visits vis
    join public.care_schedule_items i on i.visit_id = vis.id and i.is_active
    cross join cp
    left join lateral (
      select w2.from_date, w2.to_date
      from public.care_window(cp.start_date, i.due_unit, i.due_from, i.due_to) w2
      where i.due_unit is not null
    ) iw on true
    left join public.care_plan_items pi on pi.plan_id = cp.id and pi.item_id = i.id
    left join public.care_nurses pn on pn.id = pi.nurse_id
    where i.only_for_gender is null
       or cp.child_gender is null
       or i.only_for_gender = cp.child_gender
  )
  select jsonb_build_object(
    'id', cp.id,
    'type', cp.plan_type,
    'status', cp.status,
    'personName', cp.person_name,
    'lmpDate', cp.lmp_date,
    'eddDate', cp.edd_date,
    'birthDate', cp.birth_date,
    'gender', cp.child_gender,
    'startDate', cp.start_date,
    'hospitalId', cp.hospital_id,
    'hospitalName', cp.hospital_name,
    'doctorName', cp.doctor_name,
    'startedByNurse', cp.started_by_name,
    'createdAt', cp.created_at,
    'hiddenByPatient', cp.hidden_by_patient_at is not null,
    'visits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', vis.id,
        'code', vis.code,
        'titleEn', vis.title_en,
        'titleTe', vis.title_te,
        'fromDate', vis.from_date,
        'toDate', vis.to_date,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', it.id,
            'code', it.code,
            'labelEn', it.label_en,
            'labelTe', it.label_te,
            'conditional', it.conditional,
            'fromDate', it.from_date,
            'toDate', it.to_date,
            'status', it.status,
            'doneOn', it.done_on,
            'nurseName', it.nurse_name
          ) order by it.sort_order)
          from items it
          where it.visit_id = vis.id
        ), '[]'::jsonb)
      ) order by vis.sort_order)
      from visits vis
    ), '[]'::jsonb)
  )
  from cp;
$$;

insert into public.care_schedule_visits
  (plan_type, hospital_id, code, title_en, title_te, due_unit, due_from, due_to, sort_order)
select 'pregnancy', h.id, v.code, v.title_en, v.title_te, 'week', v.dfrom, v.dto, v.sort
from (values
  ('dhruva_preg_w06', 'First tests', 'మొదటి పరీక్షలు', 6, 7, 10),
  ('dhruva_preg_w08', 'Dating scan', 'డేటింగ్ స్కాన్', 8, 10, 20),
  ('dhruva_preg_w12', 'NT scan', 'NT స్కాన్', 11, 13, 30),
  ('dhruva_preg_w14', 'Week 14 check-up', '14వ వారం పరీక్ష', 14, 19, 40),
  ('dhruva_preg_w20', 'TIFFA scan', 'TIFFA స్కాన్', 20, 23, 50),
  ('dhruva_preg_w24', 'Sugar test (OGTT)', 'షుగర్ పరీక్ష (OGTT)', 24, 27, 60),
  ('dhruva_preg_w28', 'Week 28 check-up', '28వ వారం పరీక్ష', 28, 31, 70),
  ('dhruva_preg_w32', 'Growth scan', 'గ్రోత్ స్కాన్', 32, 33, 80),
  ('dhruva_preg_w34', 'Week 34 check-up', '34వ వారం పరీక్ష', 34, 35, 90),
  ('dhruva_preg_w36', 'Week 36 check-up', '36వ వారం పరీక్ష', 36, 36, 100),
  ('dhruva_preg_w37', 'Week 37 check-up', '37వ వారం పరీక్ష', 37, 37, 110),
  ('dhruva_preg_w38', 'Week 38 check-up', '38వ వారం పరీక్ష', 38, 38, 120),
  ('dhruva_preg_w39', 'Week 39 check-up', '39వ వారం పరీక్ష', 39, 39, 130),
  ('dhruva_preg_w40', 'Week 40 check-up', '40వ వారం పరీక్ష', 40, 40, 140)
) as v(code, title_en, title_te, dfrom, dto, sort)
cross join public.hospitals h
where h.code = 'DHRUVA'
on conflict (plan_type, code) do nothing;

insert into public.care_schedule_items
  (visit_id, code, label_en, label_te, is_conditional, sort_order)
select v.id, i.code, i.label_en, i.label_te, i.cond, i.sort
from (values
  ('dhruva_preg_w06', 'dhruva_preg_sugar', 'Blood sugar test', 'రక్తంలో షుగర్ పరీక్ష', false, 10),
  ('dhruva_preg_w06', 'dhruva_preg_cbc', 'CBC blood test', 'CBC రక్త పరీక్ష', false, 20),
  ('dhruva_preg_w06', 'dhruva_preg_td1', 'TD vaccine – 1st dose', 'TD టీకా – 1వ డోసు', false, 30),
  ('dhruva_preg_w08', 'dhruva_preg_dating', 'Dating scan', 'డేటింగ్ స్కాన్', false, 10),
  ('dhruva_preg_w12', 'dhruva_preg_nt', 'NT scan', 'NT స్కాన్', false, 10),
  ('dhruva_preg_w12', 'dhruva_preg_double_marker', 'Double marker test', 'డబుల్ మార్కర్ పరీక్ష', false, 20),
  ('dhruva_preg_w12', 'dhruva_preg_td2', 'TD vaccine – 2nd dose', 'TD టీకా – 2వ డోసు', false, 30),
  ('dhruva_preg_w14', 'dhruva_preg_w14_doctor', 'Doctor check-up', 'డాక్టర్ పరీక్ష', false, 10),
  ('dhruva_preg_w20', 'dhruva_preg_tiffa', 'TIFFA scan (baby’s organs and growth)', 'TIFFA స్కాన్ (బిడ్డ అవయవాలు, ఎదుగుదల)', false, 10),
  ('dhruva_preg_w24', 'dhruva_preg_ogtt', 'OGTT sugar test', 'OGTT షుగర్ పరీక్ష', false, 10),
  ('dhruva_preg_w28', 'dhruva_preg_w28_doctor', 'Doctor check-up', 'డాక్టర్ పరీక్ష', false, 10),
  ('dhruva_preg_w28', 'dhruva_preg_ict', 'ICT test (only if her blood group is negative)', 'ICT పరీక్ష (బ్లడ్ గ్రూప్ నెగటివ్ అయితే మాత్రమే)', true, 20),
  ('dhruva_preg_w32', 'dhruva_preg_w32_cbp', 'CBP blood test', 'CBP రక్త పరీక్ష', false, 10),
  ('dhruva_preg_w32', 'dhruva_preg_w32_hb', 'Hemoglobin test', 'హిమోగ్లోబిన్ పరీక్ష', false, 20),
  ('dhruva_preg_w32', 'dhruva_preg_growth_doppler', 'Growth scan and Doppler', 'గ్రోత్ స్కాన్, డాప్లర్', false, 30),
  ('dhruva_preg_w34', 'dhruva_preg_w34_basic', 'Basic checks (BP, weight)', 'సాధారణ పరీక్షలు (BP, బరువు)', false, 10),
  ('dhruva_preg_w36', 'dhruva_preg_w36_cbp', 'CBP blood test', 'CBP రక్త పరీక్ష', false, 10),
  ('dhruva_preg_w36', 'dhruva_preg_w36_basic', 'Basic checks (BP, weight)', 'సాధారణ పరీక్షలు (BP, బరువు)', false, 20),
  ('dhruva_preg_w37', 'dhruva_preg_w37_doctor', 'Weekly doctor check-up', 'వారం వారం డాక్టర్ పరీక్ష', false, 10),
  ('dhruva_preg_w38', 'dhruva_preg_w38_doctor', 'Weekly doctor check-up', 'వారం వారం డాక్టర్ పరీక్ష', false, 10),
  ('dhruva_preg_w39', 'dhruva_preg_w39_doctor', 'Weekly doctor check-up', 'వారం వారం డాక్టర్ పరీక్ష', false, 10),
  ('dhruva_preg_w40', 'dhruva_preg_w40_doctor', 'Weekly doctor check-up', 'వారం వారం డాక్టర్ పరీక్ష', false, 10)
) as i(visit_code, code, label_en, label_te, cond, sort)
join public.care_schedule_visits v on v.plan_type = 'pregnancy' and v.code = i.visit_code
on conflict (code) do nothing;
