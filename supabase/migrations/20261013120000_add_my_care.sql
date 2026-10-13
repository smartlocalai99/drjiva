-- =====================================================================
-- My Care: pregnancy / child follow-up schedules, nurse updates,
-- after-hospital AI chat, and follow-up visit reminders.
--
-- ADDITIONS ONLY. Nothing existing is renamed, altered or dropped.
-- Every new table starts with care_ and has row level security on.
--   * Patients read their own data only through patient_device_links
--     (same rule as patient_medicine_courses).
--   * Nurses read/write only through care_nurse_* functions, which only
--     the Doctor Studio server (service role) can call, after checking
--     the nurse's signed login cookie. Each function re-checks the nurse
--     is active and limits her to patients of her own hospital.
--   * All patient data here is deleted automatically when the patient
--     row is deleted (account deletion).
-- =====================================================================

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 0. Small helpers
-- ---------------------------------------------------------------------

-- "Today" for the clinic: India time, not UTC.
create or replace function public.care_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

-- Any way of typing an Indian mobile -> '+91XXXXXXXXXX', or null.
create or replace function public.care_e164(p_mobile text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10) ~ '^[6-9][0-9]{9}$'
      and char_length(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g')) between 10 and 12
    then '+91' || right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10)
  end;
$$;

-- Bill doctor names are messy ("DR.MOUNIKA  REDDY", "Dr MOUNIKA MS OBG").
-- Lowercase, drop dr/degrees/punctuation, squeeze spaces.
create or replace function public.care_clean_doctor_name(p_name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(btrim(regexp_replace(regexp_replace(regexp_replace(
    lower(coalesce(p_name, '')),
    '[^a-z0-9]+', ' ', 'g'),
    '\m(dr|doctor|prof|mbbs|md|ms|dgo|dnb|obg|obgy|og|dch|mch|dm|frcog|mrcog|frcs|mrcp|fogsi|ped|peds|paed|paeds|gyn|gyne|gynae|gynaec|gynec|consultant)\M',
    ' ', 'g'),
    '\s+', ' ', 'g')), '');
$$;

-- A due window: from start + "from" units, to the last day of the
-- "to" unit (so weeks 11-13 means 11w0d to 13w6d).
create or replace function public.care_window(
  p_start date,
  p_unit text,
  p_from integer,
  p_to integer
)
returns table (from_date date, to_date date)
language sql
immutable
set search_path = ''
as $$
  select
    (p_start + case p_unit
      when 'week' then make_interval(weeks => p_from)
      when 'month' then make_interval(months => p_from)
      else make_interval(years => p_from) end)::date,
    ((p_start + case p_unit
      when 'week' then make_interval(weeks => p_to + 1)
      when 'month' then make_interval(months => p_to + 1)
      else make_interval(years => p_to + 1) end)::date - 1);
$$;

-- Bills are looked up by patient a lot now; keep that fast.
create index if not exists care_pmc_patient_bills_idx
  on public.patient_medicine_courses (patient_id, created_at desc)
  where source = 'hospital';

-- ---------------------------------------------------------------------
-- 1. Doctor -> department, per hospital (+ messy-name aliases)
--    Any doctor not listed here counts as "general".
-- ---------------------------------------------------------------------

create table public.care_doctors (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
  department text not null default 'general'
    check (department in ('gynecology', 'pediatrics', 'general')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index care_doctors_hospital_name_key
  on public.care_doctors (hospital_id, lower(btrim(display_name)));

create table public.care_doctor_aliases (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.care_doctors (id) on delete cascade,
  alias text not null check (char_length(btrim(alias)) between 2 and 80),
  alias_normalized text generated always as (public.care_clean_doctor_name(alias)) stored,
  created_at timestamptz not null default now(),
  unique (doctor_id, alias_normalized)
);

-- Finds which listed doctor a bill name belongs to at one hospital.
-- A match = the cleaned alias appears as whole words in the cleaned
-- bill name ("shilpa" matches "j shilpa sree"). Longest alias wins.
create or replace function public.care_match_doctor(p_hospital_id uuid, p_doctor_name text)
returns table (doctor_id uuid, display_name text, department text)
language sql
stable
security definer
set search_path = ''
as $$
  with cleaned as (
    select public.care_clean_doctor_name(p_doctor_name) as name
  )
  select d.id, d.display_name, d.department
  from public.care_doctors d
  cross join cleaned c
  join lateral (
    select max(char_length(a.alias_normalized)) as best
    from (
      select x.alias_normalized
      from public.care_doctor_aliases x
      where x.doctor_id = d.id
      union all
      select public.care_clean_doctor_name(d.display_name)
    ) a
    where a.alias_normalized is not null
      and (' ' || c.name || ' ') like ('% ' || a.alias_normalized || ' %')
  ) m on m.best is not null
  where d.hospital_id = p_hospital_id
    and d.is_active
    and c.name is not null
  order by m.best desc, d.display_name
  limit 1;
$$;

-- The patient's latest doctor + department from their pharmacy bills.
-- Optionally limited to one hospital.
create or replace function public.care_patient_latest_doctor(
  p_patient_id uuid,
  p_hospital_id uuid default null
)
returns table (
  hospital_id uuid,
  hospital_name text,
  doctor_name text,
  care_doctor_id uuid,
  department text,
  billed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.hospital_id,
    h.name,
    btrim(c.doctor_name),
    m.doctor_id,
    coalesce(m.department, 'general'),
    c.created_at
  from public.patient_medicine_courses c
  join public.hospitals h on h.id = c.hospital_id
  left join lateral public.care_match_doctor(c.hospital_id, c.doctor_name) m on true
  where c.patient_id = p_patient_id
    and c.source = 'hospital'
    and nullif(btrim(c.doctor_name), '') is not null
    and (p_hospital_id is null or c.hospital_id = p_hospital_id)
  order by c.created_at desc
  limit 1;
$$;

-- Starting data (exact rows from the hospitals table).
do $$
declare
  v_dhruva uuid;
  v_shankar uuid;
  v_doctor uuid;
begin
  select id into v_dhruva from public.hospitals
  where code = 'DHRUVA' or normalized_name = 'dhruva hospitals'
  order by (code = 'DHRUVA') desc nulls last
  limit 1;

  select id into v_shankar from public.hospitals
  where code = 'SHANKAR' or normalized_name = 'shankar gastro hospital'
  order by (code = 'SHANKAR') desc nulls last
  limit 1;

  if v_dhruva is null or v_shankar is null then
    raise exception 'My Care seed: Dhruva Hospitals or SHANKAR GASTRO HOSPITAL row not found';
  end if;

  insert into public.care_doctors (hospital_id, display_name, department)
  values (v_dhruva, 'Dr. Mounika', 'gynecology')
  returning id into v_doctor;
  insert into public.care_doctor_aliases (doctor_id, alias)
  values (v_doctor, 'Mounika'), (v_doctor, 'Mounika Reddy');

  insert into public.care_doctors (hospital_id, display_name, department)
  values (v_dhruva, 'Dr. Sudarshan Reddy', 'pediatrics')
  returning id into v_doctor;
  insert into public.care_doctor_aliases (doctor_id, alias)
  values (v_doctor, 'Sudarshan'), (v_doctor, 'Sudarshgan');

  insert into public.care_doctors (hospital_id, display_name, department)
  values (v_shankar, 'Dr. Silpa', 'gynecology')
  returning id into v_doctor;
  insert into public.care_doctor_aliases (doctor_id, alias)
  values (v_doctor, 'Silpa'), (v_doctor, 'Shilpa'), (v_doctor, 'Shilpa Sree'), (v_doctor, 'Silpa Sree');
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Schedules (editable in Supabase; nothing hard-coded in the apps)
--    Pregnancy windows are weeks from LMP. Child windows are age from
--    birth in weeks, months or years. An item can override its visit's
--    window (e.g. TCV 6-9 months inside the 6-month visit).
-- ---------------------------------------------------------------------

create table public.care_schedule_types (
  plan_type text primary key check (plan_type in ('pregnancy', 'child')),
  title_en text not null,
  title_te text not null,
  every_visit_en text,
  every_visit_te text,
  every_visit_until_months integer,
  updated_at timestamptz not null default now()
);

create table public.care_schedule_visits (
  id uuid primary key default gen_random_uuid(),
  plan_type text not null references public.care_schedule_types (plan_type),
  code text not null,
  title_en text not null,
  title_te text not null,
  due_unit text not null check (due_unit in ('week', 'month', 'year')),
  due_from integer not null check (due_from >= 0),
  due_to integer not null,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_type, code),
  check (due_to >= due_from),
  check (plan_type <> 'pregnancy' or due_unit = 'week')
);

create table public.care_schedule_items (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.care_schedule_visits (id) on delete cascade,
  code text not null unique,
  label_en text not null,
  label_te text not null,
  is_conditional boolean not null default false,
  only_for_gender text check (only_for_gender in ('female', 'male')),
  due_unit text check (due_unit in ('week', 'month', 'year')),
  due_from integer,
  due_to integer,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (due_unit is null and due_from is null and due_to is null)
    or (due_unit is not null and due_from is not null and due_to is not null and due_to >= due_from)
  )
);

create index care_schedule_items_visit_idx on public.care_schedule_items (visit_id);

-- ----- Seed: schedule types ------------------------------------------
-- DRAFT medical content. Your doctors should check and edit it here.

insert into public.care_schedule_types
  (plan_type, title_en, title_te, every_visit_en, every_visit_te, every_visit_until_months)
values
  ('pregnancy', 'Pregnancy', 'గర్భధారణ',
   'Every visit: BP, weight, urine albumin & sugar',
   'ప్రతి సందర్శనలో: BP, బరువు, మూత్రంలో ఆల్బుమిన్ & షుగర్',
   null),
  ('child', 'Child vaccines', 'పిల్లల టీకాలు',
   'Every visit till 2 years: weight, height, head size',
   '2 ఏళ్ల వరకు ప్రతి సందర్శనలో: బరువు, ఎత్తు, తల చుట్టుకొలత',
   24);

-- ----- Seed: visits ---------------------------------------------------
-- Pregnancy: monthly till week 28, every 2 weeks till 36, weekly till 40.

insert into public.care_schedule_visits
  (plan_type, code, title_en, title_te, due_unit, due_from, due_to, sort_order)
values
  ('pregnancy', 'preg_w06', 'First visit', 'మొదటి సందర్శన', 'week', 6, 8, 10),
  ('pregnancy', 'preg_w11', 'NT scan visit', 'NT స్కాన్ సందర్శన', 'week', 11, 13, 20),
  ('pregnancy', 'preg_w16', 'Week 16 visit', '16వ వారం సందర్శన', 'week', 16, 16, 30),
  ('pregnancy', 'preg_w20', 'Anomaly scan visit', 'అనామలీ స్కాన్ సందర్శన', 'week', 18, 22, 40),
  ('pregnancy', 'preg_w24', 'Sugar test visit', 'షుగర్ పరీక్ష సందర్శన', 'week', 24, 28, 50),
  ('pregnancy', 'preg_w28', 'Week 28 visit', '28వ వారం సందర్శన', 'week', 28, 28, 60),
  ('pregnancy', 'preg_w30', 'Week 30 visit', '30వ వారం సందర్శన', 'week', 30, 30, 70),
  ('pregnancy', 'preg_w32', 'Growth scan visit', 'గ్రోత్ స్కాన్ సందర్శన', 'week', 32, 32, 80),
  ('pregnancy', 'preg_w34', 'Week 34 visit', '34వ వారం సందర్శన', 'week', 34, 34, 90),
  ('pregnancy', 'preg_w36', 'Week 36 visit', '36వ వారం సందర్శన', 'week', 36, 36, 100),
  ('pregnancy', 'preg_w37', 'Week 37 check', '37వ వారం చెకప్', 'week', 37, 37, 110),
  ('pregnancy', 'preg_w38', 'Week 38 check', '38వ వారం చెకప్', 'week', 38, 38, 120),
  ('pregnancy', 'preg_w39', 'Week 39 check', '39వ వారం చెకప్', 'week', 39, 39, 130),
  ('pregnancy', 'preg_w40', 'Due-date review', 'డెలివరీ తేదీ సమీక్ష', 'week', 40, 40, 140),

  ('child', 'child_birth', 'At birth', 'పుట్టినప్పుడు', 'week', 0, 1, 10),
  ('child', 'child_6w', '6 weeks', '6 వారాలు', 'week', 6, 6, 20),
  ('child', 'child_10w', '10 weeks', '10 వారాలు', 'week', 10, 10, 30),
  ('child', 'child_14w', '14 weeks', '14 వారాలు', 'week', 14, 14, 40),
  ('child', 'child_6m', '6 months', '6 నెలలు', 'month', 6, 6, 50),
  ('child', 'child_7m', '7 months', '7 నెలలు', 'month', 7, 7, 60),
  ('child', 'child_9m', '9 months', '9 నెలలు', 'month', 9, 9, 70),
  ('child', 'child_12m', '12 months', '12 నెలలు', 'month', 12, 12, 80),
  ('child', 'child_flu_1y', 'Yearly flu shot – age 1', 'ఏటా ఫ్లూ టీకా – 1 ఏడాది', 'year', 1, 1, 85),
  ('child', 'child_15m', '15 months', '15 నెలలు', 'month', 15, 15, 90),
  ('child', 'child_16m', '16–18 months', '16–18 నెలలు', 'month', 16, 18, 100),
  ('child', 'child_18m', '18–19 months', '18–19 నెలలు', 'month', 18, 19, 110),
  ('child', 'child_flu_2y', 'Yearly flu shot – age 2', 'ఏటా ఫ్లూ టీకా – 2 ఏళ్లు', 'year', 2, 2, 120),
  ('child', 'child_flu_3y', 'Yearly flu shot – age 3', 'ఏటా ఫ్లూ టీకా – 3 ఏళ్లు', 'year', 3, 3, 130),
  ('child', 'child_4y', '4–6 years', '4–6 ఏళ్లు', 'year', 4, 6, 140),
  ('child', 'child_flu_4y', 'Yearly flu shot – age 4', 'ఏటా ఫ్లూ టీకా – 4 ఏళ్లు', 'year', 4, 4, 145),
  ('child', 'child_flu_5y', 'Yearly flu shot – age 5', 'ఏటా ఫ్లూ టీకా – 5 ఏళ్లు', 'year', 5, 5, 150),
  ('child', 'child_9y', '9–14 years', '9–14 ఏళ్లు', 'year', 9, 14, 160),
  ('child', 'child_10y', '10–12 years', '10–12 ఏళ్లు', 'year', 10, 12, 170),
  ('child', 'child_16y', '16–18 years', '16–18 ఏళ్లు', 'year', 16, 18, 180);

-- ----- Seed: checklist items ------------------------------------------

insert into public.care_schedule_items
  (visit_id, code, label_en, label_te, is_conditional, only_for_gender, due_unit, due_from, due_to, sort_order)
select v.id, i.code, i.label_en, i.label_te, i.cond, i.gender, i.unit, i.dfrom, i.dto, i.sort
from (values
  -- Pregnancy
  ('pregnancy', 'preg_w06', 'preg_dating_scan', 'Dating / viability scan', 'మొదటి స్కాన్ (గర్భం వయస్సు, గుండె చప్పుడు)', false, null::text, null::text, null::integer, null::integer, 10),
  ('pregnancy', 'preg_w06', 'preg_first_bloods', 'Blood tests: Hb/CBC, blood group & Rh, sugar, thyroid (TSH), HIV, Hepatitis B, VDRL', 'రక్త పరీక్షలు: Hb/CBC, బ్లడ్ గ్రూప్ & Rh, షుగర్, థైరాయిడ్ (TSH), HIV, హెపటైటిస్ B, VDRL', false, null, null, null, null, 20),
  ('pregnancy', 'preg_w06', 'preg_first_urine', 'Urine routine test', 'మూత్ర పరీక్ష (రొటీన్)', false, null, null, null, null, 30),
  ('pregnancy', 'preg_w06', 'preg_folic_acid', 'Folic acid tablets started', 'ఫోలిక్ యాసిడ్ మాత్రలు మొదలు', false, null, null, null, null, 40),
  ('pregnancy', 'preg_w11', 'preg_nt_scan', 'NT scan', 'NT స్కాన్', false, null, null, null, null, 10),
  ('pregnancy', 'preg_w11', 'preg_double_marker', 'Double marker test (if advised)', 'డబుల్ మార్కర్ పరీక్ష (డాక్టర్ సూచిస్తే)', true, null, null, null, null, 20),
  ('pregnancy', 'preg_w16', 'preg_reports_review', 'Reports reviewed by doctor', 'రిపోర్టులు డాక్టర్ చూశారు', false, null, null, null, null, 10),
  ('pregnancy', 'preg_w16', 'preg_iron_calcium', 'Iron + calcium tablets started', 'ఐరన్ + కాల్షియం మాత్రలు మొదలు', false, null, null, null, null, 20),
  ('pregnancy', 'preg_w16', 'preg_td1', 'Td/TT injection – dose 1', 'Td/TT ఇంజెక్షన్ – 1వ డోసు', false, null, null, null, null, 30),
  ('pregnancy', 'preg_w20', 'preg_anomaly_scan', 'Anomaly scan (TIFFA / Level-2)', 'అనామలీ స్కాన్ (TIFFA / లెవల్-2)', false, null, null, null, null, 10),
  ('pregnancy', 'preg_w20', 'preg_td2', 'Td/TT injection – dose 2 (4–6 weeks after dose 1)', 'Td/TT ఇంజెక్షన్ – 2వ డోసు (1వ డోసు తర్వాత 4–6 వారాలకు)', false, null, null, null, null, 20),
  ('pregnancy', 'preg_w24', 'preg_gtt', 'Sugar test (GTT)', 'షుగర్ పరీక్ష (GTT)', false, null, null, null, null, 10),
  ('pregnancy', 'preg_w28', 'preg_hb_repeat_28', 'Hb/CBC repeat', 'Hb/CBC మళ్ళీ పరీక్ష', false, null, null, null, null, 10),
  ('pregnancy', 'preg_w28', 'preg_anti_d', 'Anti-D injection (only if Rh negative)', 'Anti-D ఇంజెక్షన్ (Rh నెగటివ్ అయితే మాత్రమే)', true, null, null, null, null, 20),
  ('pregnancy', 'preg_w28', 'preg_tdap', 'Tdap (27–36 weeks, if advised)', 'Tdap (27–36 వారాల మధ్య, డాక్టర్ సూచిస్తే)', true, null, 'week', 27, 36, 30),
  ('pregnancy', 'preg_w30', 'preg_check_30', 'Routine check', 'రొటీన్ చెకప్', false, null, null, null, null, 10),
  ('pregnancy', 'preg_w32', 'preg_growth_scan', 'Growth scan', 'గ్రోత్ స్కాన్ (బిడ్డ ఎదుగుదల)', false, null, null, null, null, 10),
  ('pregnancy', 'preg_w32', 'preg_doppler', 'Doppler scan (if advised)', 'డాప్లర్ స్కాన్ (డాక్టర్ సూచిస్తే)', true, null, null, null, null, 20),
  ('pregnancy', 'preg_w34', 'preg_check_34', 'Routine check', 'రొటీన్ చెకప్', false, null, null, null, null, 10),
  ('pregnancy', 'preg_w34', 'preg_kick_count', 'Baby-movement counting explained', 'బిడ్డ కదలికలు లెక్కించడం నేర్పించారు', false, null, null, null, null, 20),
  ('pregnancy', 'preg_w36', 'preg_hb_urine_36', 'Hb + urine repeat', 'Hb + మూత్ర పరీక్ష మళ్ళీ', false, null, null, null, null, 10),
  ('pregnancy', 'preg_w36', 'preg_position', 'Baby position check', 'బిడ్డ స్థానం (పొజిషన్) పరీక్ష', false, null, null, null, null, 20),
  ('pregnancy', 'preg_w36', 'preg_delivery_plan', 'Delivery plan + hospital bag ready', 'డెలివరీ ప్లాన్ + హాస్పిటల్ బ్యాగ్ సిద్ధం', false, null, null, null, null, 30),
  ('pregnancy', 'preg_w37', 'preg_check_37', 'Weekly check', 'వారపు చెకప్', false, null, null, null, null, 10),
  ('pregnancy', 'preg_w37', 'preg_nst_37', 'NST (if advised)', 'NST (డాక్టర్ సూచిస్తే)', true, null, null, null, null, 20),
  ('pregnancy', 'preg_w38', 'preg_check_38', 'Weekly check', 'వారపు చెకప్', false, null, null, null, null, 10),
  ('pregnancy', 'preg_w38', 'preg_nst_38', 'NST (if advised)', 'NST (డాక్టర్ సూచిస్తే)', true, null, null, null, null, 20),
  ('pregnancy', 'preg_w39', 'preg_check_39', 'Weekly check', 'వారపు చెకప్', false, null, null, null, null, 10),
  ('pregnancy', 'preg_w39', 'preg_nst_39', 'NST (if advised)', 'NST (డాక్టర్ సూచిస్తే)', true, null, null, null, null, 20),
  ('pregnancy', 'preg_w40', 'preg_due_review', 'Due-date review', 'డెలివరీ తేదీ సమీక్ష', false, null, null, null, null, 10),
  ('pregnancy', 'preg_w40', 'preg_nst_40', 'NST (if advised)', 'NST (డాక్టర్ సూచిస్తే)', true, null, null, null, null, 20),

  -- Child (IAP-ACVIP 2025). Combo (hexavalent) shot: tick each part.
  ('child', 'child_birth', 'child_bcg', 'BCG', 'BCG టీకా', false, null, null, null, null, 10),
  ('child', 'child_birth', 'child_opv0', 'OPV-0 (polio drops)', 'OPV-0 (పోలియో చుక్కలు)', false, null, null, null, null, 20),
  ('child', 'child_birth', 'child_hepb1', 'Hepatitis B – 1', 'హెపటైటిస్ B – 1', false, null, null, null, null, 30),
  ('child', 'child_6w', 'child_dtp1', 'DTwP/DTaP – 1', 'DTwP/DTaP – 1', false, null, null, null, null, 10),
  ('child', 'child_6w', 'child_ipv1', 'IPV – 1', 'IPV – 1', false, null, null, null, null, 20),
  ('child', 'child_6w', 'child_hib1', 'Hib – 1', 'Hib – 1', false, null, null, null, null, 30),
  ('child', 'child_6w', 'child_hepb2', 'Hepatitis B – 2', 'హెపటైటిస్ B – 2', false, null, null, null, null, 40),
  ('child', 'child_6w', 'child_rota1', 'Rotavirus – 1', 'రోటావైరస్ – 1', false, null, null, null, null, 50),
  ('child', 'child_6w', 'child_pcv1', 'PCV – 1', 'PCV – 1', false, null, null, null, null, 60),
  ('child', 'child_10w', 'child_dtp2', 'DTwP/DTaP – 2', 'DTwP/DTaP – 2', false, null, null, null, null, 10),
  ('child', 'child_10w', 'child_ipv2', 'IPV – 2', 'IPV – 2', false, null, null, null, null, 20),
  ('child', 'child_10w', 'child_hib2', 'Hib – 2', 'Hib – 2', false, null, null, null, null, 30),
  ('child', 'child_10w', 'child_hepb3', 'Hepatitis B – 3', 'హెపటైటిస్ B – 3', false, null, null, null, null, 40),
  ('child', 'child_10w', 'child_rota2', 'Rotavirus – 2', 'రోటావైరస్ – 2', false, null, null, null, null, 50),
  ('child', 'child_10w', 'child_pcv2', 'PCV – 2', 'PCV – 2', false, null, null, null, null, 60),
  ('child', 'child_14w', 'child_dtp3', 'DTwP/DTaP – 3', 'DTwP/DTaP – 3', false, null, null, null, null, 10),
  ('child', 'child_14w', 'child_ipv3', 'IPV – 3', 'IPV – 3', false, null, null, null, null, 20),
  ('child', 'child_14w', 'child_hib3', 'Hib – 3', 'Hib – 3', false, null, null, null, null, 30),
  ('child', 'child_14w', 'child_hepb4', 'Hepatitis B – 4', 'హెపటైటిస్ B – 4', false, null, null, null, null, 40),
  ('child', 'child_14w', 'child_rota3', 'Rotavirus – 3 (not needed for 2-dose brand)', 'రోటావైరస్ – 3 (2-డోసు బ్రాండ్ అయితే అవసరం లేదు)', true, null, null, null, null, 50),
  ('child', 'child_14w', 'child_pcv3', 'PCV – 3', 'PCV – 3', false, null, null, null, null, 60),
  ('child', 'child_6m', 'child_flu1', 'Influenza (flu) – 1', 'ఇన్ఫ్లుఎంజా (ఫ్లూ) – 1', false, null, null, null, null, 10),
  ('child', 'child_6m', 'child_tcv', 'Typhoid conjugate (TCV, 6–9 months)', 'టైఫాయిడ్ కాంజుగేట్ టీకా (TCV, 6–9 నెలలు)', false, null, 'month', 6, 9, 20),
  ('child', 'child_7m', 'child_flu2', 'Influenza (flu) – 2', 'ఇన్ఫ్లుఎంజా (ఫ్లూ) – 2', false, null, null, null, null, 10),
  ('child', 'child_9m', 'child_mmr1', 'MMR – 1', 'MMR – 1', false, null, null, null, null, 10),
  ('child', 'child_12m', 'child_hepa1', 'Hepatitis A – 1', 'హెపటైటిస్ A – 1', false, null, null, null, null, 10),
  ('child', 'child_flu_1y', 'child_flu_y1', 'Influenza – yearly (before monsoon)', 'ఇన్ఫ్లుఎంజా – ఏటా (వర్షాకాలానికి ముందు)', false, null, null, null, null, 10),
  ('child', 'child_15m', 'child_mmr2', 'MMR – 2', 'MMR – 2', false, null, null, null, null, 10),
  ('child', 'child_15m', 'child_var1', 'Varicella (chickenpox) – 1', 'వారిసెల్లా (చికెన్‌పాక్స్) – 1', false, null, null, null, null, 20),
  ('child', 'child_15m', 'child_pcv_booster', 'PCV booster', 'PCV బూస్టర్', false, null, null, null, null, 30),
  ('child', 'child_16m', 'child_dtp_b1', 'DTwP/DTaP booster – 1', 'DTwP/DTaP బూస్టర్ – 1', false, null, null, null, null, 10),
  ('child', 'child_16m', 'child_hib_booster', 'Hib booster', 'Hib బూస్టర్', false, null, null, null, null, 20),
  ('child', 'child_16m', 'child_ipv_b1', 'IPV booster – 1', 'IPV బూస్టర్ – 1', false, null, null, null, null, 30),
  ('child', 'child_18m', 'child_hepa2', 'Hepatitis A – 2 (only for 2-dose brand)', 'హెపటైటిస్ A – 2 (2-డోసు బ్రాండ్ అయితే మాత్రమే)', true, null, null, null, null, 10),
  ('child', 'child_18m', 'child_var2', 'Varicella (chickenpox) – 2', 'వారిసెల్లా (చికెన్‌పాక్స్) – 2', false, null, null, null, null, 20),
  ('child', 'child_flu_2y', 'child_flu_y2', 'Influenza – yearly (before monsoon)', 'ఇన్ఫ్లుఎంజా – ఏటా (వర్షాకాలానికి ముందు)', false, null, null, null, null, 10),
  ('child', 'child_flu_3y', 'child_flu_y3', 'Influenza – yearly (before monsoon)', 'ఇన్ఫ్లుఎంజా – ఏటా (వర్షాకాలానికి ముందు)', false, null, null, null, null, 10),
  ('child', 'child_4y', 'child_dtp_b2', 'DTwP/DTaP booster – 2', 'DTwP/DTaP బూస్టర్ – 2', false, null, null, null, null, 10),
  ('child', 'child_4y', 'child_ipv_b2', 'IPV booster – 2', 'IPV బూస్టర్ – 2', false, null, null, null, null, 20),
  ('child', 'child_4y', 'child_mmr3', 'MMR – 3', 'MMR – 3', false, null, null, null, null, 30),
  ('child', 'child_flu_4y', 'child_flu_y4', 'Influenza – yearly (before monsoon)', 'ఇన్ఫ్లుఎంజా – ఏటా (వర్షాకాలానికి ముందు)', false, null, null, null, null, 10),
  ('child', 'child_flu_5y', 'child_flu_y5', 'Influenza – yearly (before monsoon)', 'ఇన్ఫ్లుఎంజా – ఏటా (వర్షాకాలానికి ముందు)', false, null, null, null, null, 10),
  ('child', 'child_9y', 'child_hpv1', 'HPV – dose 1', 'HPV – 1వ డోసు', false, null, null, null, null, 10),
  ('child', 'child_9y', 'child_hpv2', 'HPV – dose 2 (boys only, 6 months after dose 1)', 'HPV – 2వ డోసు (అబ్బాయిలకు మాత్రమే, 1వ డోసు తర్వాత 6 నెలలకు)', false, 'male', null, null, null, 20),
  ('child', 'child_10y', 'child_tdap', 'Tdap', 'Tdap', false, null, null, null, null, 10),
  ('child', 'child_16y', 'child_td', 'Td', 'Td', false, null, null, null, null, 10)
) as i(plan_type, visit_code, code, label_en, label_te, cond, gender, unit, dfrom, dto, sort)
join public.care_schedule_visits v
  on v.plan_type = i.plan_type and v.code = i.visit_code;

-- ---------------------------------------------------------------------
-- 3. Nurses: mobile number + 4-digit PIN, one hospital each.
--    The PIN hash lives in the private schema (no API access at all).
-- ---------------------------------------------------------------------

create table public.care_nurses (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 60),
  phone text not null unique check (phone ~ '^\+91[6-9][0-9]{9}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.care_nurse_credentials (
  nurse_id uuid primary key references public.care_nurses (id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Patients a hospital has seen + optional hospital patient ID
--    (UHID / MRN), unique per hospital.
-- ---------------------------------------------------------------------

create table public.care_hospital_patients (
  hospital_id uuid not null references public.hospitals (id) on delete restrict,
  patient_id uuid not null references public.patients (id) on delete cascade,
  hospital_patient_id text
    check (hospital_patient_id is null or char_length(btrim(hospital_patient_id)) between 1 and 40),
  hospital_patient_id_normalized text generated always as (
    nullif(upper(regexp_replace(coalesce(hospital_patient_id, ''), '[^A-Za-z0-9]', '', 'g')), '')
  ) stored,
  added_by_nurse_id uuid references public.care_nurses (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (hospital_id, patient_id)
);

create unique index care_hospital_patients_uhid_key
  on public.care_hospital_patients (hospital_id, hospital_patient_id_normalized)
  where hospital_patient_id_normalized is not null;

create index care_hospital_patients_patient_idx on public.care_hospital_patients (patient_id);

-- ---------------------------------------------------------------------
-- 5. Care plans: one active pregnancy per mobile; any number of
--    children (kids' bills use a parent's mobile).
--    Pregnancy: EDD is the source of truth (EDD = LMP + 280, and the
--    nurse can correct EDD after a scan). Week = days since (EDD-280) / 7.
-- ---------------------------------------------------------------------

create table public.care_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  plan_type text not null references public.care_schedule_types (plan_type),
  status text not null default 'active' check (status in ('active', 'delivered', 'ended')),
  person_name text not null check (char_length(btrim(person_name)) between 1 and 80),
  lmp_date date,
  edd_date date,
  birth_date date,
  child_gender text check (child_gender in ('female', 'male')),
  hospital_id uuid not null references public.hospitals (id) on delete restrict,
  doctor_name text,
  care_doctor_id uuid references public.care_doctors (id) on delete set null,
  started_by_nurse_id uuid references public.care_nurses (id) on delete set null,
  closed_on date,
  closed_by_nurse_id uuid references public.care_nurses (id) on delete set null,
  hidden_by_patient_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (plan_type <> 'pregnancy' or edd_date is not null),
  check (plan_type <> 'child' or birth_date is not null),
  check (status = 'active' or closed_on is not null)
);

create unique index care_plans_one_active_pregnancy
  on public.care_plans (patient_id)
  where plan_type = 'pregnancy' and status = 'active';

create index care_plans_patient_idx on public.care_plans (patient_id, status);

-- One row per ticked checklist item. No row = blank.
create table public.care_plan_items (
  plan_id uuid not null references public.care_plans (id) on delete cascade,
  item_id uuid not null references public.care_schedule_items (id) on delete cascade,
  status text not null check (status in ('done', 'not_needed')),
  done_on date not null default public.care_today(),
  nurse_id uuid references public.care_nurses (id) on delete set null,
  hospital_id uuid references public.hospitals (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (plan_id, item_id)
);

-- ---------------------------------------------------------------------
-- 6. Follow-ups: every nurse save. Works with or without a plan.
--    nurse_name is a snapshot so the patient always sees who helped.
-- ---------------------------------------------------------------------

create table public.care_followups (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  plan_id uuid references public.care_plans (id) on delete set null,
  hospital_id uuid not null references public.hospitals (id) on delete restrict,
  nurse_id uuid references public.care_nurses (id) on delete set null,
  nurse_name text not null,
  doctor_name text,
  care_doctor_id uuid references public.care_doctors (id) on delete set null,
  department text not null default 'general'
    check (department in ('gynecology', 'pediatrics', 'general')),
  visit_date date not null default public.care_today(),
  next_date date,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);

create index care_followups_patient_idx on public.care_followups (patient_id, created_at desc);
create index care_followups_next_date_idx on public.care_followups (next_date) where next_date is not null;

-- ---------------------------------------------------------------------
-- 7. After-hospital care chat (each patient sees only their own).
-- ---------------------------------------------------------------------

create table public.care_chat_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  owner_user_id uuid references auth.users (id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 2000),
  urgent boolean not null default false,
  created_at timestamptz not null default now()
);

create index care_chat_messages_patient_idx on public.care_chat_messages (patient_id, created_at desc);

-- ---------------------------------------------------------------------
-- 8. Push tokens for follow-up reminders (one per device + patient),
--    and a send log so a reminder never goes out twice.
-- ---------------------------------------------------------------------

create table public.care_push_tokens (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  language text not null default 'en' check (language in ('en', 'te')),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, patient_id)
);

create index care_push_tokens_patient_idx on public.care_push_tokens (patient_id);

create table public.care_followup_reminder_log (
  followup_id uuid not null references public.care_followups (id) on delete cascade,
  kind text not null check (kind in ('eve', 'day')),
  owner_user_id uuid not null,
  sent_at timestamptz not null default now(),
  primary key (followup_id, kind, owner_user_id)
);

-- ---------------------------------------------------------------------
-- 9. Row level security
-- ---------------------------------------------------------------------

alter table public.care_doctors enable row level security;
alter table public.care_doctor_aliases enable row level security;
alter table public.care_schedule_types enable row level security;
alter table public.care_schedule_visits enable row level security;
alter table public.care_schedule_items enable row level security;
alter table public.care_nurses enable row level security;
alter table public.care_hospital_patients enable row level security;
alter table public.care_plans enable row level security;
alter table public.care_plan_items enable row level security;
alter table public.care_followups enable row level security;
alter table public.care_chat_messages enable row level security;
alter table public.care_push_tokens enable row level security;
alter table public.care_followup_reminder_log enable row level security;
alter table private.care_nurse_credentials enable row level security;

revoke all on
  public.care_doctors,
  public.care_doctor_aliases,
  public.care_schedule_types,
  public.care_schedule_visits,
  public.care_schedule_items,
  public.care_nurses,
  public.care_hospital_patients,
  public.care_plans,
  public.care_plan_items,
  public.care_followups,
  public.care_chat_messages,
  public.care_push_tokens,
  public.care_followup_reminder_log
from anon, authenticated;
revoke all on private.care_nurse_credentials from public, anon, authenticated, service_role;

-- Schedules are reference data (no patient data): signed-in app users may read.
grant select on public.care_schedule_types, public.care_schedule_visits, public.care_schedule_items to authenticated;
create policy "Signed-in users read schedule types" on public.care_schedule_types
  for select to authenticated using (true);
create policy "Signed-in users read schedule visits" on public.care_schedule_visits
  for select to authenticated using (is_active);
create policy "Signed-in users read schedule items" on public.care_schedule_items
  for select to authenticated using (is_active);

-- Patient data: read-only, and only on a device linked to that patient
-- (same rule as patient_medicine_courses). All writes go through functions.
grant select on public.care_plans, public.care_plan_items, public.care_followups, public.care_chat_messages to authenticated;

create policy "Linked devices read care plans" on public.care_plans
  for select to authenticated
  using (exists (
    select 1 from public.patient_device_links dl
    where dl.patient_id = care_plans.patient_id
      and dl.owner_user_id = (select auth.uid())
  ));

create policy "Linked devices read care plan items" on public.care_plan_items
  for select to authenticated
  using (exists (
    select 1
    from public.care_plans p
    join public.patient_device_links dl on dl.patient_id = p.patient_id
    where p.id = care_plan_items.plan_id
      and dl.owner_user_id = (select auth.uid())
  ));

create policy "Linked devices read care follow-ups" on public.care_followups
  for select to authenticated
  using (exists (
    select 1 from public.patient_device_links dl
    where dl.patient_id = care_followups.patient_id
      and dl.owner_user_id = (select auth.uid())
  ));

create policy "Linked devices read care chat" on public.care_chat_messages
  for select to authenticated
  using (exists (
    select 1 from public.patient_device_links dl
    where dl.patient_id = care_chat_messages.patient_id
      and dl.owner_user_id = (select auth.uid())
  ));
-- care_doctors, aliases, nurses, hospital patients, push tokens and the
-- reminder log have NO client policies: functions only.

-- ---------------------------------------------------------------------
-- 10. Read-out helpers (internal)
-- ---------------------------------------------------------------------

-- A plan with every visit + item, their date windows and what the
-- nurse recorded. Display status (Done / Due now / Pending / Upcoming)
-- is worked out in the apps from these dates, so it stays right offline.
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

create or replace function public.care_every_visit()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(t.plan_type, jsonb_build_object(
    'en', t.every_visit_en,
    'te', t.every_visit_te,
    'untilMonths', t.every_visit_until_months
  )), '{}'::jsonb)
  from public.care_schedule_types t;
$$;

-- Latest doctor from bills OR from a nurse visit, whichever is newer.
create or replace function public.care_patient_current_doctor(
  p_patient_id uuid,
  p_hospital_id uuid default null
)
returns table (
  doctor_name text,
  care_doctor_id uuid,
  department text,
  hospital_id uuid,
  hospital_name text,
  source text,
  seen_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.doctor_name, c.care_doctor_id, c.department, c.hospital_id, c.hospital_name, c.source, c.seen_at
  from (
    select
      b.doctor_name,
      b.care_doctor_id,
      b.department,
      b.hospital_id,
      b.hospital_name,
      'bill'::text as source,
      b.billed_at as seen_at
    from public.care_patient_latest_doctor(p_patient_id, p_hospital_id) b
    union all
    select
      f.doctor_name,
      f.care_doctor_id,
      f.department,
      f.hospital_id,
      h.name,
      'nurse'::text,
      f.created_at
    from (
      select *
      from public.care_followups f0
      where f0.patient_id = p_patient_id
        and (p_hospital_id is null or f0.hospital_id = p_hospital_id)
        and nullif(btrim(f0.doctor_name), '') is not null
      order by f0.created_at desc
      limit 1
    ) f
    join public.hospitals h on h.id = f.hospital_id
  ) c
  order by c.seen_at desc
  limit 1;
$$;

create or replace function public.care_age_text(p_birth date, p_today date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_today < p_birth then 'not born yet'
    when p_today - p_birth < 98 then ((p_today - p_birth) / 7)::text || ' weeks'
    when (extract(year from age(p_today, p_birth)) * 12 + extract(month from age(p_today, p_birth))) < 24
      then (extract(year from age(p_today, p_birth)) * 12 + extract(month from age(p_today, p_birth)))::integer::text || ' months'
    else extract(year from age(p_today, p_birth))::integer::text || ' years'
  end;
$$;

-- The patient this signed-in device is linked to (by mobile), or error.
create or replace function public.care_linked_patient_id(p_mobile text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_patient_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select p.id into v_patient_id
  from public.patients p
  join public.patient_device_links dl
    on dl.patient_id = p.id and dl.owner_user_id = v_uid
  where p.mobile = public.care_e164(p_mobile);

  if v_patient_id is null then
    raise exception 'This device is not linked to that patient' using errcode = '42501';
  end if;

  return v_patient_id;
end;
$$;

-- What the AI may know. No mobile number, no names.
create or replace function public.care_chat_context(p_patient_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := public.care_today();
  v_department text;
  v_hospital text;
  v_medicines jsonb;
  v_pregnancy_week integer;
  v_children jsonb;
  v_next date;
  v_pending jsonb;
begin
  select d.department, d.hospital_name
  into v_department, v_hospital
  from public.care_patient_current_doctor(p_patient_id) d;

  select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'times', to_jsonb(x.times)) order by x.name), '[]'::jsonb)
  into v_medicines
  from (
    select
      coalesce(m.name, cm.name) as name,
      array_remove(array[
        case when bool_or(s.slot = 'morning') then 'morning' end,
        case when bool_or(s.slot = 'afternoon') then 'afternoon' end,
        case when bool_or(s.slot = 'night') then 'night' end
      ], null) as times
    from public.patient_medicine_courses c
    left join public.medicines m on m.id = c.medicine_id
    left join public.patient_custom_medicines cm on cm.id = c.custom_medicine_id
    left join public.patient_medicine_course_slots s on s.course_id = c.id
    where c.patient_id = p_patient_id
      and c.status = 'active'
      and c.stopped_at is null
      and c.start_date <= v_today
      and (
        c.schedule_mode = 'ongoing'
        or c.duration_days is null
        or c.start_date + c.duration_days > v_today
      )
    group by coalesce(m.name, cm.name)
    limit 20
  ) x
  where x.name is not null;

  select floor((v_today - (p.edd_date - 280)) / 7.0)::integer
  into v_pregnancy_week
  from public.care_plans p
  where p.patient_id = p_patient_id
    and p.plan_type = 'pregnancy'
    and p.status = 'active'
    and p.hidden_by_patient_at is null
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('age', public.care_age_text(p.birth_date, v_today)) order by p.birth_date), '[]'::jsonb)
  into v_children
  from public.care_plans p
  where p.patient_id = p_patient_id
    and p.plan_type = 'child'
    and p.status = 'active'
    and p.hidden_by_patient_at is null;

  select f.next_date
  into v_next
  from (
    select distinct on (f0.hospital_id) f0.*
    from public.care_followups f0
    where f0.patient_id = p_patient_id
    order by f0.hospital_id, f0.created_at desc
  ) f
  where f.next_date >= v_today
  order by f.next_date
  limit 1;

  select coalesce(jsonb_agg(distinct it ->> 'labelEn'), '[]'::jsonb)
  into v_pending
  from public.care_plans p
  cross join lateral jsonb_array_elements(public.care_plan_view(p.id) -> 'visits') v
  cross join lateral jsonb_array_elements(v -> 'items') it
  where p.patient_id = p_patient_id
    and p.status = 'active'
    and p.hidden_by_patient_at is null
    and (it ->> 'status') is null
    and not coalesce((it ->> 'conditional')::boolean, false)
    and (it ->> 'toDate')::date < v_today;

  return jsonb_build_object(
    'today', v_today,
    'hospital', v_hospital,
    'department', coalesce(v_department, 'general'),
    'medicines', v_medicines,
    'pregnancyWeek', v_pregnancy_week,
    'children', v_children,
    'nextFollowupDate', v_next,
    'pendingItems', v_pending
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 11. Patient app functions (signed-in device, must be linked)
-- ---------------------------------------------------------------------

create or replace function public.care_get_my_care(p_mobile text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.care_today();
  v_patient_id uuid;
  v_patient_name text;
  v_doc_name text;
  v_doc_dept text;
  v_doc_hospital_id uuid;
  v_doc_hospital_name text;
  v_followup jsonb;
  v_plans jsonb;
  v_chat jsonb;
  v_sent_today integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select p.id, p.name
  into v_patient_id, v_patient_name
  from public.patients p
  join public.patient_device_links dl
    on dl.patient_id = p.id and dl.owner_user_id = v_uid
  where p.mobile = public.care_e164(p_mobile);

  if v_patient_id is null then
    return jsonb_build_object('linked', false, 'today', v_today);
  end if;

  select d.doctor_name, d.department, d.hospital_id, d.hospital_name
  into v_doc_name, v_doc_dept, v_doc_hospital_id, v_doc_hospital_name
  from public.care_patient_current_doctor(v_patient_id) d;

  -- Next visit: newest follow-up per hospital, the soonest future date.
  select jsonb_build_object(
    'id', f.id,
    'planId', f.plan_id,
    'visitDate', f.visit_date,
    'nextDate', f.next_date,
    'note', f.note,
    'doctorName', f.doctor_name,
    'department', f.department,
    'nurseName', f.nurse_name,
    'updatedAt', f.created_at,
    'hospital', jsonb_build_object(
      'id', h.id,
      'name', h.name,
      'phone', h.phone,
      'logoUrl', h.logo_url
    )
  )
  into v_followup
  from (
    select distinct on (f0.hospital_id) f0.*
    from public.care_followups f0
    where f0.patient_id = v_patient_id
    order by f0.hospital_id, f0.created_at desc
  ) f
  join public.hospitals h on h.id = f.hospital_id
  where f.next_date >= v_today
  order by f.next_date, f.created_at desc
  limit 1;

  select coalesce(jsonb_agg(public.care_plan_view(p.id) order by p.plan_type desc, p.created_at), '[]'::jsonb)
  into v_plans
  from public.care_plans p
  where p.patient_id = v_patient_id
    and p.status = 'active'
    and p.hidden_by_patient_at is null;

  select count(*)
  into v_sent_today
  from public.care_chat_messages m
  where m.patient_id = v_patient_id
    and m.role = 'user'
    and (m.created_at at time zone 'Asia/Kolkata')::date = v_today;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'role', m.role,
    'content', m.content,
    'urgent', m.urgent,
    'createdAt', m.created_at
  ) order by m.created_at), '[]'::jsonb)
  into v_chat
  from (
    select *
    from public.care_chat_messages m0
    where m0.patient_id = v_patient_id
    order by m0.created_at desc
    limit 40
  ) m;

  return jsonb_build_object(
    'linked', true,
    'today', v_today,
    'patient', jsonb_build_object('id', v_patient_id, 'name', v_patient_name),
    'currentDoctor', case when v_doc_name is null then null else jsonb_build_object(
      'name', v_doc_name,
      'department', v_doc_dept,
      'hospitalId', v_doc_hospital_id,
      'hospitalName', v_doc_hospital_name
    ) end,
    'followup', v_followup,
    'plans', v_plans,
    'everyVisit', public.care_every_visit(),
    'chat', jsonb_build_object(
      'messages', v_chat,
      'remainingToday', greatest(0, 30 - v_sent_today),
      'dailyLimit', 30
    )
  );
end;
$$;

-- "This doesn't apply to me anymore": hides the plan in the app only.
create or replace function public.care_hide_plan(p_mobile text, p_plan_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid := public.care_linked_patient_id(p_mobile);
begin
  update public.care_plans
  set hidden_by_patient_at = now(), updated_at = now()
  where id = p_plan_id
    and patient_id = v_patient_id
    and status = 'active';
end;
$$;

create or replace function public.care_register_push_token(
  p_mobile text,
  p_token text,
  p_platform text,
  p_language text default 'en'
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_patient_id uuid := public.care_linked_patient_id(p_mobile);
begin
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,}\]$' then
    raise exception 'Invalid push token' using errcode = '22023';
  end if;
  if p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'Invalid platform' using errcode = '22023';
  end if;

  -- A phone's token must not stay attached to an older app session.
  delete from public.care_push_tokens t
  where t.expo_push_token = p_token
    and t.owner_user_id <> v_uid;

  insert into public.care_push_tokens
    (owner_user_id, patient_id, expo_push_token, platform, language, updated_at)
  values
    (v_uid, v_patient_id, p_token, p_platform, case when p_language = 'te' then 'te' else 'en' end, now())
  on conflict (owner_user_id, patient_id) do update
    set expo_push_token = excluded.expo_push_token,
        platform = excluded.platform,
        language = excluded.language,
        updated_at = now();
end;
$$;

-- Chat step 1 (called by the care-chat edge function with the user's
-- login): saves the question (max 30 a day) and returns the history
-- and the allowed context for the AI.
create or replace function public.care_chat_begin(p_mobile text, p_message text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_patient_id uuid := public.care_linked_patient_id(p_mobile);
  v_today date := public.care_today();
  v_message text := btrim(coalesce(p_message, ''));
  v_count integer;
  v_message_id uuid;
  v_history jsonb;
begin
  if char_length(v_message) = 0 or char_length(v_message) > 1000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('care_chat:' || v_patient_id::text, 0));

  select count(*)
  into v_count
  from public.care_chat_messages m
  where m.patient_id = v_patient_id
    and m.role = 'user'
    and (m.created_at at time zone 'Asia/Kolkata')::date = v_today;

  if v_count >= 30 then
    raise exception 'daily_limit' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('role', h.role, 'content', h.content) order by h.created_at), '[]'::jsonb)
  into v_history
  from (
    select m.role, m.content, m.created_at
    from public.care_chat_messages m
    where m.patient_id = v_patient_id
    order by m.created_at desc
    limit 10
  ) h;

  insert into public.care_chat_messages (patient_id, owner_user_id, role, content)
  values (v_patient_id, v_uid, 'user', v_message)
  returning id into v_message_id;

  return jsonb_build_object(
    'messageId', v_message_id,
    'remainingToday', 30 - v_count - 1,
    'history', v_history,
    'context', public.care_chat_context(v_patient_id)
  );
end;
$$;

-- Chat step 2: saves the AI reply.
create or replace function public.care_chat_finish(
  p_mobile text,
  p_message_id uuid,
  p_reply text,
  p_urgent boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_patient_id uuid := public.care_linked_patient_id(p_mobile);
  v_reply text := left(btrim(coalesce(p_reply, '')), 2000);
  v_row public.care_chat_messages;
begin
  if char_length(v_reply) = 0 then
    raise exception 'invalid_reply' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.care_chat_messages m
    where m.id = p_message_id
      and m.patient_id = v_patient_id
      and m.role = 'user'
  ) then
    raise exception 'unknown_message' using errcode = '22023';
  end if;

  if coalesce(p_urgent, false) then
    update public.care_chat_messages set urgent = true where id = p_message_id;
  end if;

  insert into public.care_chat_messages (patient_id, owner_user_id, role, content, urgent)
  values (v_patient_id, v_uid, 'assistant', v_reply, coalesce(p_urgent, false))
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'role', v_row.role,
    'content', v_row.content,
    'urgent', v_row.urgent,
    'createdAt', v_row.created_at
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 12. Nurse functions. ONLY the Doctor Studio server (service role)
--     can call these, after it has checked the nurse's signed cookie.
--     Every call re-checks the nurse is active and limits her to
--     patients of her own hospital.
-- ---------------------------------------------------------------------

create or replace function public.care_require_nurse(p_nurse_id uuid)
returns public.care_nurses
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nurse public.care_nurses;
begin
  select * into v_nurse
  from public.care_nurses n
  where n.id = p_nurse_id and n.is_active;

  if not found then
    raise exception 'nurse_inactive' using errcode = '42501';
  end if;

  return v_nurse;
end;
$$;

-- A hospital "has" a patient if it billed them or a nurse there added them.
create or replace function public.care_hospital_has_patient(p_hospital_id uuid, p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.care_hospital_patients hp
      where hp.hospital_id = p_hospital_id and hp.patient_id = p_patient_id
    )
    or exists (
      select 1 from public.patient_medicine_courses c
      where c.patient_id = p_patient_id
        and c.hospital_id = p_hospital_id
        and c.source = 'hospital'
    );
$$;

create or replace function public.care_assert_hospital_patient(p_hospital_id uuid, p_patient_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_patient_id is null or not public.care_hospital_has_patient(p_hospital_id, p_patient_id) then
    raise exception 'patient_not_at_hospital' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.care_link_hospital_patient(
  p_hospital_id uuid,
  p_patient_id uuid,
  p_nurse_id uuid
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.care_hospital_patients (hospital_id, patient_id, added_by_nurse_id)
  values (p_hospital_id, p_patient_id, p_nurse_id)
  on conflict (hospital_id, patient_id) do nothing;
$$;

-- Doctor picked from the hospital list, typed as "Other", or none.
create or replace function public.care_nurse_resolve_doctor(
  p_hospital_id uuid,
  p_care_doctor_id uuid,
  p_doctor_name text
)
returns table (care_doctor_id uuid, doctor_name text, department text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(coalesce(p_doctor_name, '')), '');
begin
  if p_care_doctor_id is not null then
    return query
      select d.id, d.display_name, d.department
      from public.care_doctors d
      where d.id = p_care_doctor_id
        and d.hospital_id = p_hospital_id
        and d.is_active;
    if not found then
      raise exception 'unknown_doctor' using errcode = '22023';
    end if;
    return;
  end if;

  if v_name is null then
    return query select null::uuid, null::text, 'general'::text;
    return;
  end if;

  if char_length(v_name) > 80 then
    raise exception 'invalid_doctor' using errcode = '22023';
  end if;

  return query
    select r.care_doctor_id, r.doctor_name, r.department
    from (
      select m.doctor_id as care_doctor_id, m.display_name as doctor_name, m.department, 0 as rank
      from public.care_match_doctor(p_hospital_id, v_name) m
      union all
      select null::uuid, v_name, 'general'::text, 1
    ) r
    order by r.rank
    limit 1;
end;
$$;

-- Login: mobile + 4-digit PIN. 5 wrong PINs = locked for 15 minutes.
create or replace function public.care_nurse_login(p_mobile text, p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_phone text := public.care_e164(p_mobile);
  v_nurse public.care_nurses;
  v_cred private.care_nurse_credentials;
  v_hospital_name text;
  v_failed integer;
  v_locked timestamptz;
begin
  if v_phone is null or coalesce(p_pin, '') !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_nurse from public.care_nurses n where n.phone = v_phone and n.is_active;
  if not found then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_cred from private.care_nurse_credentials c where c.nurse_id = v_nurse.id for update;
  if not found then
    return jsonb_build_object('ok', false);
  end if;

  if v_cred.locked_until is not null and v_cred.locked_until > now() then
    return jsonb_build_object('ok', false, 'lockedUntil', v_cred.locked_until);
  end if;

  if v_cred.pin_hash = extensions.crypt(p_pin, v_cred.pin_hash) then
    update private.care_nurse_credentials
    set failed_attempts = 0, locked_until = null, last_login_at = now(), updated_at = now()
    where nurse_id = v_nurse.id;

    select h.name into v_hospital_name from public.hospitals h where h.id = v_nurse.hospital_id;

    return jsonb_build_object('ok', true, 'nurse', jsonb_build_object(
      'id', v_nurse.id,
      'name', v_nurse.display_name,
      'hospitalId', v_nurse.hospital_id,
      'hospitalName', v_hospital_name
    ));
  end if;

  v_failed := v_cred.failed_attempts + 1;
  v_locked := case when v_failed >= 5 then now() + interval '15 minutes' end;

  update private.care_nurse_credentials
  set failed_attempts = case when v_locked is null then v_failed else 0 end,
      locked_until = v_locked,
      updated_at = now()
  where nurse_id = v_nurse.id;

  return jsonb_build_object('ok', false, 'lockedUntil', v_locked);
end;
$$;

create or replace function public.care_nurse_profile(p_nurse_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nurse public.care_nurses := public.care_require_nurse(p_nurse_id);
begin
  return jsonb_build_object(
    'today', public.care_today(),
    'nurse', jsonb_build_object('id', v_nurse.id, 'name', v_nurse.display_name),
    'hospital', (
      select jsonb_build_object('id', h.id, 'name', h.name)
      from public.hospitals h
      where h.id = v_nurse.hospital_id
    ),
    'doctors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'name', d.display_name,
        'department', d.department
      ) order by d.display_name)
      from public.care_doctors d
      where d.hospital_id = v_nurse.hospital_id and d.is_active
    ), '[]'::jsonb)
  );
end;
$$;

-- The nurse's patient screen. Plans are shown whichever hospital
-- started them (care continuity); follow-ups and doctor are this
-- hospital's only.
create or replace function public.care_nurse_patient(p_nurse_id uuid, p_patient_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nurse public.care_nurses := public.care_require_nurse(p_nurse_id);
  v_name text;
  v_mobile text;
  v_doc_name text;
  v_doc_id uuid;
  v_doc_dept text;
  v_doc_source text;
begin
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, p_patient_id);

  select p.name, p.mobile into v_name, v_mobile
  from public.patients p
  where p.id = p_patient_id;

  select d.doctor_name, d.care_doctor_id, d.department, d.source
  into v_doc_name, v_doc_id, v_doc_dept, v_doc_source
  from public.care_patient_current_doctor(p_patient_id, v_nurse.hospital_id) d;

  return jsonb_build_object(
    'today', public.care_today(),
    'patient', jsonb_build_object(
      'id', p_patient_id,
      'name', v_name,
      'mobile', v_mobile,
      'hospitalPatientId', (
        select hp.hospital_patient_id
        from public.care_hospital_patients hp
        where hp.hospital_id = v_nurse.hospital_id and hp.patient_id = p_patient_id
      )
    ),
    'doctor', case when v_doc_name is null then null else jsonb_build_object(
      'name', v_doc_name,
      'careDoctorId', v_doc_id,
      'department', coalesce(v_doc_dept, 'general'),
      'source', v_doc_source
    ) end,
    'lastFollowup', (
      select jsonb_build_object(
        'visitDate', f.visit_date,
        'nextDate', f.next_date,
        'note', f.note,
        'nurseName', f.nurse_name,
        'doctorName', f.doctor_name,
        'createdAt', f.created_at
      )
      from public.care_followups f
      where f.patient_id = p_patient_id and f.hospital_id = v_nurse.hospital_id
      order by f.created_at desc
      limit 1
    ),
    'plans', coalesce((
      select jsonb_agg(public.care_plan_view(p.id) order by p.plan_type desc, p.created_at)
      from public.care_plans p
      where p.patient_id = p_patient_id and p.status = 'active'
    ), '[]'::jsonb),
    'everyVisit', public.care_every_visit()
  );
end;
$$;

-- Exact search only: a 10-digit mobile or this hospital's patient ID.
-- Patients of other hospitals are reported as "not found".
create or replace function public.care_nurse_find(p_nurse_id uuid, p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nurse public.care_nurses := public.care_require_nurse(p_nurse_id);
  v_query text := btrim(coalesce(p_query, ''));
  v_mobile text;
  v_patient_id uuid;
begin
  if char_length(v_query) = 0 or char_length(v_query) > 40 then
    return jsonb_build_object('found', false);
  end if;

  if v_query ~ '^[+0-9 ()-]+$' then
    v_mobile := public.care_e164(v_query);
  end if;

  if v_mobile is not null then
    select p.id into v_patient_id from public.patients p where p.mobile = v_mobile;
    if v_patient_id is not null and public.care_hospital_has_patient(v_nurse.hospital_id, v_patient_id) then
      return jsonb_build_object('found', true, 'patientId', v_patient_id);
    end if;
  end if;

  select hp.patient_id into v_patient_id
  from public.care_hospital_patients hp
  where hp.hospital_id = v_nurse.hospital_id
    and hp.hospital_patient_id_normalized = nullif(upper(regexp_replace(v_query, '[^A-Za-z0-9]', '', 'g')), '');

  if v_patient_id is not null then
    return jsonb_build_object('found', true, 'patientId', v_patient_id);
  end if;

  return jsonb_build_object('found', false, 'mobile', v_mobile);
end;
$$;

-- "Add patient": created the same way a bill creates one (unclaimed
-- until the patient opens the app with that number).
create or replace function public.care_nurse_add_patient(
  p_nurse_id uuid,
  p_mobile text,
  p_name text,
  p_hospital_patient_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nurse public.care_nurses := public.care_require_nurse(p_nurse_id);
  v_mobile text := public.care_e164(p_mobile);
  v_name text := btrim(coalesce(p_name, ''));
  v_uhid text := nullif(btrim(coalesce(p_hospital_patient_id, '')), '');
  v_patient_id uuid;
begin
  if v_mobile is null then
    raise exception 'invalid_mobile' using errcode = '22023';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if v_uhid is not null and char_length(v_uhid) > 40 then
    raise exception 'invalid_hospital_id' using errcode = '22023';
  end if;

  insert into public.patients (mobile, name)
  values (v_mobile, v_name)
  on conflict (mobile) do update
    set name = coalesce(nullif(btrim(public.patients.name), ''), excluded.name)
  returning id into v_patient_id;

  begin
    insert into public.care_hospital_patients (hospital_id, patient_id, hospital_patient_id, added_by_nurse_id)
    values (v_nurse.hospital_id, v_patient_id, v_uhid, v_nurse.id)
    on conflict (hospital_id, patient_id) do update
      set hospital_patient_id = coalesce(public.care_hospital_patients.hospital_patient_id, excluded.hospital_patient_id),
          updated_at = now();
  exception when unique_violation then
    raise exception 'hospital_id_taken' using errcode = '23505';
  end;

  return public.care_nurse_patient(p_nurse_id, v_patient_id);
end;
$$;

create or replace function public.care_nurse_set_hospital_id(
  p_nurse_id uuid,
  p_patient_id uuid,
  p_hospital_patient_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nurse public.care_nurses := public.care_require_nurse(p_nurse_id);
  v_uhid text := nullif(btrim(coalesce(p_hospital_patient_id, '')), '');
begin
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, p_patient_id);
  if v_uhid is not null and char_length(v_uhid) > 40 then
    raise exception 'invalid_hospital_id' using errcode = '22023';
  end if;

  begin
    insert into public.care_hospital_patients (hospital_id, patient_id, hospital_patient_id, added_by_nurse_id)
    values (v_nurse.hospital_id, p_patient_id, v_uhid, v_nurse.id)
    on conflict (hospital_id, patient_id) do update
      set hospital_patient_id = excluded.hospital_patient_id,
          updated_at = now();
  exception when unique_violation then
    raise exception 'hospital_id_taken' using errcode = '23505';
  end;

  return public.care_nurse_patient(p_nurse_id, p_patient_id);
end;
$$;

-- "Pregnancy confirmed – start schedule". Give LMP or EDD.
create or replace function public.care_nurse_start_pregnancy(
  p_nurse_id uuid,
  p_patient_id uuid,
  p_mother_name text,
  p_lmp date,
  p_edd date,
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
  v_name text := btrim(coalesce(p_mother_name, ''));
  v_edd date;
  v_doctor_id uuid;
  v_doctor_name text;
  v_department text;
begin
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, p_patient_id);

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_lmp is null and p_edd is null then
    raise exception 'lmp_or_edd_required' using errcode = '22023';
  end if;
  if p_lmp is not null and (p_lmp > v_today or p_lmp < v_today - 300) then
    raise exception 'invalid_lmp' using errcode = '22023';
  end if;

  v_edd := coalesce(p_edd, p_lmp + 280);
  if v_edd < v_today - 28 or v_edd > v_today + 300 then
    raise exception 'invalid_edd' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.care_plans
    where patient_id = p_patient_id and plan_type = 'pregnancy' and status = 'active'
  ) then
    raise exception 'pregnancy_exists' using errcode = '23505';
  end if;

  select r.care_doctor_id, r.doctor_name, r.department
  into v_doctor_id, v_doctor_name, v_department
  from public.care_nurse_resolve_doctor(v_nurse.hospital_id, p_care_doctor_id, p_doctor_name) r;

  insert into public.care_plans
    (patient_id, plan_type, person_name, lmp_date, edd_date, hospital_id, doctor_name, care_doctor_id, started_by_nurse_id)
  values
    (p_patient_id, 'pregnancy', v_name, p_lmp, v_edd, v_nurse.hospital_id, v_doctor_name, v_doctor_id, v_nurse.id);

  perform public.care_link_hospital_patient(v_nurse.hospital_id, p_patient_id, v_nurse.id);
  return public.care_nurse_patient(p_nurse_id, p_patient_id);
end;
$$;

-- Correct the mother's name or the EDD (e.g. after a scan).
create or replace function public.care_nurse_update_pregnancy(
  p_nurse_id uuid,
  p_plan_id uuid,
  p_mother_name text default null,
  p_edd date default null
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
  v_patient_id uuid;
  v_name text := nullif(btrim(coalesce(p_mother_name, '')), '');
begin
  select p.patient_id into v_patient_id
  from public.care_plans p
  where p.id = p_plan_id and p.plan_type = 'pregnancy' and p.status = 'active';

  perform public.care_assert_hospital_patient(v_nurse.hospital_id, v_patient_id);

  if v_name is not null and (char_length(v_name) < 2 or char_length(v_name) > 80) then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_edd is not null and (p_edd < v_today - 28 or p_edd > v_today + 300) then
    raise exception 'invalid_edd' using errcode = '22023';
  end if;

  update public.care_plans
  set person_name = coalesce(v_name, person_name),
      edd_date = coalesce(p_edd, edd_date),
      updated_at = now()
  where id = p_plan_id;

  return public.care_nurse_patient(p_nurse_id, v_patient_id);
end;
$$;

create or replace function public.care_nurse_add_child(
  p_nurse_id uuid,
  p_patient_id uuid,
  p_child_name text,
  p_birth_date date,
  p_gender text default null,
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
  v_name text := btrim(coalesce(p_child_name, ''));
  v_gender text := nullif(btrim(coalesce(p_gender, '')), '');
  v_doctor_id uuid;
  v_doctor_name text;
  v_department text;
begin
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, p_patient_id);

  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_birth_date is null or p_birth_date > v_today or p_birth_date < (v_today - interval '18 years')::date then
    raise exception 'invalid_birth_date' using errcode = '22023';
  end if;
  if v_gender is not null and v_gender not in ('female', 'male') then
    raise exception 'invalid_gender' using errcode = '22023';
  end if;

  select r.care_doctor_id, r.doctor_name, r.department
  into v_doctor_id, v_doctor_name, v_department
  from public.care_nurse_resolve_doctor(v_nurse.hospital_id, p_care_doctor_id, p_doctor_name) r;

  insert into public.care_plans
    (patient_id, plan_type, person_name, birth_date, child_gender, hospital_id, doctor_name, care_doctor_id, started_by_nurse_id)
  values
    (p_patient_id, 'child', v_name, p_birth_date, v_gender, v_nurse.hospital_id, v_doctor_name, v_doctor_id, v_nurse.id);

  perform public.care_link_hospital_patient(v_nurse.hospital_id, p_patient_id, v_nurse.id);
  return public.care_nurse_patient(p_nurse_id, p_patient_id);
end;
$$;

-- Close a plan. Pregnancy: 'delivered' or 'ended'. Child: 'ended'.
create or replace function public.care_nurse_close_plan(
  p_nurse_id uuid,
  p_plan_id uuid,
  p_outcome text,
  p_date date
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
  v_plan public.care_plans;
begin
  select * into v_plan from public.care_plans p where p.id = p_plan_id and p.status = 'active';
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, v_plan.patient_id);

  if p_outcome is null
     or p_outcome not in ('delivered', 'ended')
     or (v_plan.plan_type = 'child' and p_outcome <> 'ended') then
    raise exception 'invalid_outcome' using errcode = '22023';
  end if;
  if p_date is null or p_date > v_today or p_date < v_today - 365 then
    raise exception 'invalid_date' using errcode = '22023';
  end if;

  update public.care_plans
  set status = p_outcome,
      closed_on = p_date,
      closed_by_nurse_id = v_nurse.id,
      updated_at = now()
  where id = p_plan_id;

  return public.care_nurse_patient(p_nurse_id, v_plan.patient_id);
end;
$$;

-- "Save": checklist ticks + next follow-up date + note, in one go.
-- p_items: [{"planId": "...", "itemId": "...", "status": "done" | "not_needed" | "clear"}]
create or replace function public.care_nurse_save_visit(
  p_nurse_id uuid,
  p_patient_id uuid,
  p_items jsonb,
  p_next_date date,
  p_note text,
  p_care_doctor_id uuid default null,
  p_doctor_name text default null,
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
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_item jsonb;
  v_plan_id uuid;
  v_item_id uuid;
  v_status text;
  v_doctor_id uuid;
  v_doctor_name text;
  v_department text;
begin
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, p_patient_id);

  if p_next_date is not null and (p_next_date < v_today or p_next_date > v_today + 400) then
    raise exception 'invalid_next_date' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;
  if p_plan_id is not null and not exists (
    select 1 from public.care_plans p where p.id = p_plan_id and p.patient_id = p_patient_id
  ) then
    raise exception 'unknown_plan' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_plan_id := (v_item ->> 'planId')::uuid;
    v_item_id := (v_item ->> 'itemId')::uuid;
    v_status := v_item ->> 'status';

    if not exists (
      select 1
      from public.care_plans p
      join public.care_schedule_visits sv on sv.plan_type = p.plan_type
      join public.care_schedule_items si on si.visit_id = sv.id
      where p.id = v_plan_id
        and p.patient_id = p_patient_id
        and p.status = 'active'
        and si.id = v_item_id
    ) then
      raise exception 'unknown_item' using errcode = '22023';
    end if;

    if v_status in ('done', 'not_needed') then
      insert into public.care_plan_items (plan_id, item_id, status, done_on, nurse_id, hospital_id, updated_at)
      values (v_plan_id, v_item_id, v_status, v_today, v_nurse.id, v_nurse.hospital_id, now())
      on conflict (plan_id, item_id) do update
        set status = excluded.status,
            done_on = excluded.done_on,
            nurse_id = excluded.nurse_id,
            hospital_id = excluded.hospital_id,
            updated_at = now();
    elsif v_status = 'clear' then
      delete from public.care_plan_items where plan_id = v_plan_id and item_id = v_item_id;
    else
      raise exception 'invalid_item_status' using errcode = '22023';
    end if;
  end loop;

  select r.care_doctor_id, r.doctor_name, r.department
  into v_doctor_id, v_doctor_name, v_department
  from public.care_nurse_resolve_doctor(v_nurse.hospital_id, p_care_doctor_id, p_doctor_name) r;

  insert into public.care_followups
    (patient_id, plan_id, hospital_id, nurse_id, nurse_name, doctor_name, care_doctor_id, department, visit_date, next_date, note)
  values
    (p_patient_id, p_plan_id, v_nurse.hospital_id, v_nurse.id, v_nurse.display_name, v_doctor_name, v_doctor_id,
     coalesce(v_department, 'general'), v_today, p_next_date, v_note);

  perform public.care_link_hospital_patient(v_nurse.hospital_id, p_patient_id, v_nurse.id);
  return public.care_nurse_patient(p_nurse_id, p_patient_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 13. Owner-only nurse admin (run these in the Supabase SQL editor):
--   select public.care_add_nurse('Dhruva Hospitals', 'Lakshmi', '9XXXXXXXXX', '4821');
--   select public.care_set_nurse_pin('9XXXXXXXXX', '7310');
--   select public.care_set_nurse_active('9XXXXXXXXX', false);
-- ---------------------------------------------------------------------

create or replace function public.care_add_nurse(
  p_hospital text,
  p_name text,
  p_mobile text,
  p_pin text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_phone text := public.care_e164(p_mobile);
  v_count integer;
  v_hospital_id uuid;
  v_nurse_id uuid;
begin
  if v_phone is null then
    raise exception 'Mobile must be a valid 10-digit Indian mobile number';
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  select count(*), min(h.id::text)::uuid
  into v_count, v_hospital_id
  from public.hospitals h
  where h.id::text = btrim(p_hospital)
     or lower(h.name) = lower(btrim(p_hospital))
     or lower(coalesce(h.code, '')) = lower(btrim(p_hospital))
     or h.normalized_name = public.normalize_hospital_name(p_hospital);

  if v_count = 0 then
    raise exception 'Hospital "%" not found', p_hospital;
  end if;
  if v_count > 1 then
    raise exception 'Hospital "%" matches more than one row; pass the hospital id instead', p_hospital;
  end if;

  insert into public.care_nurses (hospital_id, display_name, phone)
  values (v_hospital_id, btrim(p_name), v_phone)
  returning id into v_nurse_id;

  insert into private.care_nurse_credentials (nurse_id, pin_hash)
  values (v_nurse_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)));

  return v_nurse_id;
end;
$$;

create or replace function public.care_set_nurse_pin(p_mobile text, p_pin text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  update private.care_nurse_credentials c
  set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
      failed_attempts = 0,
      locked_until = null,
      updated_at = now()
  from public.care_nurses n
  where n.id = c.nurse_id and n.phone = public.care_e164(p_mobile);

  if not found then
    raise exception 'No nurse with mobile %', p_mobile;
  end if;
end;
$$;

create or replace function public.care_set_nurse_active(p_mobile text, p_active boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.care_nurses
  set is_active = coalesce(p_active, false), updated_at = now()
  where phone = public.care_e164(p_mobile);

  if not found then
    raise exception 'No nurse with mobile %', p_mobile;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 14. Follow-up reminders: 6 PM the day before ('eve') and 8 AM on the
--     day ('day'), India time. Sent straight to Expo's push service for
--     every linked device that registered a push token. Only the newest
--     follow-up per patient + hospital counts, so a changed date never
--     fires the old one. Android channel "care-followups", normal sound.
-- ---------------------------------------------------------------------

create or replace function public.care_send_followup_reminders(p_kind text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_target date;
  v_messages jsonb := '[]'::jsonb;
  v_count integer := 0;
  r record;
begin
  if p_kind is null or p_kind not in ('eve', 'day') then
    raise exception 'kind must be eve or day';
  end if;
  v_target := public.care_today() + case when p_kind = 'eve' then 1 else 0 end;

  for r in
    with newest as (
      select distinct on (f.patient_id, f.hospital_id)
        f.id, f.patient_id, f.hospital_id, f.next_date
      from public.care_followups f
      order by f.patient_id, f.hospital_id, f.created_at desc
    )
    select
      n.id as followup_id,
      n.next_date,
      h.name as hospital_name,
      t.owner_user_id,
      t.expo_push_token,
      t.language
    from newest n
    join public.hospitals h on h.id = n.hospital_id
    join public.care_push_tokens t on t.patient_id = n.patient_id
    join public.patient_device_links dl
      on dl.patient_id = t.patient_id and dl.owner_user_id = t.owner_user_id
    where n.next_date = v_target
      and not exists (
        select 1 from public.care_followup_reminder_log l
        where l.followup_id = n.id and l.kind = p_kind and l.owner_user_id = t.owner_user_id
      )
  loop
    insert into public.care_followup_reminder_log (followup_id, kind, owner_user_id)
    values (r.followup_id, p_kind, r.owner_user_id)
    on conflict do nothing;

    v_messages := v_messages || jsonb_build_array(jsonb_build_object(
      'to', r.expo_push_token,
      'title', case
        when r.language = 'te' and p_kind = 'eve' then 'రేపు హాస్పిటల్ సందర్శన'
        when r.language = 'te' then 'ఈరోజు హాస్పిటల్ సందర్శన'
        when p_kind = 'eve' then 'Hospital visit tomorrow'
        else 'Hospital visit today'
      end,
      'body', case
        when r.language = 'te' and p_kind = 'eve' then r.hospital_name || ' లో మీ ఫాలో-అప్ సందర్శన రేపు ఉంది.'
        when r.language = 'te' then r.hospital_name || ' లో మీ ఫాలో-అప్ సందర్శన ఈరోజు ఉంది.'
        when p_kind = 'eve' then 'Your follow-up visit at ' || r.hospital_name || ' is tomorrow, ' || to_char(r.next_date, 'Dy DD Mon') || '.'
        else 'Your follow-up visit at ' || r.hospital_name || ' is today.'
      end,
      'sound', 'default',
      'channelId', 'care-followups',
      'priority', 'high',
      'data', jsonb_build_object('type', 'care_followup', 'followupId', r.followup_id)
    ));
    v_count := v_count + 1;

    if jsonb_array_length(v_messages) >= 100 then
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := v_messages,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
        timeout_milliseconds := 10000
      );
      v_messages := '[]'::jsonb;
    end if;
  end loop;

  if jsonb_array_length(v_messages) > 0 then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_messages,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      timeout_milliseconds := 10000
    );
  end if;

  return v_count;
end;
$$;

-- pg_cron runs in UTC: 12:30 UTC = 6:00 PM IST, 02:30 UTC = 8:00 AM IST.
select cron.schedule('care-followup-eve', '30 12 * * *', $cron$select public.care_send_followup_reminders('eve');$cron$);
select cron.schedule('care-followup-day', '30 2 * * *', $cron$select public.care_send_followup_reminders('day');$cron$);

-- ---------------------------------------------------------------------
-- 15. Who may call what
-- ---------------------------------------------------------------------

-- Patient app (signed-in, linked device).
revoke all on function public.care_get_my_care(text) from public, anon;
revoke all on function public.care_hide_plan(text, uuid) from public, anon;
revoke all on function public.care_register_push_token(text, text, text, text) from public, anon;
revoke all on function public.care_chat_begin(text, text) from public, anon;
revoke all on function public.care_chat_finish(text, uuid, text, boolean) from public, anon;
grant execute on function public.care_get_my_care(text) to authenticated;
grant execute on function public.care_hide_plan(text, uuid) to authenticated;
grant execute on function public.care_register_push_token(text, text, text, text) to authenticated;
grant execute on function public.care_chat_begin(text, text) to authenticated;
grant execute on function public.care_chat_finish(text, uuid, text, boolean) to authenticated;

-- Doctor Studio server only.
revoke all on function public.care_nurse_login(text, text) from public, anon, authenticated;
revoke all on function public.care_nurse_profile(uuid) from public, anon, authenticated;
revoke all on function public.care_nurse_patient(uuid, uuid) from public, anon, authenticated;
revoke all on function public.care_nurse_find(uuid, text) from public, anon, authenticated;
revoke all on function public.care_nurse_add_patient(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.care_nurse_set_hospital_id(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.care_nurse_start_pregnancy(uuid, uuid, text, date, date, uuid, text) from public, anon, authenticated;
revoke all on function public.care_nurse_update_pregnancy(uuid, uuid, text, date) from public, anon, authenticated;
revoke all on function public.care_nurse_add_child(uuid, uuid, text, date, text, uuid, text) from public, anon, authenticated;
revoke all on function public.care_nurse_close_plan(uuid, uuid, text, date) from public, anon, authenticated;
revoke all on function public.care_nurse_save_visit(uuid, uuid, jsonb, date, text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.care_nurse_login(text, text) to service_role;
grant execute on function public.care_nurse_profile(uuid) to service_role;
grant execute on function public.care_nurse_patient(uuid, uuid) to service_role;
grant execute on function public.care_nurse_find(uuid, text) to service_role;
grant execute on function public.care_nurse_add_patient(uuid, text, text, text) to service_role;
grant execute on function public.care_nurse_set_hospital_id(uuid, uuid, text) to service_role;
grant execute on function public.care_nurse_start_pregnancy(uuid, uuid, text, date, date, uuid, text) to service_role;
grant execute on function public.care_nurse_update_pregnancy(uuid, uuid, text, date) to service_role;
grant execute on function public.care_nurse_add_child(uuid, uuid, text, date, text, uuid, text) to service_role;
grant execute on function public.care_nurse_close_plan(uuid, uuid, text, date) to service_role;
grant execute on function public.care_nurse_save_visit(uuid, uuid, jsonb, date, text, uuid, text, uuid) to service_role;

-- Latest doctor + department from bills (server use).
revoke all on function public.care_patient_latest_doctor(uuid, uuid) from public, anon, authenticated;
grant execute on function public.care_patient_latest_doctor(uuid, uuid) to service_role;

-- Internal building blocks: nobody calls these directly.
revoke all on function public.care_match_doctor(uuid, text) from public, anon, authenticated;
revoke all on function public.care_plan_view(uuid) from public, anon, authenticated;
revoke all on function public.care_every_visit() from public, anon, authenticated;
revoke all on function public.care_patient_current_doctor(uuid, uuid) from public, anon, authenticated;
revoke all on function public.care_linked_patient_id(text) from public, anon, authenticated;
revoke all on function public.care_chat_context(uuid) from public, anon, authenticated;
revoke all on function public.care_require_nurse(uuid) from public, anon, authenticated;
revoke all on function public.care_hospital_has_patient(uuid, uuid) from public, anon, authenticated;
revoke all on function public.care_assert_hospital_patient(uuid, uuid) from public, anon, authenticated;
revoke all on function public.care_link_hospital_patient(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.care_nurse_resolve_doctor(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.care_send_followup_reminders(text) from public, anon, authenticated;

-- Owner only (SQL editor).
revoke all on function public.care_add_nurse(text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.care_set_nurse_pin(text, text) from public, anon, authenticated, service_role;
revoke all on function public.care_set_nurse_active(text, boolean) from public, anon, authenticated, service_role;

commit;
