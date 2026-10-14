-- My Care, part 7: on the nurse's patient list, a patient belongs to every
-- doctor who looks after her, not only the latest one. A mother seen by
-- the gynecologist whose baby gets vaccines from the pediatrician shows in
-- both doctors' lists. New key `doctorIds`; `doctorId` (the latest) stays.
--
-- Doctors of a patient: each active pregnancy / child plan, each active
-- cycle, the latest nurse follow-up and the latest pharmacy bill.
-- Still one set-based query per hospital (cached 2 minutes on the server).

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
