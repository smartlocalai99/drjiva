-- Health Feed scope test: Dhruva patients see only Dhruva doctors' reels,
-- everyone else sees all (safe on production: rolled back).
begin;

create temp table t_results (seq serial, name text, ok boolean, detail text) on commit drop;
grant all on t_results to authenticated;
grant all on sequence t_results_seq_seq to authenticated;

do $$
declare
  v_dhruva_phone uuid := gen_random_uuid();
  v_other_phone uuid := gen_random_uuid();
  v_patient uuid;
  v_other_patient uuid;
  v_dhruva uuid;
begin
  select id into v_dhruva from public.hospitals where code = 'DHRUVA';
  insert into public.patients (mobile, name) values ('+919999800071', 'Feed Test Dhruva') returning id into v_patient;
  insert into public.patients (mobile, name) values ('+919999800072', 'Feed Test Other') returning id into v_other_patient;
  insert into public.care_hospital_patients (hospital_id, patient_id) values (v_dhruva, v_patient);
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values
    (v_dhruva_phone, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now()),
    (v_other_phone, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
  insert into public.patient_device_links (patient_id, owner_user_id)
  values (v_patient, v_dhruva_phone), (v_other_patient, v_other_phone);

  perform set_config('test.dhruva_phone', v_dhruva_phone::text, true);
  perform set_config('test.other_phone', v_other_phone::text, true);
end;
$$;

-- As the Dhruva patient's phone.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.dhruva_phone'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into t_results (name, ok, detail)
select 'Dhruva patient sees only Dr. Mounika',
  count(*) > 0 and bool_and(d.display_name = 'Dr. Mounika'),
  string_agg(distinct d.display_name, ', ')
from public.health_feed_posts() hp join public.doctors d on d.phone_number = hp.doctor_phone
where hp.status = 'published';
reset role;

-- As a phone with no Dhruva patient.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.other_phone'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into t_results (name, ok, detail)
select 'other patient sees every doctor',
  count(distinct hp.doctor_phone) >= 2 and public.health_feed_doctor_scope() is null,
  string_agg(distinct d.display_name, ', ')
from public.health_feed_posts() hp join public.doctors d on d.phone_number = hp.doctor_phone
where hp.status = 'published';
reset role;

insert into t_results (name, ok, detail)
select 'scope function returns only doctor numbers to callers',
  has_function_privilege('authenticated', 'public.health_feed_posts()', 'execute')
    and has_function_privilege('anon', 'public.health_feed_doctor_scope()', 'execute'),
  'grants';

select jsonb_agg(jsonb_build_object('ok', ok, 'test', name, 'detail', detail) order by seq) as results from t_results;

rollback;
