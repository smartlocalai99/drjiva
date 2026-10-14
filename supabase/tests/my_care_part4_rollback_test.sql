-- My Care part 4 test: hospital schedules (safe on production: rolled back).
begin;

create temp table t_results (seq serial, name text, ok boolean, detail text) on commit drop;

do $$
declare
  v_dhruva_nurse uuid;
  v_shankar_nurse uuid;
  v_patient uuid;
  v_other uuid;
  v_view jsonb;
  v_plan jsonb;
  v_today date := public.care_today();
  v_codes text;
  v_item uuid;
begin
  v_dhruva_nurse := public.care_add_nurse('DHRUVA', 'Sched Nurse', '9999911194', '1234');
  v_shankar_nurse := public.care_add_nurse('SHANKAR', 'Sched Nurse 2', '9999911193', '1234');

  v_view := public.care_nurse_add_patient(v_dhruva_nurse, '9999900041', 'Dhruva Mother', null);
  v_patient := (v_view -> 'patient' ->> 'id')::uuid;
  v_view := public.care_nurse_start_pregnancy(v_dhruva_nurse, v_patient, 'Dhruva Mother', v_today - 84, null, null, null);
  v_plan := v_view -> 'plans' -> 0;
  select string_agg(v ->> 'code', ',' order by ord) into v_codes
  from jsonb_array_elements(v_plan -> 'visits') with ordinality as t(v, ord);
  insert into t_results values (default, 'Dhruva pregnancy uses Dhruva plan (14 visits)',
    jsonb_array_length(v_plan -> 'visits') = 14 and v_codes like 'dhruva_preg_w06,dhruva_preg_w08,dhruva_preg_w12,%dhruva_preg_w40', v_codes);
  insert into t_results values (default, 'week 12 visit has NT, double marker, TD 2nd dose',
    (select string_agg(i ->> 'labelEn', ' | ' order by ord) from jsonb_array_elements(v_plan -> 'visits' -> 2 -> 'items') with ordinality as t(i, ord))
      = 'NT scan | Double marker test | TD vaccine – 2nd dose', v_plan -> 'visits' -> 2 ->> 'titleEn');
  insert into t_results values (default, 'ICT is only-if-needed',
    exists (select 1 from jsonb_array_elements(v_plan -> 'visits' -> 6 -> 'items') i where i ->> 'labelEn' like 'ICT%' and (i ->> 'conditional')::boolean), 'w28');
  insert into t_results values (default, 'week 6 window = weeks 6-7',
    (v_plan -> 'visits' -> 0 ->> 'fromDate')::date = (v_today - 84) + 42 and (v_plan -> 'visits' -> 0 ->> 'toDate')::date = (v_today - 84) + 55, (v_plan -> 'visits' -> 0)::text);

  -- Ticking a Dhruva item works.
  v_item := (v_plan -> 'visits' -> 2 -> 'items' -> 0 ->> 'id')::uuid;
  v_view := public.care_nurse_save_visit(v_dhruva_nurse, v_patient,
    jsonb_build_array(jsonb_build_object('planId', v_plan ->> 'id', 'itemId', v_item, 'status', 'done')), v_today + 7, null, null, null, (v_plan ->> 'id')::uuid);
  insert into t_results values (default, 'tick on Dhruva item saved',
    v_view -> 'plans' -> 0 -> 'visits' -> 2 -> 'items' -> 0 ->> 'status' = 'done', v_view -> 'plans' -> 0 -> 'visits' -> 2 -> 'items' -> 0 ->> 'status');

  -- Another hospital keeps the standard schedule.
  v_view := public.care_nurse_add_patient(v_shankar_nurse, '9999900042', 'Shankar Mother', null);
  v_other := (v_view -> 'patient' ->> 'id')::uuid;
  v_view := public.care_nurse_start_pregnancy(v_shankar_nurse, v_other, 'Shankar Mother', v_today - 84, null, null, null);
  insert into t_results values (default, 'Shankar pregnancy keeps the standard schedule',
    v_view -> 'plans' -> 0 -> 'visits' -> 0 ->> 'code' = 'preg_w06'
      and not exists (select 1 from jsonb_array_elements(v_view -> 'plans' -> 0 -> 'visits') v where v ->> 'code' like 'dhruva%'),
    v_view -> 'plans' -> 0 -> 'visits' -> 0 ->> 'code');
  insert into t_results values (default, 'standard child schedule unchanged',
    (select count(*) from public.care_schedule_visits where plan_type = 'child' and hospital_id is null) > 10, 'child');
end;
$$;

select jsonb_agg(jsonb_build_object('ok', ok, 'test', name, 'detail', detail) order by seq) as results from t_results;

rollback;
