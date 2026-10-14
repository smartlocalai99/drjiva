-- My Care part 3 test: timeline dates (safe on production: rolled back).
begin;

create temp table t_results (seq serial, name text, ok boolean, detail text) on commit drop;

do $$
declare
  v_nurse uuid;
  v_other uuid;
  v_patient uuid;
  v_plan uuid;
  v_visit uuid;
  v_child_visit uuid;
  v_view jsonb;
  v_extra uuid;
  v_today date := public.care_today();
  v_text text;
begin
  v_nurse := public.care_add_nurse('DHRUVA', 'Dates Nurse', '9999911196', '1234');
  v_other := public.care_add_nurse('SHANKAR', 'Other Nurse', '9999911195', '1234');
  v_view := public.care_nurse_add_patient(v_nurse, '9999900031', 'Dates Patient', null);
  v_patient := (v_view -> 'patient' ->> 'id')::uuid;
  v_view := public.care_nurse_start_pregnancy(v_nurse, v_patient, 'Dates Patient', v_today - 70, null, null, null);
  v_plan := (v_view -> 'plans' -> 0 ->> 'id')::uuid;
  v_visit := (v_view -> 'plans' -> 0 -> 'visits' -> 2 ->> 'id')::uuid;
  select id into v_child_visit from public.care_schedule_visits where plan_type = 'child' limit 1;

  perform public.care_nurse_set_dates(v_nurse, v_patient,
    jsonb_build_array(jsonb_build_object('planId', v_plan, 'visitId', v_visit, 'date', v_today + 20)), '[]'::jsonb);
  v_view := public.care_nurse_patient_v2(v_nurse, v_patient);
  insert into t_results values (default, 'visit date saved and returned',
    v_view -> 'visitDates' -> 0 ->> 'date' = (v_today + 20)::text and v_view -> 'visitDates' -> 0 ->> 'nurseName' = 'Dates Nurse',
    coalesce(v_view -> 'visitDates', 'null')::text);
  insert into t_results values (default, 'page still has plans + extra tests', v_view ? 'plans' and v_view ? 'extraItems', 'keys');

  perform public.care_nurse_set_dates(v_nurse, v_patient,
    jsonb_build_array(jsonb_build_object('planId', v_plan, 'visitId', v_visit, 'date', v_today + 25)), '[]'::jsonb);
  select planned_date::text into v_text from public.care_plan_visit_dates where plan_id = v_plan and visit_id = v_visit;
  insert into t_results values (default, 'visit date changed', v_text = (v_today + 25)::text, v_text);

  perform public.care_nurse_set_dates(v_nurse, v_patient,
    jsonb_build_array(jsonb_build_object('planId', v_plan, 'visitId', v_visit, 'date', null)), '[]'::jsonb);
  insert into t_results values (default, 'visit date removed',
    not exists (select 1 from public.care_plan_visit_dates where plan_id = v_plan), 'removed');

  begin
    perform public.care_nurse_set_dates(v_nurse, v_patient,
      jsonb_build_array(jsonb_build_object('planId', v_plan, 'visitId', v_child_visit, 'date', v_today + 5)), '[]'::jsonb);
    insert into t_results values (default, 'child visit on a pregnancy refused', false, 'accepted');
  exception when others then
    insert into t_results values (default, 'child visit on a pregnancy refused', sqlerrm = 'unknown_plan', sqlerrm);
  end;
  begin
    perform public.care_nurse_set_dates(v_nurse, v_patient,
      jsonb_build_array(jsonb_build_object('planId', v_plan, 'visitId', v_visit, 'date', v_today + 3000)), '[]'::jsonb);
    insert into t_results values (default, 'far date refused', false, 'accepted');
  exception when others then
    insert into t_results values (default, 'far date refused', sqlerrm = 'invalid_visit_date', sqlerrm);
  end;
  begin
    perform public.care_nurse_set_dates(v_other, v_patient,
      jsonb_build_array(jsonb_build_object('planId', v_plan, 'visitId', v_visit, 'date', v_today + 5)), '[]'::jsonb);
    insert into t_results values (default, 'other hospital refused', false, 'accepted');
  exception when others then
    insert into t_results values (default, 'other hospital refused', sqlerrm = 'patient_not_at_hospital', sqlerrm);
  end;

  -- Extra test date moved.
  v_view := public.care_nurse_add_extra_item(v_nurse, v_patient, 'TSH (thyroid)', v_today + 7, false, null);
  v_extra := (v_view -> 'extraItems' -> 0 ->> 'id')::uuid;
  perform public.care_nurse_set_dates(v_nurse, v_patient, '[]'::jsonb, jsonb_build_array(jsonb_build_object('id', v_extra, 'date', v_today + 14)));
  select due_date::text into v_text from public.care_extra_items where id = v_extra;
  insert into t_results values (default, 'extra test date moved', v_text = (v_today + 14)::text, v_text);

  insert into t_results values (default, 'grants: server only',
    has_function_privilege('service_role', 'public.care_nurse_set_dates(uuid, uuid, jsonb, jsonb)', 'execute')
      and not has_function_privilege('authenticated', 'public.care_nurse_set_dates(uuid, uuid, jsonb, jsonb)', 'execute')
      and not has_table_privilege('authenticated', 'public.care_plan_visit_dates', 'select'), 'grants');
end;
$$;

select jsonb_agg(jsonb_build_object('ok', ok, 'test', name, 'detail', detail) order by seq) as results from t_results;

rollback;
