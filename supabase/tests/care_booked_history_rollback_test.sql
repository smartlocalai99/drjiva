-- Synthetic patient only; no changes survive this transaction.
begin;
set local statement_timeout = '20s';
create temp table next_visit_results (name text, ok boolean) on commit drop;
do $$
declare
  nurse uuid;
  doctor uuid;
  patient uuid;
  plan uuid;
  visit uuid;
  test_item uuid;
  result_item jsonb;
  device uuid := gen_random_uuid();
  view jsonb;
  app_view jsonb;
  appointment date := public.care_today() + 20;
begin
  if exists (select 1 from public.patients where right(mobile, 10) = '9999800098')
    or exists (select 1 from public.care_nurses where phone = '+919999800097') then
    raise exception 'Test numbers already in use; choose unused test numbers.';
  end if;
  nurse := public.care_add_nurse('DHRUVA', 'TEST Next Visit', '9999800097', '4821');
  select id into strict doctor from public.care_doctors where display_name = 'Dr. Mounika';
  view := public.care_nurse_add_patient(nurse, '9999800098', 'TEST Next Visit', null);
  patient := (view->'patient'->>'id')::uuid;
  view := public.care_nurse_start_pregnancy(nurse, patient, 'TEST Next Visit', public.care_today() - 122, null, doctor, null);
  plan := (view->'plans'->0->>'id')::uuid;
  visit := (view->'plans'->0->'visits'->0->>'id')::uuid;
  perform public.care_nurse_set_dates(nurse, patient,
    jsonb_build_array(jsonb_build_object('planId', plan, 'visitId', visit, 'date', appointment)), '[]');
  perform public.care_nurse_save_visit(nurse, patient, '[]', null, '', doctor, null, plan);

  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values (device, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
  insert into public.patient_device_links (patient_id, owner_user_id) values (patient, device);
  perform set_config('request.jwt.claims', json_build_object('sub', device, 'role', 'authenticated')::text, true);
  app_view := public.care_get_my_care_v2('9999800098');
  insert into next_visit_results values ('reproduces missing follow-up after a blank save', app_view->'followup' = 'null'::jsonb);

  -- Separate requests have different transaction timestamps; simulate that
  -- here because now() is constant throughout this rollback-only test.
  update public.care_followups set created_at = now() - interval '1 second' where patient_id = patient;
  view := public.care_nurse_save_visit(nurse, patient, '[]', appointment, '', doctor, null, plan);
  insert into next_visit_results values ('nurse response includes the booked date', (view->'lastFollowup'->>'nextDate')::date = appointment);
  app_view := public.care_get_my_care_v2('9999800098');
  insert into next_visit_results values ('patient app receives the booked date', (app_view->'followup'->>'nextDate')::date = appointment);
  insert into next_visit_results values ('patient app retains the plan doctor', app_view->'followup'->>'doctorName' = 'Dr. Mounika');
  insert into next_visit_results values ('existing appointment date is unchanged', exists (
    select 1 from public.care_plan_visit_dates where plan_id = plan and visit_id = visit and planned_date = appointment
  ));

  select (i->>'id')::uuid into test_item
  from jsonb_array_elements(app_view->'plans'->0->'visits') v,
       jsonb_array_elements(v->'items') i
  where (v->>'id')::uuid = visit limit 1;
  insert into next_visit_results values ('patient app receives explicit booked date independently of schedule', exists (
    select 1 from jsonb_array_elements(app_view->'plans'->0->'visits') v
    where (v->>'id')::uuid = visit and (v->>'plannedDate')::date = appointment
      and (v->>'fromDate')::date <> appointment
  ));
  perform public.care_nurse_save_visit(nurse, patient,
    jsonb_build_array(jsonb_build_object('planId',plan,'itemId',test_item,'status','done','doneOn',public.care_today()-1)),
    appointment,'',doctor,null,plan);
  insert into next_visit_results values ('historical completion stores yesterday, not entry date', exists (
    select 1 from public.care_plan_items where plan_id=plan and item_id=test_item and status='done' and done_on=public.care_today()-1
  ));
  perform public.care_nurse_save_visit(nurse, patient,
    jsonb_build_array(jsonb_build_object('planId',plan,'itemId',test_item,'status','done')),
    appointment,'',doctor,null,plan);
  insert into next_visit_results values ('older clients cannot overwrite an existing historical completion date', exists (
    select 1 from public.care_plan_items where plan_id=plan and item_id=test_item and done_on=public.care_today()-1
  ));
  begin
    perform public.care_nurse_save_visit(nurse, patient,
      jsonb_build_array(jsonb_build_object('planId',plan,'itemId',test_item,'status','done','doneOn',public.care_today()+1)),
      appointment,'',doctor,null,plan);
    insert into next_visit_results values ('future completion rejected', false);
  exception when others then
    insert into next_visit_results values ('future completion rejected', sqlerrm='invalid_done_date');
  end;
  insert into next_visit_results values ('nurse save remains inaccessible to patient roles',
    not has_function_privilege('anon','public.care_nurse_save_visit(uuid,uuid,jsonb,date,text,uuid,text,uuid)','execute')
    and not has_function_privilege('authenticated','public.care_nurse_save_visit(uuid,uuid,jsonb,date,text,uuid,text,uuid)','execute'));
end $$;
select * from next_visit_results;
rollback;
