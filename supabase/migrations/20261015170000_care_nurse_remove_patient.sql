-- Nurse desk, part 11: "Remove patient" (swipe on the patient list).
-- A patient's record is shared by the whole app (login, medicines, other
-- hospitals), so nothing is deleted. Removing takes the patient off this
-- hospital's list and stops this hospital's care for them: active
-- pregnancy / child plans end, an active cycle stops, the next visit date
-- is cleared (no more reminders). Adding the mobile number again brings
-- them back. Additions only: one table, one function, new bodies for
-- care_nurse_add_patient and care_nurse_directory.

create table if not exists public.care_hospital_hidden_patients (
  hospital_id uuid not null references public.hospitals (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  hidden_by_nurse_id uuid references public.care_nurses (id) on delete set null,
  hidden_at timestamptz not null default now(),
  primary key (hospital_id, patient_id)
);

alter table public.care_hospital_hidden_patients enable row level security;
revoke all on table public.care_hospital_hidden_patients from public, anon, authenticated;

create or replace function public.care_nurse_remove_patient(p_nurse_id uuid, p_patient_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nurse public.care_nurses := public.care_require_nurse(p_nurse_id);
  v_today date := public.care_today();
  v_plans integer;
  v_cycles integer;
begin
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, p_patient_id);

  insert into public.care_hospital_hidden_patients (hospital_id, patient_id, hidden_by_nurse_id)
  values (v_nurse.hospital_id, p_patient_id, v_nurse.id)
  on conflict (hospital_id, patient_id) do update
    set hidden_by_nurse_id = excluded.hidden_by_nurse_id, hidden_at = now();

  update public.care_plans
  set status = 'ended', closed_on = v_today, closed_by_nurse_id = v_nurse.id, updated_at = now()
  where patient_id = p_patient_id and hospital_id = v_nurse.hospital_id and status = 'active';
  get diagnostics v_plans = row_count;

  update public.care_cycles
  set status = 'stopped', closed_on = v_today, updated_at = now()
  where patient_id = p_patient_id and hospital_id = v_nurse.hospital_id and status = 'active';
  get diagnostics v_cycles = row_count;

  update public.care_followups
  set next_date = null
  where patient_id = p_patient_id and hospital_id = v_nurse.hospital_id and next_date >= v_today;

  return jsonb_build_object('removed', true, 'endedPlans', v_plans, 'stoppedCycles', v_cycles);
end;
$$;

create or replace function public.care_nurse_add_patient(p_nurse_id uuid, p_mobile text, p_name text, p_hospital_patient_id text default null)
returns jsonb
language plpgsql
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

  -- Added again after being removed: back on the list.
  delete from public.care_hospital_hidden_patients hh
  where hh.hospital_id = v_nurse.hospital_id and hh.patient_id = v_patient_id;

  return public.care_nurse_patient(p_nurse_id, v_patient_id);
end;
$$;

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
      -- Patients the nurse removed from the list stay out of it.
      where not exists (
        select 1 from public.care_hospital_hidden_patients hh
        where hh.hospital_id = v_nurse.hospital_id and hh.patient_id = x.patient_id
      )
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
    followup_last as (
      select distinct on (f.patient_id) f.patient_id, f.care_doctor_id, f.created_at
      from public.care_followups f
      where f.hospital_id = v_nurse.hospital_id and f.care_doctor_id is not null
      order by f.patient_id, f.created_at desc
    ),
    links as (
      select fl.patient_id, fl.care_doctor_id, fl.created_at
      from followup_last fl
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
    ),
    doctors as (
      select
        l.patient_id,
        (array_agg(l.care_doctor_id order by l.created_at desc))[1] as care_doctor_id,
        jsonb_agg(distinct l.care_doctor_id) as doctor_ids
      from links l
      group by l.patient_id
    )
    select jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'mobile', p.mobile,
        'hospitalPatientId', hp.hospital_patient_id,
        'lastSeen', s.last_seen,
        'doctorId', dr.care_doctor_id,
        'doctorIds', coalesce(dr.doctor_ids, '[]'::jsonb)
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

revoke all on function public.care_nurse_remove_patient(uuid, uuid) from public, anon, authenticated;
grant execute on function public.care_nurse_remove_patient(uuid, uuid) to service_role;
