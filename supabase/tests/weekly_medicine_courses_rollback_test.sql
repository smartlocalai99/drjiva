-- Run after applying the weekly migration inside a transaction; always roll back.
-- Copy the live table's constraints to a temporary table, without touching patients.
create temporary table weekly_course_check (like public.patient_medicine_courses including all) on commit drop;
insert into weekly_course_check select * from public.patient_medicine_courses limit 1;
do $test$
begin
  if not exists (select 1 from weekly_course_check) then
    raise exception 'A course fixture is required';
  end if;
  update weekly_course_check set schedule_mode='finite', duration_days=28,
    stopped_at=null, day_pattern='weekly';
  update weekly_course_check set day_pattern='alternate';
  update weekly_course_check set day_pattern='daily';
  begin
    update weekly_course_check set day_pattern='unknown';
    raise exception 'Invalid pattern was accepted';
  exception when check_violation then null;
  end;
  update weekly_course_check set schedule_mode='ongoing', duration_days=null;
  begin
    update weekly_course_check set day_pattern='weekly';
    raise exception 'Daily-only ongoing mode accepted weekly';
  exception when check_violation then null;
  end;
end $test$;
select 'weekly finite saves; daily/alternate preserved; invalid patterns rejected; ongoing daily preserved' as passed;
