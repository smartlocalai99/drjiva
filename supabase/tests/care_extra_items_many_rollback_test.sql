-- Nurse adds several tests at once (safe on production: rolled back).
begin;

create temp table t_results (seq serial, name text, ok boolean, detail text) on commit drop;

do $$
declare
  v_nurse uuid;
  v_other uuid;
  v_patient uuid;
  v_view jsonb;
  v_today date := public.care_today();
  v_n int;
  v_text text;
begin
  v_nurse := public.care_add_nurse('DHRUVA', 'Many Tests Nurse', '9999811196', '1234');
  v_other := public.care_add_nurse('SHANKAR', 'Many Tests Other', '9999811197', '1234');
  v_view := public.care_nurse_add_patient(v_nurse, '9999800093', 'Many Tests Patient', null);
  v_patient := (v_view -> 'patient' ->> 'id')::uuid;

  v_view := public.care_nurse_add_extra_items(v_nurse, v_patient,
    array['TSH (thyroid)', '  CBP   (complete blood picture) ', 'tsh (thyroid)', '', 'Vitamin D'], v_today + 7, false, null);
  select count(*), string_agg(label, ' | ' order by created_at, label) into v_n, v_text
  from public.care_extra_items where patient_id = v_patient;
  insert into t_results values (default, 'three tests saved, repeats and blanks skipped', v_n = 3, v_text);
  insert into t_results values (default, 'spaces tidied',
    exists (select 1 from public.care_extra_items where patient_id = v_patient and label = 'CBP (complete blood picture)'), v_text);
  insert into t_results values (default, 'page view comes back with the tests',
    jsonb_array_length(v_view -> 'extraItems') = 3, (v_view -> 'extraItems')::text);

  perform public.care_nurse_add_extra_items(v_nurse, v_patient, array['Urine routine', 'HbA1c'], v_today, true, null);
  select count(*) into v_n from public.care_extra_items where patient_id = v_patient and status = 'done' and done_on = v_today;
  insert into t_results values (default, 'done today saves both as done', v_n = 2, v_n::text);

  begin
    perform public.care_nurse_add_extra_items(v_nurse, v_patient, array['', ' '], v_today, false, null);
    insert into t_results values (default, 'empty list refused', false, 'saved');
  exception when others then
    insert into t_results values (default, 'empty list refused', sqlerrm = 'invalid_test_name', sqlerrm);
  end;

  begin
    perform public.care_nurse_add_extra_items(v_nurse, v_patient, array['CRP', 'X'], v_today, false, null);
    insert into t_results values (default, 'one bad name saves nothing', false, 'saved');
  exception when others then
    insert into t_results values (default, 'one bad name saves nothing',
      sqlerrm = 'invalid_test_name' and not exists (select 1 from public.care_extra_items where patient_id = v_patient and label = 'CRP'), sqlerrm);
  end;

  begin
    perform public.care_nurse_add_extra_items(v_nurse, v_patient, array['Future test'], v_today + 3, true, null);
    insert into t_results values (default, 'done in the future refused', false, 'saved');
  exception when others then
    insert into t_results values (default, 'done in the future refused', sqlerrm = 'invalid_test_date', sqlerrm);
  end;

  begin
    perform public.care_nurse_add_extra_items(v_other, v_patient, array['CRP'], v_today, false, null);
    insert into t_results values (default, 'another hospital cannot add', false, 'saved');
  exception when others then
    insert into t_results values (default, 'another hospital cannot add', sqlerrm = 'patient_not_at_hospital', sqlerrm);
  end;

  insert into t_results values (default, 'grants: server only',
    has_function_privilege('service_role', 'public.care_nurse_add_extra_items(uuid, uuid, text[], date, boolean, uuid)', 'execute')
      and not has_function_privilege('authenticated', 'public.care_nurse_add_extra_items(uuid, uuid, text[], date, boolean, uuid)', 'execute')
      and not has_function_privilege('anon', 'public.care_nurse_add_extra_items(uuid, uuid, text[], date, boolean, uuid)', 'execute'), 'grants');
end;
$$;

select jsonb_agg(jsonb_build_object('ok', ok, 'test', name, 'detail', detail) order by seq) as results from t_results;

rollback;
