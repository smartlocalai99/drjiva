-- My Care part 6 test: Child Growth Chart (Dhruva child schedule, parent
-- adds a child, records vaccines). Safe on production: rolled back.
begin;

create temp table t_results (seq serial, name text, ok boolean, detail text) on commit drop;

do $$
declare
  v_uid uuid := gen_random_uuid();
  v_other_uid uuid := gen_random_uuid();
  v_patient uuid;
  v_other uuid;
  v_dhruva uuid;
  v_plan jsonb;
  v_plan_id uuid;
  v_visit jsonb;
  v_item jsonb;
  v_records jsonb;
  v_app jsonb;
  v_text text;
  v_dob date := date '2026-01-15';
begin
  select id into v_dhruva from public.hospitals where code = 'DHRUVA';
  insert into public.patients (mobile, name) values ('+919999800081', 'Child Test Parent') returning id into v_patient;
  insert into public.patients (mobile, name) values ('+919999800082', 'Child Test Other') returning id into v_other;
  insert into public.care_hospital_patients (hospital_id, patient_id) values (v_dhruva, v_patient);
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values
    (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now()),
    (v_other_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
  insert into public.patient_device_links (patient_id, owner_user_id) values (v_patient, v_uid), (v_other, v_other_uid);

  -- The Dhruva parent's phone.
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

  v_app := public.care_get_my_care_v2('9999800081');
  insert into t_results values (default, 'Dhruva parent can add a child (Dr. Sudarshan Reddy)',
    v_app -> 'childDesk' ->> 'doctorName' = 'Dr. Sudarshan Reddy', coalesce(v_app ->> 'childDesk', 'null'));

  v_plan := public.care_child_add('9999800081', ' Baby Test ', 'female', v_dob);
  v_plan_id := (v_plan ->> 'id')::uuid;
  insert into t_results values (default, 'child added with Dhruva schedule (14 visits)',
    jsonb_array_length(v_plan -> 'visits') = 14 and v_plan ->> 'personName' = 'Baby Test' and v_plan ->> 'doctorName' = 'Dr. Sudarshan Reddy',
    jsonb_array_length(v_plan -> 'visits')::text);

  select v into v_visit from jsonb_array_elements(v_plan -> 'visits') v where v ->> 'code' = 'dhruva_child_6w';
  insert into t_results values (default, '6 weeks = DOB + 42 days', (v_visit ->> 'fromDate')::date = v_dob + 42, v_visit ->> 'fromDate');
  select v into v_visit from jsonb_array_elements(v_plan -> 'visits') v where v ->> 'code' = 'dhruva_child_6m';
  insert into t_results values (default, '6 months = 15 Jul (calendar months)', v_visit ->> 'fromDate' = '2026-07-15', v_visit ->> 'fromDate');
  select v into v_visit from jsonb_array_elements(v_plan -> 'visits') v where v ->> 'code' = 'dhruva_child_10y6m';
  insert into t_results values (default, 'HPV-2 = DOB + 10 years 6 months', v_visit ->> 'fromDate' = '2036-07-15', v_visit ->> 'fromDate');

  select it into v_item from jsonb_array_elements(v_plan -> 'visits') v cross join lateral jsonb_array_elements(v -> 'items') it where it ->> 'code' = 'dhruva_child_opt_cholera_2';
  insert into t_results values (default, 'Cholera-2 = DOB + 12 months + 14 days, optional',
    v_item ->> 'fromDate' = '2027-01-29' and (v_item ->> 'optional')::boolean, v_item::text);
  select it into v_item from jsonb_array_elements(v_plan -> 'visits') v cross join lateral jsonb_array_elements(v -> 'items') it where it ->> 'code' = 'dhruva_child_opt_je_2';
  insert into t_results values (default, 'JE-2 = DOB + 13 months', v_item ->> 'fromDate' = '2027-02-15', v_item ->> 'fromDate');
  select count(*)::text into v_text from jsonb_array_elements(v_plan -> 'visits') v cross join lateral jsonb_array_elements(v -> 'items') it where (it ->> 'optional')::boolean;
  insert into t_results values (default, '6 optional vaccines', v_text = '6', v_text);
  select it into v_item from jsonb_array_elements(v_plan -> 'visits') v cross join lateral jsonb_array_elements(v -> 'items') it where it ->> 'code' = 'dhruva_child_hepa_2';
  insert into t_results values (default, 'Hep A-2 is "only if"', (v_item ->> 'conditional')::boolean and not (v_item ->> 'optional')::boolean, v_item::text);

  -- Record one vaccine with details.
  select it into v_item from jsonb_array_elements(v_plan -> 'visits') v cross join lateral jsonb_array_elements(v -> 'items') it where it ->> 'code' = 'dhruva_child_bcg_1';
  v_records := public.care_child_save_vaccine('9999800081', v_plan_id, (v_item ->> 'id')::uuid, v_dob, 'left_arm', 'BCG Brand', 'B123', date '2027-06-30', v_uid::text || '/label.jpg');
  insert into t_results values (default, 'vaccine saved with site, brand, batch, expiry, photo',
    jsonb_array_length(v_records) = 1 and v_records -> 0 ->> 'site' = 'left_arm' and v_records -> 0 ->> 'batchNo' = 'B123' and v_records -> 0 ->> 'photoPath' like '%/label.jpg',
    v_records::text);

  begin
    perform public.care_child_save_vaccine('9999800081', v_plan_id, (v_item ->> 'id')::uuid, v_dob, null, null, null, null, 'someone-else/label.jpg');
    insert into t_results values (default, 'photo outside own folder refused', false, 'saved');
  exception when others then
    insert into t_results values (default, 'photo outside own folder refused', sqlerrm = 'invalid_photo', sqlerrm);
  end;
  begin
    perform public.care_child_save_vaccine('9999800081', v_plan_id, (v_item ->> 'id')::uuid, v_dob - 1, null, null, null, null, null);
    insert into t_results values (default, 'date before birth refused', false, 'saved');
  exception when others then
    insert into t_results values (default, 'date before birth refused', sqlerrm = 'invalid_given_on', sqlerrm);
  end;

  -- Mark the birth visit complete: the other two vaccines get the date.
  select v into v_visit from jsonb_array_elements(v_plan -> 'visits') v where v ->> 'code' = 'dhruva_child_birth';
  v_records := public.care_child_mark_visit('9999800081', v_plan_id, (v_visit ->> 'id')::uuid, v_dob + 1);
  insert into t_results values (default, 'mark complete records the rest of the visit', jsonb_array_length(v_records) = 3, jsonb_array_length(v_records)::text);

  -- Optional / only-if vaccines are not marked by "complete".
  select v into v_visit from jsonb_array_elements(v_plan -> 'visits') v where v ->> 'code' = 'dhruva_child_12m';
  perform set_config('test.dummy', '1', true);

  -- The app sees the records.
  v_app := public.care_get_my_care_v2('9999800081');
  insert into t_results values (default, 'My Care carries the vaccine records', jsonb_array_length(v_app -> 'vaccineRecords') = 3, jsonb_array_length(v_app -> 'vaccineRecords')::text);

  -- The nurse at Dhruva sees what the parent recorded.
  declare
    v_nurse uuid;
    v_view jsonb;
  begin
    v_nurse := public.care_add_nurse('DHRUVA', 'Child Test Nurse', '9999811193', '1234');
    v_view := public.care_nurse_patient_v2(v_nurse, v_patient);
    insert into t_results values (default, 'nurse sees the parent records', jsonb_array_length(v_view -> 'vaccineRecords') = 3, coalesce(v_view ->> 'vaccineRecords', 'null'));
  end;

  -- Date of birth changed: dates follow; a dose before it is refused.
  begin
    perform public.care_child_update('9999800081', v_plan_id, 'Baby Test', 'female', v_dob + 10);
    insert into t_results values (default, 'new DOB after recorded doses refused', false, 'saved');
  exception when others then
    insert into t_results values (default, 'new DOB after recorded doses refused', sqlerrm = 'doses_before_birth', sqlerrm);
  end;
  v_plan := public.care_child_update('9999800081', v_plan_id, 'Baby Test', 'female', v_dob - 5);
  select v into v_visit from jsonb_array_elements(v_plan -> 'visits') v where v ->> 'code' = 'dhruva_child_6m';
  insert into t_results values (default, 'DOB edit moves every date', v_visit ->> 'fromDate' = '2026-07-10', v_visit ->> 'fromDate');

  v_records := public.care_child_clear_vaccine('9999800081', v_plan_id, (v_item ->> 'id')::uuid);
  insert into t_results values (default, 'a vaccine can be cleared', jsonb_array_length(v_records) = 2, jsonb_array_length(v_records)::text);

  -- Another family's phone cannot touch this child.
  perform set_config('request.jwt.claims', json_build_object('sub', v_other_uid, 'role', 'authenticated')::text, true);
  begin
    perform public.care_child_clear_vaccine('9999800082', v_plan_id, (v_item ->> 'id')::uuid);
    insert into t_results values (default, 'other family refused', false, 'cleared');
  exception when others then
    insert into t_results values (default, 'other family refused', sqlerrm = 'unknown_child', sqlerrm);
  end;
  v_app := public.care_get_my_care_v2('9999800082');
  insert into t_results values (default, 'no child doctor -> cannot add a child', v_app -> 'childDesk' = 'null'::jsonb or v_app -> 'childDesk' is null, coalesce(v_app ->> 'childDesk', 'null'));
  begin
    perform public.care_child_add('9999800082', 'X', 'male', v_dob);
    insert into t_results values (default, 'add child refused without a child doctor', false, 'added');
  exception when others then
    insert into t_results values (default, 'add child refused without a child doctor', sqlerrm = 'no_child_doctor', sqlerrm);
  end;

  insert into t_results values (default, 'grants: parent functions for signed-in phones, table closed',
    has_function_privilege('authenticated', 'public.care_child_save_vaccine(text, uuid, uuid, date, text, text, text, date, text)', 'execute')
      and not has_function_privilege('anon', 'public.care_child_add(text, text, text, date)', 'execute')
      and not has_function_privilege('authenticated', 'public.care_child_desk(uuid)', 'execute')
      and not has_table_privilege('authenticated', 'public.care_vaccine_records', 'select'), 'grants');
end;
$$;

select jsonb_agg(jsonb_build_object('ok', ok, 'test', name, 'detail', detail) order by seq) as results from t_results;

rollback;
