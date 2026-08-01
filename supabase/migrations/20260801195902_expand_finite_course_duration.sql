alter table public.patient_medicine_courses
  drop constraint if exists patient_medicine_course_schedule_valid;

alter table public.patient_medicine_courses
  add constraint patient_medicine_course_schedule_valid check (
    (
      schedule_mode = 'finite'
      and duration_days between 1 and 365
      and stopped_at is null
    )
    or (
      schedule_mode = 'ongoing'
      and duration_days is null
      and day_pattern = 'daily'
    )
  );
