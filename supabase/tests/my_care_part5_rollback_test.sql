-- My Care part 5 test: OI-TI / IUI cycles + doctor on the patient list
-- (safe on production: rolled back).
begin;

create temp table t_results (seq serial, name text, ok boolean, detail text) on commit drop;

do $$
declare
  v_nurse uuid;
  v_other uuid;
  v_patient uuid;
  v_view jsonb;
  v_cycle jsonb;
  v_cycle_id uuid;
  v_anchor date := public.care_today() - 3;
  v_trigger uuid;
  v_iui uuid;
  v_step jsonb;
  v_mounika uuid;
  v_dir jsonb;
  v_uid uuid := gen_random_uuid();
  v_app jsonb;
  v_text text;
begin
  select id into v_mounika from public.care_doctors where display_name = 'Dr. Mounika';
  v_nurse := public.care_add_nurse('DHRUVA', 'Cycle Nurse', '9999911192', '1234');
  v_other := public.care_add_nurse('SHANKAR', 'Other Nurse', '9999911191', '1234');
  v_view := public.care_nurse_add_patient(v_nurse, '9999900051', 'Cycle Wife', null);
  v_patient := (v_view -> 'patient' ->> 'id')::uuid;

  v_view := public.care_nurse_start_cycle(v_nurse, v_patient, 'oi_ti_iui', 'Cycle Wife', 'Cycle Husband', v_anchor, v_mounika, null);
  v_cycle := v_view -> 'cycles' -> 0;
  v_cycle_id := (v_cycle ->> 'id')::uuid;
  insert into t_results values (default, 'cycle started with 11 steps', jsonb_array_length(v_cycle -> 'steps') = 11 and v_cycle ->> 'doctorName' = 'Dr. Mounika', v_cycle ->> 'doctorName');
  insert into t_results values (default, 'cycle carries the hospital phone and logo', v_cycle ? 'hospitalPhone' and v_cycle ? 'hospitalLogoUrl', v_cycle::text);

  select s into v_step from jsonb_array_elements(v_cycle -> 'steps') s where s ->> 'code' = 'oi_baseline_scan';
  insert into t_results values (default, 'Day 2 = Day 1 + 1', (v_step ->> 'date')::date = v_anchor + 1, v_step ->> 'date');
  select s into v_step from jsonb_array_elements(v_cycle -> 'steps') s where s ->> 'code' = 'oi_urine_pregnancy_test';
  insert into t_results values (default, 'Day 31 = Day 1 + 30', (v_step ->> 'date')::date = v_anchor + 30, v_step ->> 'date');
  select (s ->> 'id')::uuid into v_trigger from jsonb_array_elements(v_cycle -> 'steps') s where s ->> 'code' = 'oi_trigger';
  select s into v_step from jsonb_array_elements(v_cycle -> 'steps') s where s ->> 'code' = 'oi_iui';
  v_iui := (v_step ->> 'id')::uuid;
  insert into t_results values (default, 'IUI = trigger + 1 (Day 14)', (v_step ->> 'date')::date = v_anchor + 13 and v_step ->> 'linkedStepId' = v_trigger::text, v_step::text);
  select s into v_step from jsonb_array_elements(v_cycle -> 'steps') s where s ->> 'code' = 'oi_semen_analysis';
  insert into t_results values (default, 'semen analysis is for the husband, with the note',
    v_step ->> 'who' = 'husband' and v_step ->> 'noteEn' like 'Avoid intercourse%', v_step ->> 'who');

  -- Trigger moved a day later: IUI follows.
  perform public.care_nurse_set_cycle_steps(v_nurse, v_patient,
    jsonb_build_array(jsonb_build_object('cycleId', v_cycle_id, 'stepId', v_trigger, 'date', v_anchor + 13)));
  v_cycle := public.care_cycle_view(v_cycle_id);
  select s into v_step from jsonb_array_elements(v_cycle -> 'steps') s where s ->> 'code' = 'oi_iui';
  insert into t_results values (default, 'trigger moved to Day 14 -> IUI on Day 15', (v_step ->> 'date')::date = v_anchor + 14, v_step ->> 'date');

  -- Tick done, then clear.
  perform public.care_nurse_set_cycle_steps(v_nurse, v_patient,
    jsonb_build_array(jsonb_build_object('cycleId', v_cycle_id, 'stepId', (select (s ->> 'id')::uuid from jsonb_array_elements(v_cycle -> 'steps') s where s ->> 'code' = 'oi_baseline_scan'), 'status', 'done')));
  v_cycle := public.care_cycle_view(v_cycle_id);
  select s into v_step from jsonb_array_elements(v_cycle -> 'steps') s where s ->> 'code' = 'oi_baseline_scan';
  insert into t_results values (default, 'step ticked done by the nurse', v_step ->> 'status' = 'done' and v_step ->> 'nurseName' = 'Cycle Nurse', v_step::text);
  perform public.care_nurse_set_cycle_steps(v_nurse, v_patient,
    jsonb_build_array(jsonb_build_object('cycleId', v_cycle_id, 'stepId', v_trigger, 'date', null)));
  insert into t_results values (default, 'clearing the date removes the record',
    not exists (select 1 from public.care_cycle_step_records where cycle_id = v_cycle_id and step_id = v_trigger), 'cleared');

  begin
    perform public.care_nurse_start_cycle(v_nurse, v_patient, 'oi_ti_iui', 'Cycle Wife', null, v_anchor, null, null);
    insert into t_results values (default, 'second active cycle refused', false, 'accepted');
  exception when others then
    insert into t_results values (default, 'second active cycle refused', sqlerrm = 'cycle_exists', sqlerrm);
  end;
  begin
    perform public.care_nurse_set_cycle_steps(v_other, v_patient, jsonb_build_array(jsonb_build_object('cycleId', v_cycle_id, 'stepId', v_trigger, 'status', 'done')));
    insert into t_results values (default, 'other hospital refused', false, 'accepted');
  exception when others then
    insert into t_results values (default, 'other hospital refused', sqlerrm = 'patient_not_at_hospital', sqlerrm);
  end;

  -- Patient list carries the doctor.
  v_dir := public.care_nurse_directory(v_nurse);
  select e ->> 'doctorId' into v_text from jsonb_array_elements(v_dir) e where e ->> 'id' = v_patient::text;
  insert into t_results values (default, 'patient list shows her doctor (Mounika)', v_text = v_mounika::text, coalesce(v_text, 'null'));

  -- Her baby's vaccines with the pediatrician: she shows in both lists.
  insert into public.care_followups (patient_id, hospital_id, nurse_name, doctor_name, care_doctor_id, department, next_date, created_at)
  select v_patient, n.hospital_id, 'Cycle Nurse', d.display_name, d.id, 'pediatrics', public.care_today() + 7, now() + interval '1 minute'
  from public.care_nurses n, public.care_doctors d
  where n.id = v_nurse and d.display_name = 'Dr. Sudarshan Reddy';
  v_dir := public.care_nurse_directory(v_nurse);
  select e into v_step from jsonb_array_elements(v_dir) e where e ->> 'id' = v_patient::text;
  insert into t_results values (default, 'patient of two doctors is in both lists',
    jsonb_array_length(v_step -> 'doctorIds') = 2
      and (v_step -> 'doctorIds') ? v_mounika::text
      and (v_step -> 'doctorIds') ? (select id::text from public.care_doctors where display_name = 'Dr. Sudarshan Reddy')
      and v_step ->> 'doctorId' = (select id::text from public.care_doctors where display_name = 'Dr. Sudarshan Reddy'),
    v_step::text);

  -- Patient app sees the cycle.
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
  insert into public.patient_device_links (patient_id, owner_user_id) values (v_patient, v_uid);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  v_app := public.care_get_my_care_v2('9999900051');
  insert into t_results values (default, 'app gets the cycle', jsonb_array_length(v_app -> 'cycles') = 1 and v_app -> 'cycles' -> 0 ->> 'protocol' = 'oi_ti_iui', coalesce(v_app -> 'cycles', 'null')::text);

  -- "Ask DrJiva" knows the treatment day and steps, never the names.
  v_text := public.care_chat_begin('9999900051', 'When is my IUI?') -> 'context' -> 'cycle' ->> 'dayOfCycle';
  insert into t_results values (default, 'chat knows the treatment day', v_text = '4', coalesce(v_text, 'null'));
  v_step := public.care_chat_cycle_context(v_patient);
  insert into t_results values (default, 'chat gets every step, no names',
    jsonb_array_length(v_step -> 'steps') = 11 and v_step::text not like '%Cycle Wife%' and v_step::text not like '%Cycle Husband%', v_step::text);

  -- Close.
  v_view := public.care_nurse_close_cycle(v_nurse, v_cycle_id, 'positive', public.care_today());
  insert into t_results values (default, 'closed cycle leaves the page', jsonb_array_length(v_view -> 'cycles') = 0, (v_view -> 'cycles')::text);

  insert into t_results values (default, 'grants: nurse functions server-only, tables closed',
    has_function_privilege('service_role', 'public.care_nurse_start_cycle(uuid, uuid, text, text, text, date, uuid, text)', 'execute')
      and not has_function_privilege('authenticated', 'public.care_nurse_set_cycle_steps(uuid, uuid, jsonb)', 'execute')
      and not has_function_privilege('authenticated', 'public.care_cycle_view(uuid)', 'execute')
      and not has_function_privilege('authenticated', 'public.care_chat_cycle_context(uuid)', 'execute')
      and has_function_privilege('authenticated', 'public.care_chat_begin(text, text)', 'execute')
      and not has_table_privilege('authenticated', 'public.care_cycles', 'select'), 'grants');
end;
$$;

select jsonb_agg(jsonb_build_object('ok', ok, 'test', name, 'detail', detail) order by seq) as results from t_results;

rollback;
