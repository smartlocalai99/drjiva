-- Weekly patient reminders use one dose day every seven calendar days.
-- Existing courses and the ongoing daily reminder mode are unchanged.
alter table public.patient_medicine_courses
  drop constraint patient_medicine_courses_day_pattern_check;

alter table public.patient_medicine_courses
  add constraint patient_medicine_courses_day_pattern_check
  check (day_pattern in ('daily', 'alternate', 'weekly'));
