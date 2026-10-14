-- My Care part 2 test: nurse patient list + extra tests (safe on production:
-- everything is rolled back). Run after 20261014090000_care_nurse_directory_and_extra_tests.sql.
-- Uses made-up numbers 99999000xx / 99999111xx and its own test nurse.
begin;

create temp table t_results (seq serial, name text, ok boolean, detail text) on commit drop;

do $$
declare
  v_dhruva uuid;
  v_nurse uuid;
  v_other_nurse uuid;
  v_patient uuid;
  v_today date := public.care_today();
  v_uid uuid := gen_random_uuid();
  v_view jsonb;
  v_dir jsonb;
  v_item uuid;
  v_done_item uuid;
  v_count integer;
  v_text text;
  v_app jsonb;
begin
  select id into v_dhruva from public.hospitals where code = 'DHRUVA';
  v_nurse := public.care_add_nurse('DHRUVA', 'Rollback Nurse', '9999911199', '1234');
  v_other_nurse := public.care_add_nurse('SHANKAR', 'Other Nurse', '9999911198', '1234');

  -- Patient added by the nurse shows up first in her hospital's list.
  v_view := public.care_nurse_add_patient(v_nurse, '9999900021', 'Rollback Patient', 'RB-21');
  v_patient := (v_view -> 'patient' ->> 'id')::uuid;
  v_dir := public.care_nurse_directory(v_nurse);
  insert into t_results (name, ok, detail) values
    ('directory: new patient is listed first', v_dir -> 0 ->> 'id' = v_patient::text, v_dir -> 0 ->> 'name'),
    ('directory: carries the hospital ID', v_dir -> 0 ->> 'hospitalPatientId' = 'RB-21', v_dir -> 0 ->> 'hospitalPatientId'),
    ('directory: no duplicate patients', (select count(*) = count(distinct e ->> 'id') from jsonb_array_elements(v_dir) e), jsonb_array_length(v_dir)::text);
  v_dir := public.care_nurse_directory(v_other_nurse);
  insert into t_results (name, ok, detail) values
    ('directory: other hospital does not see her',
     not exists (select 1 from jsonb_array_elements(v_dir) e where e ->> 'id' = v_patient::text), jsonb_array_length(v_dir)::text);
  v_dir := public.care_nurse_directory(v_nurse, 1);
  insert into t_results (name, ok, detail) values ('directory: limit works', jsonb_array_length(v_dir) = 1, jsonb_array_length(v_dir)::text);

  -- Extra tests from the case sheet.
  v_view := public.care_nurse_add_extra_item(v_nurse, v_patient, '  Thyroid   test (TSH) ', v_today + 13, false, null);
  v_item := (v_view -> 'extraItems' -> 0 ->> 'id')::uuid;
  insert into t_results (name, ok, detail) values
    ('extra test: added, name tidied', v_view -> 'extraItems' -> 0 ->> 'label' = 'Thyroid test (TSH)', v_view -> 'extraItems' -> 0 ->> 'label'),
    ('extra test: still to do', (v_view -> 'extraItems' -> 0 ->> 'status') is null, coalesce(v_view -> 'extraItems' -> 0 ->> 'status', 'null')),
    ('extra test: page still has plans + patient', v_view ? 'plans' and v_view -> 'patient' ->> 'id' = v_patient::text, 'ok');

  v_view := public.care_nurse_add_extra_item(v_nurse, v_patient, 'Growth scan', v_today, true, null);
  select (e ->> 'id')::uuid into v_done_item from jsonb_array_elements(v_view -> 'extraItems') e where e ->> 'label' = 'Growth scan';
  insert into t_results (name, ok, detail)
  select 'extra test: done today, by the nurse', e ->> 'status' = 'done' and e ->> 'doneOn' = v_today::text and e ->> 'statusBy' = 'Rollback Nurse', e::text
  from jsonb_array_elements(v_view -> 'extraItems') e where e ->> 'label' = 'Growth scan';

  begin
    perform public.care_nurse_add_extra_item(v_nurse, v_patient, 'X', v_today, false, null);
    insert into t_results values (default, 'extra test: 1-letter name refused', false, 'accepted');
  exception when others then
    insert into t_results values (default, 'extra test: 1-letter name refused', sqlerrm = 'invalid_test_name', sqlerrm);
  end;
  begin
    perform public.care_nurse_add_extra_item(v_nurse, v_patient, 'Far test', v_today + 500, false, null);
    insert into t_results values (default, 'extra test: date too far refused', false, 'accepted');
  exception when others then
    insert into t_results values (default, 'extra test: date too far refused', sqlerrm = 'invalid_test_date', sqlerrm);
  end;
  begin
    perform public.care_nurse_add_extra_item(v_nurse, v_patient, 'Future done', v_today + 3, true, null);
    insert into t_results values (default, 'extra test: "done" in the future refused', false, 'accepted');
  exception when others then
    insert into t_results values (default, 'extra test: "done" in the future refused', sqlerrm = 'invalid_test_date', sqlerrm);
  end;
  begin
    perform public.care_nurse_add_extra_item(v_other_nurse, v_patient, 'Other hospital', v_today, false, null);
    insert into t_results values (default, 'extra test: other hospital refused', false, 'accepted');
  exception when others then
    insert into t_results values (default, 'extra test: other hospital refused', sqlerrm = 'patient_not_at_hospital', sqlerrm);
  end;

  -- Ticks with "Save visit".
  v_count := public.care_nurse_set_extra_items(v_nurse, v_patient, jsonb_build_array(jsonb_build_object('id', v_item, 'status', 'done')));
  select status || '/' || done_on || '/' || status_by_nurse_name into v_text from public.care_extra_items where id = v_item;
  insert into t_results values (default, 'tick: done records date + nurse', v_count = 1 and v_text = 'done/' || v_today || '/Rollback Nurse', v_text);
  perform public.care_nurse_set_extra_items(v_nurse, v_patient, jsonb_build_array(jsonb_build_object('id', v_item, 'status', 'clear')));
  select coalesce(status, 'null') || '/' || coalesce(done_on::text, 'null') into v_text from public.care_extra_items where id = v_item;
  insert into t_results values (default, 'tick: clear undoes it', v_text = 'null/null', v_text);
  begin
    perform public.care_nurse_set_extra_items(v_nurse, v_patient, jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'status', 'done')));
    insert into t_results values (default, 'tick: unknown test refused', false, 'accepted');
  exception when others then
    insert into t_results values (default, 'tick: unknown test refused', sqlerrm = 'unknown_item', sqlerrm);
  end;

  -- Patient app view (linked device only).
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
  insert into public.patient_device_links (patient_id, owner_user_id) values (v_patient, v_uid);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  v_app := public.care_get_my_care_v2('9999900021');
  insert into t_results values (default, 'app: linked, sees the to-do test only',
    (v_app ->> 'linked')::boolean and jsonb_array_length(v_app -> 'extraItems') = 1 and v_app -> 'extraItems' -> 0 ->> 'label' = 'Thyroid test (TSH)',
    coalesce(v_app -> 'extraItems', 'null')::text);
  insert into t_results values (default, 'app: v2 keeps everything v1 returns',
    (select bool_and(v_app ? k) from jsonb_object_keys(public.care_get_my_care('9999900021')) k), 'keys');
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  v_app := public.care_get_my_care_v2('9999900021');
  insert into t_results values (default, 'app: unlinked device gets nothing', not (v_app ->> 'linked')::boolean and not v_app ? 'extraItems', v_app::text);

  -- Remove a test added by mistake (not a ticked one).
  v_view := public.care_nurse_remove_extra_item(v_nurse, v_item);
  insert into t_results values (default, 'remove: untick test removed',
    not exists (select 1 from jsonb_array_elements(v_view -> 'extraItems') e where e ->> 'id' = v_item::text), jsonb_array_length(v_view -> 'extraItems')::text);
  begin
    perform public.care_nurse_remove_extra_item(v_nurse, v_done_item);
    insert into t_results values (default, 'remove: done test kept', false, 'removed');
  exception when others then
    insert into t_results values (default, 'remove: done test kept', sqlerrm = 'unknown_item', sqlerrm);
  end;

  -- Who may call what.
  insert into t_results (name, ok, detail) values
    ('grants: app v2 for signed-in users only',
     has_function_privilege('authenticated', 'public.care_get_my_care_v2(text)', 'execute')
       and not has_function_privilege('anon', 'public.care_get_my_care_v2(text)', 'execute'), 'v2'),
    ('grants: nurse functions server-only',
     has_function_privilege('service_role', 'public.care_nurse_directory(uuid, integer)', 'execute')
       and not has_function_privilege('authenticated', 'public.care_nurse_directory(uuid, integer)', 'execute')
       and not has_function_privilege('authenticated', 'public.care_nurse_add_extra_item(uuid, uuid, text, date, boolean, uuid)', 'execute')
       and not has_function_privilege('anon', 'public.care_nurse_set_extra_items(uuid, uuid, jsonb)', 'execute'), 'nurse'),
    ('grants: extra tests table not readable by app users',
     not has_table_privilege('authenticated', 'public.care_extra_items', 'select')
       and not has_table_privilege('anon', 'public.care_extra_items', 'select'), 'table');
end;
$$;

select jsonb_agg(jsonb_build_object('ok', ok, 'test', name, 'detail', detail) order by seq) as results from t_results;

rollback;
