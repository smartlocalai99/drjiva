-- My Care, part 10: the nurse sees vaccines a parent recorded in the app
-- (Child Growth Chart), so a dose given elsewhere is not shown as missed.
-- New body for care_nurse_patient_v2 (part 5) plus one key.

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
      ), '[]'::jsonb),
      'vaccineRecords', coalesce((
        select jsonb_agg(rec order by rec ->> 'givenOn')
        from public.care_plans p
        cross join lateral jsonb_array_elements(public.care_vaccine_record_json(p.id)) rec
        where p.patient_id = p_patient_id
          and p.hospital_id = v_nurse.hospital_id
          and p.plan_type = 'child'
          and p.status = 'active'
      ), '[]'::jsonb)
    );
end;
$$;
