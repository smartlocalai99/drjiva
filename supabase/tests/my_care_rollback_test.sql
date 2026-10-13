-- My Care database test (safe on production: everything is rolled back).
-- Paste into the Supabase SQL editor and run. Last result = pass/fail list.
-- Uses made-up numbers 99999000xx; creates and removes its own test nurse.
begin;

create temp table t_results (seq serial, name text, ok boolean, detail text) on commit drop;

do $$
declare
  v_dhruva uuid;
  v_shankar uuid;
  v_nurse uuid;
  v_nurse_shankar uuid;
  v_mounika uuid;
  v_sudarshan uuid;
  v_res jsonb;
  v_view jsonb;
  v_plan jsonb;
  v_visit jsonb;
  v_patient uuid;
  v_child_patient uuid;
  v_general_patient uuid;
  v_plan_id uuid;
  v_item_ids uuid[];
  v_today date := public.care_today();
  v_uid uuid := gen_random_uuid();
  v_other_uid uuid := gen_random_uuid();
  v_count integer;
  v_text text;
  v_bill_patient uuid;
  v_shankar_only uuid;
begin
  select id into v_dhruva from public.hospitals where code = 'DHRUVA';
  select id into v_shankar from public.hospitals where code = 'SHANKAR';
  select id into v_mounika from public.care_doctors where display_name = 'Dr. Mounika';
  select id into v_sudarshan from public.care_doctors where display_name = 'Dr. Sudarshan Reddy';

  -- 1. Doctor names from bills -> department
  insert into t_results (name, ok, detail)
  select 'bill name "' || t.n || '" -> ' || t.expect, coalesce(m.department, 'general') = t.expect, coalesce(m.display_name, 'general (not listed)')
  from (values
    (v_dhruva, 'DR.MOUNIKA  REDDY', 'gynecology'),
    (v_dhruva, 'Dr. Mounika reddy', 'gynecology'),
    (v_dhruva, 'DR MOUNIKA MS OBG', 'gynecology'),
    (v_dhruva, 'DR SUDARSHAN REDDY', 'pediatrics'),
    (v_dhruva, 'DR. SUDARSHGAN REDDY', 'pediatrics'),
    (v_dhruva, 'Dr. Sudarshan', 'pediatrics'),
    (v_dhruva, 'DR. SOMESHWAR REDDY', 'general'),
    (v_shankar, 'J.SHILPA SREE', 'gynecology'),
    (v_shankar, 'Dr. Silpa', 'gynecology'),
    (v_shankar, 'D.CHAITANYA REDDY', 'general'),
    (v_shankar, 'DR.MOUNIKA REDDY', 'general')
  ) as t(h, n, expect)
  left join lateral public.care_match_doctor(t.h, t.n) m on true;

  -- 2. Nurse login: 4-digit PIN, lockout after 5 wrong tries
  v_nurse := public.care_add_nurse('Dhruva Hospitals', 'Test Nurse', '9999900001', '4821');
  v_nurse_shankar := public.care_add_nurse('SHANKAR', 'Shankar Nurse', '9999900009', '1111');
  v_res := public.care_nurse_login('9999900001', '4821');
  insert into t_results values (default, 'nurse logs in with mobile + 4-digit PIN', (v_res->>'ok')::boolean and v_res->'nurse'->>'hospitalName' = 'Dhruva Hospitals', v_res->'nurse'->>'name' || ' @ ' || (v_res->'nurse'->>'hospitalName'));
  v_res := public.care_nurse_login('9999900001', '0000');
  insert into t_results values (default, 'wrong PIN rejected', not (v_res->>'ok')::boolean, null);
  perform public.care_nurse_login('9999900001', '0000');
  perform public.care_nurse_login('9999900001', '0000');
  perform public.care_nurse_login('9999900001', '0000');
  v_res := public.care_nurse_login('9999900001', '0000');
  insert into t_results values (default, '5 wrong PINs lock login for 15 min', (v_res->>'lockedUntil') is not null, null);
  v_res := public.care_nurse_login('9999900001', '4821');
  insert into t_results values (default, 'correct PIN still refused while locked', not (v_res->>'ok')::boolean, null);
  perform public.care_set_nurse_pin('9999900001', '4821');
  v_res := public.care_nurse_login('9999900001', '4821');
  insert into t_results values (default, 'PIN reset unlocks', (v_res->>'ok')::boolean, null);

  -- 3. A nurse only reaches her own hospital's patients
  select c.patient_id into v_bill_patient
  from public.patient_medicine_courses c
  where c.hospital_id = v_dhruva and c.source = 'hospital'
  limit 1;
  v_res := public.care_nurse_find(v_nurse, (select mobile from public.patients where id = v_bill_patient));
  insert into t_results values (default, 'Dhruva nurse finds a Dhruva-billed patient by mobile', (v_res->>'found')::boolean, null);

  select c.patient_id into v_shankar_only
  from public.patient_medicine_courses c
  where c.hospital_id = v_shankar and c.source = 'hospital'
    and not exists (
      select 1 from public.patient_medicine_courses c2
      where c2.patient_id = c.patient_id and c2.hospital_id = v_dhruva
    )
  limit 1;
  v_res := public.care_nurse_find(v_nurse, (select mobile from public.patients where id = v_shankar_only));
  insert into t_results values (default, 'Dhruva nurse gets "not found" for a Shankar-only patient', not (v_res->>'found')::boolean, null);
  begin
    perform public.care_nurse_patient(v_nurse, v_shankar_only);
    insert into t_results values (default, 'Dhruva nurse cannot open a Shankar-only patient', false, 'opened!');
  exception when others then
    insert into t_results values (default, 'Dhruva nurse cannot open a Shankar-only patient', sqlerrm = 'patient_not_at_hospital', sqlerrm);
  end;

  -- 4. Add patient + hospital patient ID
  v_view := public.care_nurse_add_patient(v_nurse, '9999900002', 'TEST Mounika Patient', 'DH-001');
  v_patient := (v_view->'patient'->>'id')::uuid;
  insert into t_results values (default, 'add patient (mobile + name + UHID)', v_patient is not null and v_view->'patient'->>'hospitalPatientId' = 'DH-001', null);
  v_res := public.care_nurse_find(v_nurse, 'dh 001');
  insert into t_results values (default, 'find by hospital patient ID, any spacing/case', (v_res->>'patientId')::uuid = v_patient, null);
  v_res := public.care_nurse_find(v_nurse_shankar, '9999900002');
  insert into t_results values (default, 'Shankar nurse cannot find Dhruva''s new patient', not (v_res->>'found')::boolean, null);
  begin
    perform public.care_nurse_add_patient(v_nurse, '9999900005', 'Another', 'DH001');
    insert into t_results values (default, 'same hospital patient ID twice is rejected', false, 'accepted!');
  exception when others then
    insert into t_results values (default, 'same hospital patient ID twice is rejected', sqlerrm = 'hospital_id_taken', sqlerrm);
  end;

  -- 5. Dr. Mounika: pregnancy, LMP 10 weeks ago
  v_view := public.care_nurse_start_pregnancy(v_nurse, v_patient, 'TEST Mother', v_today - 70, null, v_mounika, null);
  v_plan := v_view->'plans'->0;
  v_plan_id := (v_plan->>'id')::uuid;
  insert into t_results values (default, 'EDD = LMP + 280 days', (v_plan->>'eddDate')::date = v_today - 70 + 280, v_plan->>'eddDate');
  insert into t_results values (default, 'current week = 10', floor((v_today - ((v_plan->>'eddDate')::date - 280)) / 7.0) = 10, null);
  select v into v_visit from jsonb_array_elements(v_plan->'visits') v where v->>'code' = 'preg_w06';
  insert into t_results values (default, 'week 6–8 items: window passed, blank -> Pending',
    (v_visit->>'toDate')::date < v_today and (select bool_and((i->>'status') is null) from jsonb_array_elements(v_visit->'items') i),
    (v_visit->>'fromDate') || ' to ' || (v_visit->>'toDate'));
  select v into v_visit from jsonb_array_elements(v_plan->'visits') v
  where (v->>'toDate')::date >= v_today
  order by (v->>'fromDate')::date
  limit 1;
  insert into t_results values (default, 'next visit = week 11–13 (NT scan)', v_visit->>'code' = 'preg_w11', (v_visit->>'fromDate') || ' to ' || (v_visit->>'toDate'));
  begin
    perform public.care_nurse_start_pregnancy(v_nurse, v_patient, 'Second Mother', v_today - 50, null, null, null);
    insert into t_results values (default, 'only one active pregnancy per mobile', false, 'allowed!');
  exception when others then
    insert into t_results values (default, 'only one active pregnancy per mobile', sqlerrm = 'pregnancy_exists', sqlerrm);
  end;

  -- 6. Tick items + next date + note
  select array_agg((i->>'id')::uuid order by (i->>'code')) into v_item_ids
  from jsonb_array_elements(v_plan->'visits') v, jsonb_array_elements(v->'items') i
  where v->>'code' = 'preg_w06';
  v_view := public.care_nurse_save_visit(
    v_nurse, v_patient,
    jsonb_build_array(
      jsonb_build_object('planId', v_plan_id, 'itemId', v_item_ids[1], 'status', 'done'),
      jsonb_build_object('planId', v_plan_id, 'itemId', v_item_ids[2], 'status', 'not_needed')
    ),
    v_today + 1, 'Come fasting for sugar test', v_mounika, null, v_plan_id);
  insert into t_results values (default, 'save stores next date + note + which nurse', v_view->'lastFollowup'->>'nurseName' = 'Test Nurse' and (v_view->'lastFollowup'->>'nextDate')::date = v_today + 1 and v_view->'lastFollowup'->>'note' = 'Come fasting for sugar test', null);
  insert into t_results values (default, 'ticks saved with nurse + date', (select count(*) from public.care_plan_items where plan_id = v_plan_id and nurse_id = v_nurse and done_on = v_today) = 2, null);
  v_view := public.care_nurse_save_visit(v_nurse, v_patient,
    jsonb_build_array(jsonb_build_object('planId', v_plan_id, 'itemId', v_item_ids[2], 'status', 'clear')),
    v_today + 1, 'Come fasting for sugar test', v_mounika, null, v_plan_id);
  insert into t_results values (default, 'a tick can be cleared again', (select count(*) from public.care_plan_items where plan_id = v_plan_id) = 1, null);

  -- 7. Dr. Sudarshan Reddy: child born 5 weeks ago
  v_view := public.care_nurse_add_patient(v_nurse, '9999900003', 'TEST Parent', null);
  v_child_patient := (v_view->'patient'->>'id')::uuid;
  v_view := public.care_nurse_add_child(v_nurse, v_child_patient, 'Arjun', v_today - 35, 'male', v_sudarshan, null);
  v_plan := v_view->'plans'->0;
  select v into v_visit from jsonb_array_elements(v_plan->'visits') v
  where (v->>'toDate')::date >= v_today
  order by (v->>'fromDate')::date
  limit 1;
  insert into t_results values (default, 'child 5 weeks old -> next = 6-week vaccines', v_visit->>'code' = 'child_6w', (v_visit->>'fromDate') || ' to ' || (v_visit->>'toDate'));
  v_view := public.care_nurse_add_child(v_nurse, v_child_patient, 'Priya', v_today - 400, 'female', null, null);
  insert into t_results values (default, 'one mobile can hold several children', jsonb_array_length(v_view->'plans') = 2, null);
  insert into t_results values (default, 'girl''s schedule hides HPV dose 2 (boys only)',
    not exists (
      select 1 from jsonb_array_elements(v_view->'plans') p, jsonb_array_elements(p->'visits') v, jsonb_array_elements(v->'items') i
      where p->>'personName' = 'Priya' and i->>'code' = 'child_hpv2'), null);
  select v into v_visit
  from jsonb_array_elements(v_view->'plans') p, jsonb_array_elements(p->'visits') v
  where p->>'personName' = 'Priya' and v->>'code' = 'child_6m';
  insert into t_results values (default, 'TCV keeps its own 6–9 month window',
    exists (select 1 from jsonb_array_elements(v_visit->'items') i where i->>'code' = 'child_tcv' and (i->>'toDate')::date > (v_visit->>'toDate')::date),
    null);

  -- 8. Patient app (signed-in device)
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values
    (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now()),
    (v_other_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
  insert into public.patient_device_links (patient_id, owner_user_id) values (v_patient, v_uid);

  perform set_config('request.jwt.claims', json_build_object('sub', v_other_uid, 'role', 'authenticated')::text, true);
  v_res := public.care_get_my_care('9999900002');
  insert into t_results values (default, 'a device NOT linked to the number sees nothing', (v_res->>'linked')::boolean = false, null);

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  v_res := public.care_get_my_care('9999900002');
  insert into t_results values (default, 'linked device sees its pregnancy plan', (v_res->>'linked')::boolean and jsonb_array_length(v_res->'plans') = 1, null);
  insert into t_results values (default, 'app shows next visit + nurse who set it', v_res->'followup'->>'nurseName' = 'Test Nurse' and (v_res->'followup'->>'nextDate')::date = v_today + 1, (v_res->'followup'->>'nurseName') || ', ' || (v_res->'followup'->'hospital'->>'name'));
  insert into t_results values (default, 'app knows the doctor is gynecology', v_res->'currentDoctor'->>'department' = 'gynecology', v_res->'currentDoctor'->>'name');

  perform public.care_hide_plan('9999900002', v_plan_id);
  v_res := public.care_get_my_care('9999900002');
  insert into t_results values (default, '"This doesn''t apply to me" hides the plan', jsonb_array_length(v_res->'plans') = 0, null);
  update public.care_plans set hidden_by_patient_at = null where id = v_plan_id;

  -- 9. Chat: allowed context, saving, 30/day limit
  v_res := public.care_chat_begin('9999900002', 'What can I eat?');
  insert into t_results values (default, 'AI context: week + hospital, no mobile, no names',
    (v_res->'context'->>'pregnancyWeek')::integer = 10
      and position('9999900002' in v_res::text) = 0
      and position('TEST' in (v_res->'context')::text) = 0
      and position('Test Nurse' in (v_res->'context')::text) = 0,
    (v_res->'context')::text);
  v_res := public.care_chat_finish('9999900002', (v_res->>'messageId')::uuid, 'Eat home food.', false);
  insert into t_results values (default, 'AI reply saved to the chat', v_res->>'role' = 'assistant', null);
  begin
    for v_count in 1..30 loop
      perform public.care_chat_begin('9999900002', 'question ' || v_count);
    end loop;
    insert into t_results values (default, 'limit: 30 questions a day', false, 'no limit hit');
  exception when others then
    insert into t_results values (default, 'limit: 30 questions a day', sqlerrm = 'daily_limit', sqlerrm);
  end;

  -- 10. Follow-up reminders
  perform public.care_register_push_token('9999900002', 'ExponentPushToken[TestToken1234567]', 'android', 'te');
  v_count := public.care_send_followup_reminders('eve');
  insert into t_results values (default, '6 PM reminder queued for tomorrow''s visit', v_count = 1, v_count::text);
  v_count := public.care_send_followup_reminders('eve');
  insert into t_results values (default, 'same reminder never sent twice', v_count = 0, v_count::text);
  select convert_from(q.body, 'UTF8') into v_text from net.http_request_queue q order by q.id desc limit 1;
  insert into t_results values (default, 'push: care-followups channel, normal sound, Telugu text',
    position('"channelId": "care-followups"' in v_text) > 0
      and position('"sound": "default"' in v_text) > 0
      and position('రేపు' in v_text) > 0,
    left(v_text, 400));
  v_count := public.care_send_followup_reminders('day');
  insert into t_results values (default, '8 AM reminder waits for the visit day', v_count = 0, v_count::text);
  update public.care_followups set next_date = v_today where patient_id = v_patient;
  v_count := public.care_send_followup_reminders('day');
  insert into t_results values (default, '8 AM reminder sent on the visit day', v_count = 1, v_count::text);

  -- 11. Other doctor: follow-up only
  v_view := public.care_nurse_add_patient(v_nurse, '9999900004', 'TEST General', null);
  v_general_patient := (v_view->'patient'->>'id')::uuid;
  v_view := public.care_nurse_save_visit(v_nurse, v_general_patient, '[]'::jsonb, v_today + 14, 'Review with reports', null, 'Dr. Someshwar Reddy', null);
  insert into t_results values (default, 'other doctor -> general, follow-up only, no plans',
    v_view->'doctor'->>'department' = 'general' and jsonb_array_length(v_view->'plans') = 0 and (v_view->'lastFollowup'->>'nextDate')::date = v_today + 14,
    v_view->'doctor'->>'name');

  -- 12. Close the pregnancy
  v_view := public.care_nurse_close_plan(v_nurse, v_plan_id, 'delivered', v_today);
  insert into t_results values (default, 'close pregnancy as "Delivered"', not exists (select 1 from jsonb_array_elements(v_view->'plans') p where (p->>'id')::uuid = v_plan_id), null);

  -- 13. Nobody gets in without the right login
  begin
    set local role anon;
    perform count(*) from public.care_plans;
    reset role;
    insert into t_results values (default, 'public key cannot read care plans', false, 'read allowed!');
  exception when others then
    insert into t_results values (default, 'public key cannot read care plans', sqlstate = '42501', sqlerrm);
  end;
  begin
    set local role anon;
    perform public.care_get_my_care('9999900002');
    reset role;
    insert into t_results values (default, 'public key cannot call My Care', false, 'call allowed!');
  exception when others then
    insert into t_results values (default, 'public key cannot call My Care', sqlstate = '42501', sqlerrm);
  end;
  begin
    set local role authenticated;
    perform public.care_nurse_login('9999900001', '4821');
    reset role;
    insert into t_results values (default, 'app users cannot call nurse login', false, 'call allowed!');
  exception when others then
    insert into t_results values (default, 'app users cannot call nurse login', sqlstate = '42501', sqlerrm);
  end;
  begin
    set local role authenticated;
    perform public.care_nurse_patient(v_nurse, v_patient);
    reset role;
    insert into t_results values (default, 'app users cannot open nurse patient screen', false, 'call allowed!');
  exception when others then
    insert into t_results values (default, 'app users cannot open nurse patient screen', sqlstate = '42501', sqlerrm);
  end;
  begin
    set local role authenticated;
    perform count(*) from public.care_nurses;
    reset role;
    insert into t_results values (default, 'app users cannot list nurses', false, 'read allowed!');
  exception when others then
    insert into t_results values (default, 'app users cannot list nurses', sqlstate = '42501', sqlerrm);
  end;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  select count(*) into v_count from public.care_plans;
  perform set_config('request.jwt.claims', json_build_object('sub', v_other_uid, 'role', 'authenticated')::text, true);
  select count(*) into v_text from public.care_plans;
  reset role;
  insert into t_results values (default, 'table rule: linked device reads only its own plans', v_count = 1 and v_text = '0', 'linked=' || v_count || ' other=' || v_text);
end;
$$;

select jsonb_agg(jsonb_build_object('ok', ok, 'test', name, 'detail', detail) order by seq) as results from t_results;

rollback;
