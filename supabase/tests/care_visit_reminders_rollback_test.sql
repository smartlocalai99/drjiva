-- Visit reminders test: 8 PM job, unread badge, cleared by My Care.
-- Safe on production: rolled back (the queued pushes are rolled back too).
begin;

create temp table t_results (seq serial, name text, ok boolean, detail text) on commit drop;

do $$
declare
  v_uid uuid := gen_random_uuid();
  v_patient uuid;
  v_hospital uuid;
  v_sent integer;
  v_unread integer;
begin
  select id into v_hospital from public.hospitals where code = 'DHRUVA';
  insert into public.patients (mobile, name) values ('+919999800097', 'Reminder Test') returning id into v_patient;
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
  insert into public.patient_device_links (patient_id, owner_user_id) values (v_patient, v_uid);
  -- The phone last opened the app yesterday, before the nurse set the date.
  insert into public.care_push_tokens (owner_user_id, patient_id, expo_push_token, platform, language, updated_at)
  values (v_uid, v_patient, 'ExponentPushToken[reminder-test]', 'ios', 'en', now() - interval '1 day');

  -- Visit tomorrow: the 8 PM reminder.
  insert into public.care_followups (patient_id, hospital_id, nurse_name, next_date)
  values (v_patient, v_hospital, 'Test', public.care_today() + 1);
  v_sent := public.care_send_followup_reminders('eve');
  select unread into v_unread from public.care_push_tokens where owner_user_id = v_uid;
  insert into t_results values (default, 'night-before reminder sent, badge 1', v_sent >= 1 and v_unread = 1, v_sent || ' / ' || v_unread);

  -- Same visit, now on the day: the 8 AM reminder, badge 2.
  update public.care_followups set next_date = public.care_today() where patient_id = v_patient;
  v_sent := public.care_send_followup_reminders('day');
  select unread into v_unread from public.care_push_tokens where owner_user_id = v_uid;
  insert into t_results values (default, 'visit-day reminder sent, badge 2', v_sent >= 1 and v_unread = 2, v_sent || ' / ' || v_unread);

  insert into t_results values (default, 'push carries the badge',
    exists (select 1 from net.http_request_queue q where convert_from(q.body, 'UTF8') like '%"badge": 2%' and convert_from(q.body, 'UTF8') like '%reminder-test%'),
    'queue');

  -- Opening My Care clears it.
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  perform public.care_mark_reminders_seen();
  select unread into v_unread from public.care_push_tokens where owner_user_id = v_uid;
  insert into t_results values (default, 'opening My Care clears the badge', v_unread = 0, v_unread::text);

  insert into t_results values (default, 'evening job at 8 PM IST',
    (select schedule from cron.job where jobname = 'care-followup-eve') = '30 14 * * *', (select schedule from cron.job where jobname = 'care-followup-eve'));
end;
$$;

select jsonb_agg(jsonb_build_object('ok', ok, 'test', name, 'detail', detail) order by seq) as results from t_results;

rollback;
