-- My Care, part 9: Child Growth Chart for Dr. Sudarshan Reddy's patients
-- (Dhruva Hospitals, Kadapa). Additions only: two columns, one table, a
-- storage bucket, new functions, Dhruva's own child schedule, and new
-- bodies for care_plan_view (+ "optional", + extra days on an item's date)
-- and care_get_my_care_v2 (+ vaccine records, + where a parent can add a
-- child).
--
-- Dhruva's schedule (IAP, given by the hospital, 2026-10-15). One exact
-- date per visit: weeks = date of birth + 7 x weeks days; months / years =
-- calendar months / years (15 Jan + 6 months = 15 Jul).

-- ---------------------------------------------------------------------
-- 1. Schedule columns
-- ---------------------------------------------------------------------

-- Optional vaccines: shown apart ("Optional – ask your doctor"); reminders
-- only when the parent turns them on.
alter table public.care_schedule_items
  add column if not exists is_optional boolean not null default false;

-- Days added to an item's own date (Cholera-2 = 12 months + 14 days).
alter table public.care_schedule_items
  add column if not exists due_plus_days integer not null default 0
    check (due_plus_days between 0 and 365);

-- ---------------------------------------------------------------------
-- 2. Dhruva's child schedule (used for children at Dhruva; others keep
--    the standard schedule)
-- ---------------------------------------------------------------------

with h as (select id from public.hospitals where code = 'DHRUVA'),
v(code, title_en, title_te, due_unit, due_from, sort_order) as (
  values
    ('dhruva_child_birth', 'Birth', 'పుట్టినప్పుడు', 'week', 0, 10),
    ('dhruva_child_6w', '6 weeks', '6 వారాలు', 'week', 6, 20),
    ('dhruva_child_10w', '10 weeks', '10 వారాలు', 'week', 10, 30),
    ('dhruva_child_14w', '14 weeks', '14 వారాలు', 'week', 14, 40),
    ('dhruva_child_6m', '6 months', '6 నెలలు', 'month', 6, 50),
    ('dhruva_child_7m', '7 months', '7 నెలలు', 'month', 7, 60),
    ('dhruva_child_9m', '9 months', '9 నెలలు', 'month', 9, 70),
    ('dhruva_child_12m', '12 months', '12 నెలలు', 'month', 12, 80),
    ('dhruva_child_15m', '15 months', '15 నెలలు', 'month', 15, 90),
    ('dhruva_child_16m', '16 months', '16 నెలలు', 'month', 16, 100),
    ('dhruva_child_18m', '18 months', '18 నెలలు', 'month', 18, 110),
    ('dhruva_child_4y', '4 years', '4 సంవత్సరాలు', 'year', 4, 120),
    ('dhruva_child_10y', '10 years', '10 సంవత్సరాలు', 'year', 10, 130),
    ('dhruva_child_10y6m', '10½ years', '10½ సంవత్సరాలు', 'month', 126, 140)
)
insert into public.care_schedule_visits (plan_type, code, title_en, title_te, due_unit, due_from, due_to, sort_order, hospital_id)
select 'child', v.code, v.title_en, v.title_te, v.due_unit, v.due_from, v.due_from, v.sort_order, h.id
from v cross join h
on conflict (plan_type, code) do nothing;

-- Item code = dhruva_child_<vaccine>_<dose> (b1 / b2 = booster); the app
-- reads the vaccine and dose from it to keep the minimum gap between doses.
with i(visit_code, code, label_en, label_te, is_conditional, is_optional, due_unit, due_from, due_plus_days, sort_order) as (
  values
    ('dhruva_child_birth', 'dhruva_child_bcg_1', 'BCG', 'BCG (క్షయ నుంచి రక్షణ)', false, false, null, null, 0, 10),
    ('dhruva_child_birth', 'dhruva_child_opv_0', 'OPV', 'OPV (పోలియో చుక్కలు)', false, false, null, null, 0, 20),
    ('dhruva_child_birth', 'dhruva_child_hepb_1', 'Hep B-1', 'హెపటైటిస్ బి-1', false, false, null, null, 0, 30),

    ('dhruva_child_6w', 'dhruva_child_dtp_1', 'DTwP/DTaP-1', 'DTwP/DTaP-1', false, false, null, null, 0, 10),
    ('dhruva_child_6w', 'dhruva_child_ipv_1', 'IPV-1', 'IPV-1 (పోలియో ఇంజెక్షన్)', false, false, null, null, 0, 20),
    ('dhruva_child_6w', 'dhruva_child_hib_1', 'Hib-1', 'Hib-1', false, false, null, null, 0, 30),
    ('dhruva_child_6w', 'dhruva_child_hepb_2', 'Hep B-2', 'హెపటైటిస్ బి-2', false, false, null, null, 0, 40),
    ('dhruva_child_6w', 'dhruva_child_rota_1', 'Rotavirus-1', 'రోటావైరస్-1', false, false, null, null, 0, 50),
    ('dhruva_child_6w', 'dhruva_child_pcv_1', 'PCV-1', 'PCV-1 (న్యుమోనియా నుంచి రక్షణ)', false, false, null, null, 0, 60),

    ('dhruva_child_10w', 'dhruva_child_dtp_2', 'DTwP/DTaP-2', 'DTwP/DTaP-2', false, false, null, null, 0, 10),
    ('dhruva_child_10w', 'dhruva_child_ipv_2', 'IPV-2', 'IPV-2 (పోలియో ఇంజెక్షన్)', false, false, null, null, 0, 20),
    ('dhruva_child_10w', 'dhruva_child_hib_2', 'Hib-2', 'Hib-2', false, false, null, null, 0, 30),
    ('dhruva_child_10w', 'dhruva_child_hepb_3', 'Hep B-3', 'హెపటైటిస్ బి-3', false, false, null, null, 0, 40),
    ('dhruva_child_10w', 'dhruva_child_rota_2', 'Rotavirus-2', 'రోటావైరస్-2', false, false, null, null, 0, 50),
    ('dhruva_child_10w', 'dhruva_child_pcv_2', 'PCV-2', 'PCV-2 (న్యుమోనియా నుంచి రక్షణ)', false, false, null, null, 0, 60),

    ('dhruva_child_14w', 'dhruva_child_dtp_3', 'DTwP/DTaP-3', 'DTwP/DTaP-3', false, false, null, null, 0, 10),
    ('dhruva_child_14w', 'dhruva_child_ipv_3', 'IPV-3', 'IPV-3 (పోలియో ఇంజెక్షన్)', false, false, null, null, 0, 20),
    ('dhruva_child_14w', 'dhruva_child_hib_3', 'Hib-3', 'Hib-3', false, false, null, null, 0, 30),
    ('dhruva_child_14w', 'dhruva_child_hepb_4', 'Hep B-4', 'హెపటైటిస్ బి-4', false, false, null, null, 0, 40),
    ('dhruva_child_14w', 'dhruva_child_rota_3', 'Rotavirus-3', 'రోటావైరస్-3', false, false, null, null, 0, 50),
    ('dhruva_child_14w', 'dhruva_child_pcv_3', 'PCV-3', 'PCV-3 (న్యుమోనియా నుంచి రక్షణ)', false, false, null, null, 0, 60),

    ('dhruva_child_6m', 'dhruva_child_flu_1', 'Influenza-1', 'ఇన్‌ఫ్లుయెంజా (ఫ్లూ)-1', false, false, null, null, 0, 10),
    ('dhruva_child_6m', 'dhruva_child_tcv_1', 'Typhoid Conjugate Vaccine (TCV)', 'టైఫాయిడ్ టీకా (TCV)', false, false, null, null, 0, 20),

    ('dhruva_child_7m', 'dhruva_child_flu_2', 'Influenza-2', 'ఇన్‌ఫ్లుయెంజా (ఫ్లూ)-2', false, false, null, null, 0, 10),

    ('dhruva_child_9m', 'dhruva_child_mmr_1', 'MMR-1', 'MMR-1 (తట్టు, గవదబిళ్ళలు, రుబెల్లా)', false, false, null, null, 0, 10),
    ('dhruva_child_9m', 'dhruva_child_vita_1', 'Vitamin A-1', 'విటమిన్ A-1', false, false, null, null, 0, 20),
    ('dhruva_child_9m', 'dhruva_child_opt_mcv4_1', 'Meningococcal MCV4-1', 'మెనింగోకోకల్ MCV4-1', true, true, null, null, 0, 90),

    ('dhruva_child_12m', 'dhruva_child_hepa_1', 'Hepatitis A-1', 'హెపటైటిస్ ఎ-1', false, false, null, null, 0, 10),
    ('dhruva_child_12m', 'dhruva_child_opt_mcv4_2', 'Meningococcal MCV4-2', 'మెనింగోకోకల్ MCV4-2', true, true, null, null, 0, 90),
    ('dhruva_child_12m', 'dhruva_child_opt_je_1', 'Japanese Encephalitis-1 (high-risk areas only)', 'జపనీస్ ఎన్‌సెఫలైటిస్-1 (మెదడువాపు ఎక్కువగా ఉన్న ప్రాంతాల్లో మాత్రమే)', true, true, null, null, 0, 91),
    ('dhruva_child_12m', 'dhruva_child_opt_je_2', 'Japanese Encephalitis-2', 'జపనీస్ ఎన్‌సెఫలైటిస్-2', true, true, 'month', 13, 0, 92),
    ('dhruva_child_12m', 'dhruva_child_opt_cholera_1', 'Cholera-1 (high-risk areas only)', 'కలరా-1 (కలరా ఎక్కువగా ఉన్న ప్రాంతాల్లో మాత్రమే)', true, true, null, null, 0, 93),
    ('dhruva_child_12m', 'dhruva_child_opt_cholera_2', 'Cholera-2', 'కలరా-2', true, true, null, null, 14, 94),

    ('dhruva_child_15m', 'dhruva_child_mmr_2', 'MMR-2', 'MMR-2 (తట్టు, గవదబిళ్ళలు, రుబెల్లా)', false, false, null, null, 0, 10),
    ('dhruva_child_15m', 'dhruva_child_var_1', 'Varicella-1', 'ఆటలమ్మ (వారిసెల్లా)-1', false, false, null, null, 0, 20),
    ('dhruva_child_15m', 'dhruva_child_pcv_b1', 'PCV Booster', 'PCV బూస్టర్', false, false, null, null, 0, 30),

    ('dhruva_child_16m', 'dhruva_child_dtp_b1', 'DTwP/DTaP-B1', 'DTwP/DTaP బూస్టర్-1', false, false, null, null, 0, 10),
    ('dhruva_child_16m', 'dhruva_child_hib_b1', 'Hib-B1', 'Hib బూస్టర్', false, false, null, null, 0, 20),
    ('dhruva_child_16m', 'dhruva_child_ipv_b1', 'IPV-B1', 'IPV బూస్టర్-1', false, false, null, null, 0, 30),
    ('dhruva_child_16m', 'dhruva_child_vita_2', 'Vitamin A-2', 'విటమిన్ A-2', false, false, null, null, 0, 40),

    ('dhruva_child_18m', 'dhruva_child_hepa_2', 'Hepatitis A-2 (only if inactivated vaccine)', 'హెపటైటిస్ ఎ-2 (ఇనాక్టివేటెడ్ టీకా ఇచ్చి ఉంటేనే)', true, false, null, null, 0, 10),
    ('dhruva_child_18m', 'dhruva_child_var_2', 'Varicella-2', 'ఆటలమ్మ (వారిసెల్లా)-2', false, false, null, null, 0, 20),

    ('dhruva_child_4y', 'dhruva_child_dtp_b2', 'DTwP/DTaP-B2', 'DTwP/DTaP బూస్టర్-2', false, false, null, null, 0, 10),
    ('dhruva_child_4y', 'dhruva_child_ipv_b2', 'IPV-B2', 'IPV బూస్టర్-2', false, false, null, null, 0, 20),
    ('dhruva_child_4y', 'dhruva_child_mmr_3', 'MMR-3', 'MMR-3 (తట్టు, గవదబిళ్ళలు, రుబెల్లా)', false, false, null, null, 0, 30),

    ('dhruva_child_10y', 'dhruva_child_tdap_1', 'Tdap', 'Tdap', false, false, null, null, 0, 10),
    ('dhruva_child_10y', 'dhruva_child_hpv_1', 'HPV-1', 'HPV-1', false, false, null, null, 0, 20),

    ('dhruva_child_10y6m', 'dhruva_child_hpv_2', 'HPV-2', 'HPV-2', false, false, null, null, 0, 10)
)
insert into public.care_schedule_items
  (visit_id, code, label_en, label_te, is_conditional, is_optional, due_unit, due_from, due_to, due_plus_days, sort_order)
select v.id, i.code, i.label_en, i.label_te, i.is_conditional, i.is_optional, i.due_unit, i.due_from, i.due_from, i.due_plus_days, i.sort_order
from i
join public.care_schedule_visits v on v.plan_type = 'child' and v.code = i.visit_code
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 3. What the parent records for a vaccine (from the card or the label)
-- ---------------------------------------------------------------------

create table if not exists public.care_vaccine_records (
  plan_id uuid not null references public.care_plans (id) on delete cascade,
  item_id uuid not null references public.care_schedule_items (id) on delete cascade,
  given_on date not null,
  site text check (site in ('left_thigh', 'right_thigh', 'left_arm', 'right_arm', 'oral', 'other')),
  brand text check (char_length(brand) <= 80),
  batch_no text check (char_length(batch_no) <= 40),
  expiry date,
  photo_path text check (char_length(photo_path) <= 300),
  recorded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, item_id)
);

alter table public.care_vaccine_records enable row level security;
revoke all on table public.care_vaccine_records from public, anon, authenticated;

-- Label photos: private; a phone can only use its own folder (same rule as
-- the custom medicine photos).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vaccine-labels', 'vaccine-labels', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Parents upload own vaccine labels" on storage.objects;
create policy "Parents upload own vaccine labels" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vaccine-labels' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Parents read own vaccine labels" on storage.objects;
create policy "Parents read own vaccine labels" on storage.objects
  for select to authenticated
  using (bucket_id = 'vaccine-labels' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Parents delete own vaccine labels" on storage.objects;
create policy "Parents delete own vaccine labels" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vaccine-labels' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- 4. Plan view: + "optional", + item extra days
-- ---------------------------------------------------------------------

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
      i.is_optional as optional,
      coalesce(iw.from_date, vis.from_date) + i.due_plus_days as from_date,
      coalesce(iw.to_date, vis.to_date) + i.due_plus_days as to_date,
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
            'optional', it.optional,
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

-- ---------------------------------------------------------------------
-- 5. Parent functions (signed-in phone linked to the mobile number)
-- ---------------------------------------------------------------------

-- Hospitals a patient belongs to (bills, nurse desk, plans, cycles).
create or replace function public.care_patient_hospital_ids(p_patient_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.hospital_id from public.patient_medicine_courses c where c.patient_id = p_patient_id and c.hospital_id is not null
  union
  select hp.hospital_id from public.care_hospital_patients hp where hp.patient_id = p_patient_id
  union
  select f.hospital_id from public.care_followups f where f.patient_id = p_patient_id
  union
  select pl.hospital_id from public.care_plans pl where pl.patient_id = p_patient_id
  union
  select cy.hospital_id from public.care_cycles cy where cy.patient_id = p_patient_id;
$$;

-- The child doctor at one of the patient's hospitals (Dhruva: Dr. Sudarshan
-- Reddy), or nothing. A parent can add a child only when there is one.
create or replace function public.care_child_desk(p_patient_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('hospitalId', h.id, 'hospitalName', h.name, 'doctorId', d.id, 'doctorName', d.display_name)
  from public.care_doctors d
  join public.hospitals h on h.id = d.hospital_id
  where d.is_active
    and d.department = 'pediatrics'
    and d.hospital_id in (select public.care_patient_hospital_ids(p_patient_id))
  order by d.created_at
  limit 1;
$$;

create or replace function public.care_child_plan_of(p_patient_id uuid, p_plan_id uuid)
returns public.care_plans
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan public.care_plans;
begin
  select * into v_plan
  from public.care_plans p
  where p.id = p_plan_id and p.patient_id = p_patient_id and p.plan_type = 'child' and p.status = 'active';
  if not found then
    raise exception 'unknown_child' using errcode = '22023';
  end if;
  return v_plan;
end;
$$;

create or replace function public.care_child_check(p_name text, p_gender text, p_birth_date date)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_gender is null or p_gender not in ('female', 'male') then
    raise exception 'invalid_gender' using errcode = '22023';
  end if;
  if p_birth_date is null or p_birth_date > public.care_today() or p_birth_date < public.care_today() - interval '18 years' then
    raise exception 'invalid_birth_date' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.care_child_add(p_mobile text, p_name text, p_gender text, p_birth_date date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid := public.care_linked_patient_id(p_mobile);
  v_desk jsonb := public.care_child_desk(v_patient_id);
  v_plan_id uuid;
begin
  perform public.care_child_check(p_name, p_gender, p_birth_date);
  if v_desk is null then
    raise exception 'no_child_doctor' using errcode = 'P0001';
  end if;
  if (select count(*) from public.care_plans p where p.patient_id = v_patient_id and p.plan_type = 'child' and p.status = 'active') >= 8 then
    raise exception 'too_many_children' using errcode = 'P0001';
  end if;

  insert into public.care_plans (patient_id, plan_type, status, person_name, birth_date, child_gender, hospital_id, doctor_name, care_doctor_id)
  values (
    v_patient_id, 'child', 'active', btrim(p_name), p_birth_date, p_gender,
    (v_desk ->> 'hospitalId')::uuid, v_desk ->> 'doctorName', (v_desk ->> 'doctorId')::uuid
  )
  returning id into v_plan_id;

  return public.care_plan_view(v_plan_id);
end;
$$;

-- Name, gender or date of birth changed: every date follows from them.
create or replace function public.care_child_update(p_mobile text, p_plan_id uuid, p_name text, p_gender text, p_birth_date date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid := public.care_linked_patient_id(p_mobile);
  v_plan public.care_plans := public.care_child_plan_of(v_patient_id, p_plan_id);
begin
  perform public.care_child_check(p_name, p_gender, p_birth_date);
  -- A dose recorded before the new date of birth means one of them is wrong.
  if exists (select 1 from public.care_vaccine_records r where r.plan_id = v_plan.id and r.given_on < p_birth_date) then
    raise exception 'doses_before_birth' using errcode = '22023';
  end if;
  update public.care_plans
  set person_name = btrim(p_name), child_gender = p_gender, birth_date = p_birth_date, updated_at = now()
  where id = v_plan.id;
  return public.care_plan_view(v_plan.id);
end;
$$;

create or replace function public.care_child_item_ok(p_plan public.care_plans, p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from jsonb_array_elements(public.care_plan_view(p_plan.id) -> 'visits') v
    cross join lateral jsonb_array_elements(v -> 'items') it
    where (it ->> 'id')::uuid = p_item_id
  );
$$;

create or replace function public.care_vaccine_record_json(p_plan_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'planId', r.plan_id,
    'itemId', r.item_id,
    'givenOn', r.given_on,
    'site', r.site,
    'brand', r.brand,
    'batchNo', r.batch_no,
    'expiry', r.expiry,
    'photoPath', r.photo_path
  ) order by r.given_on), '[]'::jsonb)
  from public.care_vaccine_records r
  where r.plan_id = p_plan_id;
$$;

-- Save one vaccine (the form). Returns the child's records.
create or replace function public.care_child_save_vaccine(
  p_mobile text,
  p_plan_id uuid,
  p_item_id uuid,
  p_given_on date,
  p_site text,
  p_brand text,
  p_batch_no text,
  p_expiry date,
  p_photo_path text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid := public.care_linked_patient_id(p_mobile);
  v_plan public.care_plans := public.care_child_plan_of(v_patient_id, p_plan_id);
  v_photo text := nullif(btrim(coalesce(p_photo_path, '')), '');
begin
  if not public.care_child_item_ok(v_plan, p_item_id) then
    raise exception 'unknown_item' using errcode = '22023';
  end if;
  if p_given_on is null or p_given_on < v_plan.birth_date or p_given_on > public.care_today() then
    raise exception 'invalid_given_on' using errcode = '22023';
  end if;
  if v_photo is not null and v_photo not like auth.uid()::text || '/%' then
    raise exception 'invalid_photo' using errcode = '22023';
  end if;

  insert into public.care_vaccine_records as r (plan_id, item_id, given_on, site, brand, batch_no, expiry, photo_path, recorded_by)
  values (
    v_plan.id, p_item_id, p_given_on, nullif(p_site, ''), nullif(btrim(coalesce(p_brand, '')), ''),
    nullif(btrim(coalesce(p_batch_no, '')), ''), p_expiry, v_photo, auth.uid()
  )
  on conflict (plan_id, item_id) do update
  set given_on = excluded.given_on,
      site = excluded.site,
      brand = excluded.brand,
      batch_no = excluded.batch_no,
      expiry = excluded.expiry,
      photo_path = excluded.photo_path,
      recorded_by = excluded.recorded_by,
      updated_at = now();

  return public.care_vaccine_record_json(v_plan.id);
end;
$$;

create or replace function public.care_child_clear_vaccine(p_mobile text, p_plan_id uuid, p_item_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid := public.care_linked_patient_id(p_mobile);
  v_plan public.care_plans := public.care_child_plan_of(v_patient_id, p_plan_id);
begin
  delete from public.care_vaccine_records r where r.plan_id = v_plan.id and r.item_id = p_item_id;
  return public.care_vaccine_record_json(v_plan.id);
end;
$$;

-- "Mark as complete": every vaccine of the visit that is not optional or
-- "only if" and not recorded yet, given on that day.
create or replace function public.care_child_mark_visit(p_mobile text, p_plan_id uuid, p_visit_id uuid, p_given_on date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid := public.care_linked_patient_id(p_mobile);
  v_plan public.care_plans := public.care_child_plan_of(v_patient_id, p_plan_id);
  v_visit jsonb;
begin
  if p_given_on is null or p_given_on < v_plan.birth_date or p_given_on > public.care_today() then
    raise exception 'invalid_given_on' using errcode = '22023';
  end if;
  select v into v_visit
  from jsonb_array_elements(public.care_plan_view(v_plan.id) -> 'visits') v
  where (v ->> 'id')::uuid = p_visit_id;
  if v_visit is null then
    raise exception 'unknown_visit' using errcode = '22023';
  end if;

  insert into public.care_vaccine_records (plan_id, item_id, given_on, recorded_by)
  select v_plan.id, (it ->> 'id')::uuid, p_given_on, auth.uid()
  from jsonb_array_elements(v_visit -> 'items') it
  where not coalesce((it ->> 'conditional')::boolean, false)
    and not coalesce((it ->> 'optional')::boolean, false)
    and (it ->> 'status') is null
  on conflict (plan_id, item_id) do nothing;

  return public.care_vaccine_record_json(v_plan.id);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. My Care v2: + vaccine records of the patient's children, + where a
--    child can be added
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
    ), '[]'::jsonb),
    'vaccineRecords', coalesce((
      select jsonb_agg(rec order by rec ->> 'givenOn')
      from public.care_plans p
      cross join lateral jsonb_array_elements(public.care_vaccine_record_json(p.id)) rec
      where p.patient_id = v_patient_id and p.plan_type = 'child' and p.status = 'active'
    ), '[]'::jsonb),
    'childDesk', public.care_child_desk(v_patient_id)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Who may call what
-- ---------------------------------------------------------------------

revoke all on function public.care_patient_hospital_ids(uuid) from public, anon, authenticated;
revoke all on function public.care_child_desk(uuid) from public, anon, authenticated;
revoke all on function public.care_child_plan_of(uuid, uuid) from public, anon, authenticated;
revoke all on function public.care_child_check(text, text, date) from public, anon, authenticated;
revoke all on function public.care_child_item_ok(public.care_plans, uuid) from public, anon, authenticated;
revoke all on function public.care_vaccine_record_json(uuid) from public, anon, authenticated;

revoke all on function public.care_child_add(text, text, text, date) from public, anon;
revoke all on function public.care_child_update(text, uuid, text, text, date) from public, anon;
revoke all on function public.care_child_save_vaccine(text, uuid, uuid, date, text, text, text, date, text) from public, anon;
revoke all on function public.care_child_clear_vaccine(text, uuid, uuid) from public, anon;
revoke all on function public.care_child_mark_visit(text, uuid, uuid, date) from public, anon;
grant execute on function public.care_child_add(text, text, text, date) to authenticated;
grant execute on function public.care_child_update(text, uuid, text, text, date) to authenticated;
grant execute on function public.care_child_save_vaccine(text, uuid, uuid, date, text, text, text, date, text) to authenticated;
grant execute on function public.care_child_clear_vaccine(text, uuid, uuid) to authenticated;
grant execute on function public.care_child_mark_visit(text, uuid, uuid, date) to authenticated;
