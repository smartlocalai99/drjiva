-- Add medicine: doctors listed for the picked hospital (safe on production: rolled back).
begin;

create temp table t_results (seq serial, name text, ok boolean, detail text) on commit drop;
grant all on t_results to authenticated, anon;
grant all on sequence t_results_seq_seq to authenticated, anon;

do $$
declare
  v_phone uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
  values (v_phone, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
  perform set_config('test.phone', v_phone::text, true);
  perform set_config('test.dhruva', (select id::text from public.hospitals where code = 'DHRUVA'), true);
end;
$$;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.phone'), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into t_results (name, ok, detail)
select 'Dhruva lists Dr. Mounika and Dr. Sudarshan Reddy',
  array_agg(display_name order by display_name) = array['Dr. Mounika', 'Dr. Sudarshan Reddy'],
  string_agg(display_name, ', ')
from public.medicine_doctors_for_hospital(current_setting('test.dhruva')::uuid);
insert into t_results (name, ok, detail)
select 'unknown hospital lists nobody', count(*) = 0, count(*)::text
from public.medicine_doctors_for_hospital(gen_random_uuid());
reset role;

insert into t_results (name, ok, detail)
select 'signed-in phones only',
  has_function_privilege('authenticated', 'public.medicine_doctors_for_hospital(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.medicine_doctors_for_hospital(uuid)', 'execute'), 'grants';

select jsonb_agg(jsonb_build_object('ok', ok, 'test', name, 'detail', detail) order by seq) as results from t_results;

rollback;
