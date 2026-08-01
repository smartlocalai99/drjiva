begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(3);

insert into auth.users(id)
values ('11000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.patients(id, mobile, name)
values (
  '21000000-0000-0000-0000-000000000001',
  '+919900000101',
  'Course Duration Test Patient'
)
on conflict (id) do nothing;

insert into public.hospitals(id, name)
values (
  '31000000-0000-0000-0000-000000000001',
  'Course Duration Test Hospital'
)
on conflict (id) do nothing;

insert into public.medicines(
  id,
  name,
  hospital_name,
  hospital_id,
  code
)
values (
  '41000000-0000-0000-0000-000000000001',
  'Course Duration Test Medicine',
  'Course Duration Test Hospital',
  '31000000-0000-0000-0000-000000000001',
  'COURSE-DURATION-TEST'
)
on conflict (id) do nothing;

select lives_ok(
  $$
    insert into public.patient_medicine_courses(
      patient_id,
      owner_user_id,
      hospital_id,
      medicine_id,
      tablets_per_dose,
      start_date,
      duration_days,
      day_pattern,
      schedule_mode
    )
    values (
      '21000000-0000-0000-0000-000000000001',
      '11000000-0000-0000-0000-000000000001',
      '31000000-0000-0000-0000-000000000001',
      '41000000-0000-0000-0000-000000000001',
      1,
      current_date,
      365,
      'daily',
      'finite'
    )
  $$,
  'finite courses accept 365 days'
);

select throws_ok(
  $$
    insert into public.patient_medicine_courses(
      patient_id,
      owner_user_id,
      hospital_id,
      medicine_id,
      tablets_per_dose,
      start_date,
      duration_days,
      day_pattern,
      schedule_mode
    )
    values (
      '21000000-0000-0000-0000-000000000001',
      '11000000-0000-0000-0000-000000000001',
      '31000000-0000-0000-0000-000000000001',
      '41000000-0000-0000-0000-000000000001',
      1,
      current_date,
      366,
      'daily',
      'finite'
    )
  $$,
  '23514',
  null,
  'finite courses reject more than 365 days'
);

select lives_ok(
  $$
    insert into public.patient_medicine_courses(
      patient_id,
      owner_user_id,
      hospital_id,
      medicine_id,
      tablets_per_dose,
      start_date,
      duration_days,
      day_pattern,
      schedule_mode
    )
    values (
      '21000000-0000-0000-0000-000000000001',
      '11000000-0000-0000-0000-000000000001',
      '31000000-0000-0000-0000-000000000001',
      '41000000-0000-0000-0000-000000000001',
      1,
      current_date,
      null,
      'daily',
      'ongoing'
    )
  $$,
  'Everyday courses keep a null duration'
);

select * from finish();

rollback;
