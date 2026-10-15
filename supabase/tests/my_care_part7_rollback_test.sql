-- My Care part 7 test: nurse removes a patient from the hospital list.
-- Safe on production: rolled back.
begin;

create temp table t_results (seq serial, name text, ok boolean, detail text) on commit drop;

do $$
declare
  v_nurse uuid;
  v_other uuid;
  v_patient uuid;
  v_view jsonb;
  v_plan_id uuid;
  v_dir jsonb;
  v_res jsonb;
  v_text text;
begin
  v_nurse := public.care_add_nurse('DHRUVA', 'Remove Test Nurse', '9999811194', '1234');
  v_other := public.care_add_nurse('SHANKAR', 'Remove Other Nurse', '9999811195', '1234');
  v_view := public.care_nurse_add_patient(v_nurse, '9999800091', 'Remove Test Parent', null);
  v_patient := (v_view -> 'patient' ->> 'id')::uuid;
  v_view := public.care_nurse_add_child(v_nurse, v_patient, 'Baby', public.care_today() - 30, null, null, null);
  select (p ->> 'id')::uuid into v_plan_id from jsonb_array_elements(v_view -> 'plans') p limit 1;
  insert into public.care_followups (patient_id, hospital_id, nurse_name, next_date)
  select v_patient, n.hospital_id, 'Remove Test Nurse', public.care_today() + 5 from public.care_nurses n where n.id = v_nurse;

  begin
    perform public.care_nurse_remove_patient(v_other, v_patient);
    insert into t_results values (default, 'another hospital cannot remove', false, 'removed');
  exception when others then
    insert into t_results values (default, 'another hospital cannot remove', sqlerrm = 'patient_not_at_hospital', sqlerrm);
  end;

  v_res := public.care_nurse_remove_patient(v_nurse, v_patient);
  insert into t_results values (default, 'remove ends the child plan', (v_res ->> 'endedPlans')::int = 1, v_res::text);

  v_dir := public.care_nurse_directory(v_nurse);
  insert into t_results values (default, 'removed patient leaves the list',
    not exists (select 1 from jsonb_array_elements(v_dir) e where e ->> 'id' = v_patient::text), 'list');

  select status into v_text from public.care_plans where id = v_plan_id;
  insert into t_results values (default, 'plan ended', v_text = 'ended', v_text);
  insert into t_results values (default, 'next visit cleared',
    not exists (select 1 from public.care_followups f where f.patient_id = v_patient and f.next_date is not null), 'followups');
  insert into t_results values (default, 'patient record kept', exists (select 1 from public.patients where id = v_patient), 'patients');

  -- Added again by mobile: back on the list.
  perform public.care_nurse_add_patient(v_nurse, '9999800091', 'Remove Test Parent', null);
  v_dir := public.care_nurse_directory(v_nurse);
  insert into t_results values (default, 'adding again brings the patient back',
    exists (select 1 from jsonb_array_elements(v_dir) e where e ->> 'id' = v_patient::text), 'list');

  insert into t_results values (default, 'grants: server only',
    has_function_privilege('service_role', 'public.care_nurse_remove_patient(uuid, uuid)', 'execute')
      and not has_function_privilege('authenticated', 'public.care_nurse_remove_patient(uuid, uuid)', 'execute')
      and not has_table_privilege('authenticated', 'public.care_hospital_hidden_patients', 'select'), 'grants');
end;
$$;

select jsonb_agg(jsonb_build_object('ok', ok, 'test', name, 'detail', detail) order by seq) as results from t_results;

rollback;
