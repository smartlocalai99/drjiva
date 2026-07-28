-- supabase/migrations/0003_notifications.sql

-- 1. Create function to trigger instant notification on new dispense
create or replace function public.notify_on_dispense()
returns trigger as $$
declare
  patient_name text;
  payload jsonb;
  request_id bigint;
begin
  select name into patient_name
  from public.patients
  where id = new.patient_id;

  payload := jsonb_build_object(
    'patient_id', new.patient_id,
    'title', 'New Prescription Added',
    'body', coalesce(patient_name, 'Patient') || ', your hospital Kadapa General Pharmacy has dispensed new medicines for you. Check details in your app.'
  );

  select net.http_post(
    url := 'https://jlvjnnltynebenflkcua.supabase.co/functions/v1/send-push'::text,
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsdmpubmx0eW5lYmVuZmxrY3VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDMwMTIyMiwiZXhwIjoyMDk5ODc3MjIyfQ.RT3NAR5dLD9LF5dSd8mi1Ky7CRcJo049Mcg1ZBjcoD8'
    )::jsonb
  ) into request_id;

  return new;
end;
$$ language plpgsql security definer;
-- Create trigger on dispenses table
drop trigger if exists notify_on_dispense_trigger on public.dispenses;
create trigger notify_on_dispense_trigger
after insert on public.dispenses
for each row
execute function public.notify_on_dispense();
-- 2. Create function to send scheduled dose reminders
create or replace function public.notify_daily_doses(target_slot text)
returns void as $$
declare
  r record;
  payload jsonb;
  request_id bigint;
  today_date date := current_date;
begin
  for r in 
    select distinct on (di.patient_id) 
      di.patient_id,
      p.name as patient_name,
      m.name as medicine_name,
      di.quantity
    from public.dispense_items di
    join public.dispenses d on d.id = di.dispense_id
    join public.patients p on p.id = di.patient_id
    join public.medicines m on m.id = di.medicine_id
    where di.timing @> array[target_slot]::text[]
      and d.created_at >= (now() - (di.duration_days || ' days')::interval)
      and not exists (
        select 1 
        from public.dose_logs dl 
        where dl.dispense_item_id = di.id 
          and dl.dose_date = today_date 
          and dl.slot = target_slot
      )
  loop
    payload := jsonb_build_object(
      'patient_id', r.patient_id,
      'title', 'Medicine Reminder (' || initcap(target_slot) || ')',
      'body', 'Hi ' || coalesce(r.patient_name, 'there') || ', it is time to take your ' || r.medicine_name || ' (' || r.quantity || ').'
    );

    select net.http_post(
      url := 'https://jlvjnnltynebenflkcua.supabase.co/functions/v1/send-push'::text,
      body := payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsdmpubmx0eW5lYmVuZmxrY3VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDMwMTIyMiwiZXhwIjoyMDk5ODc3MjIyfQ.RT3NAR5dLD9LF5dSd8mi1Ky7CRcJo049Mcg1ZBjcoD8'
      )::jsonb
    ) into request_id;
  end loop;
end;
$$ language plpgsql security definer;
-- 3. Schedule cron jobs using pg_cron (runs at 8:00 AM, 2:00 PM, and 9:00 PM IST)
-- Convert to UTC: 8:00 AM IST -> 2:30 AM UTC, 2:00 PM IST -> 8:30 AM UTC, 9:00 PM IST -> 3:30 PM UTC
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'morning-dose-reminder';
select cron.schedule('morning-dose-reminder', '30 2 * * *', $$ select public.notify_daily_doses('morning'); $$);
select cron.unschedule(jobid) from cron.job where jobname = 'afternoon-dose-reminder';
select cron.schedule('afternoon-dose-reminder', '30 8 * * *', $$ select public.notify_daily_doses('afternoon'); $$);
select cron.unschedule(jobid) from cron.job where jobname = 'night-dose-reminder';
select cron.schedule('night-dose-reminder', '30 15 * * *', $$ select public.notify_daily_doses('night'); $$);
