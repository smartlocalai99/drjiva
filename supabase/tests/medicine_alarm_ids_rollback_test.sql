-- Medicine alarm IDs saved in one call, and visit pushes only to phones
-- that have not opened the app since the date was set.
-- Safe on production: rolled back.
begin;

create temp table t_results (seq serial, name text, ok boolean, detail text) on commit drop;
grant all on t_results to authenticated;
grant all on sequence t_results_seq_seq to authenticated;

do $$
declare
  v_phone uuid := gen_random_uuid();
  v_other_phone uuid := gen_random_uuid();
  v_patient uuid;
  v_course uuid;
  v_hospital uuid;
  v_medicine uuid;
begin
  select id into v_hospital from public.hospitals where code = 'DHRUVA';
  select id into v_medicine from public.medicines order by name limit 1;
  insert into public.patients (mobile, name) values ('+919999800098', 'Alarm Test') returning id into v_patient;
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values
    (v_phone, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now()),
    (v_other_phone, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
  insert into public.patient_device_links (patient_id, owner_user_id) values (v_patient, v_phone);
  insert into public.patient_medicine_courses
    (patient_id, owner_user_id, hospital_id, medicine_id, tablets_per_dose, start_date, duration_days, day_pattern)
  values (v_patient, v_phone, v_hospital, v_medicine, 1, public.care_today(), 5, 'daily')
  returning id into v_course;
  insert into public.patient_medicine_dose_events (course_id, patient_id, owner_user_id, scheduled_for, slot)
  select v_course, v_patient, v_phone, now() + make_interval(days => d), 'morning'
  from generate_series(1, 3) d;

  perform set_config('test.phone', v_phone::text, true);
  perform set_config('test.other_phone', v_other_phone::text, true);
  perform set_config('test.patient', v_patient::text, true);
end;
$$;

-- The patient's phone saves two alert IDs (two doses share one) in one call.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.phone'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into t_results (name, ok, detail)
select 'one call saves every alert ID', public.save_dose_notification_ids(
  (select array_agg(id order by scheduled_for) from public.patient_medicine_dose_events where patient_id = current_setting('test.patient')::uuid),
  array['alert-a', 'alert-a', 'alert-b']) = 3, 'count';
reset role;

insert into t_results (name, ok, detail)
select 'IDs stored on the right doses',
  array_agg(notification_id order by scheduled_for) = array['alert-a', 'alert-a', 'alert-b'],
  array_agg(notification_id order by scheduled_for)::text
from public.patient_medicine_dose_events where patient_id = current_setting('test.patient')::uuid;

-- A phone not linked to the patient changes nothing.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.other_phone'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into t_results (name, ok, detail)
select 'another phone cannot touch these doses', public.save_dose_notification_ids(
  (select array_agg(id) from public.patient_medicine_dose_events where patient_id = current_setting('test.patient')::uuid),
  array['x', 'y', 'z']) = 0, 'rls';
reset role;

insert into t_results (name, ok, detail)
select 'grants: signed-in phones only',
  has_function_privilege('authenticated', 'public.save_dose_notification_ids(uuid[], text[])', 'execute')
    and not has_function_privilege('anon', 'public.save_dose_notification_ids(uuid[], text[])', 'execute'), 'grants';

-- Visit pushes: only to phones that have not opened the app since the nurse
-- set the date (the others set their own 8 PM / 8 AM alarms).
do $$
declare
  v_hospital uuid;
  v_fresh_patient uuid;
  v_stale_patient uuid;
  v_fresh_phone uuid := gen_random_uuid();
  v_stale_phone uuid := gen_random_uuid();
begin
  select id into v_hospital from public.hospitals where code = 'DHRUVA';
  insert into public.patients (mobile, name) values ('+919999800099', 'Opened After') returning id into v_fresh_patient;
  insert into public.patients (mobile, name) values ('+919999800100', 'Not Opened') returning id into v_stale_patient;
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values
    (v_fresh_phone, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now()),
    (v_stale_phone, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
  insert into public.patient_device_links (patient_id, owner_user_id)
  values (v_fresh_patient, v_fresh_phone), (v_stale_patient, v_stale_phone);
  insert into public.care_followups (patient_id, hospital_id, nurse_name, next_date, created_at)
  values
    (v_fresh_patient, v_hospital, 'Test', public.care_today() + 1, now() - interval '2 hours'),
    (v_stale_patient, v_hospital, 'Test', public.care_today() + 1, now() - interval '2 hours');
  insert into public.care_push_tokens (owner_user_id, patient_id, expo_push_token, platform, language, updated_at)
  values
    (v_fresh_phone, v_fresh_patient, 'ExponentPushToken[opened-after]', 'ios', 'en', now() - interval '1 hour'),
    (v_stale_phone, v_stale_patient, 'ExponentPushToken[not-opened]', 'ios', 'en', now() - interval '3 hours');

  perform public.care_send_followup_reminders('eve');

  insert into t_results values (default, 'phone that has not opened since gets the push',
    exists (select 1 from net.http_request_queue q where convert_from(q.body, 'UTF8') like '%not-opened%'), 'queue');
  insert into t_results values (default, 'phone that opened since (own alarms) gets no push',
    not exists (select 1 from net.http_request_queue q where convert_from(q.body, 'UTF8') like '%opened-after%')
      and not exists (select 1 from public.care_followup_reminder_log l where l.owner_user_id = v_fresh_phone), 'queue');
end;
$$;

select jsonb_agg(jsonb_build_object('ok', ok, 'test', name, 'detail', detail) order by seq) as results from t_results;

rollback;
