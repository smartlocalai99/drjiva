-- Anonymous app sessions can change after an app reinstall. A patient can
-- therefore have more than one legitimate session owner over time. Keying
-- settings only by patient_id caused an older, RLS-hidden row to block a new
-- session from inserting its own settings.
alter table public.patient_notification_settings
  drop constraint patient_notification_settings_pkey;

alter table public.patient_notification_settings
  drop constraint patient_notification_settings_patient_id_owner_user_id_key;

alter table public.patient_notification_settings
  add constraint patient_notification_settings_pkey
  primary key (patient_id, owner_user_id);

create or replace function public.replace_patient_notification_schedule(
  p_patient_id uuid,
  p_morning_time time,
  p_afternoon_time time,
  p_night_time time,
  p_timezone text,
  p_updates jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  affected integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  insert into public.patient_notification_settings (
    patient_id,
    owner_user_id,
    morning_time,
    afternoon_time,
    night_time,
    timezone,
    updated_at
  )
  values (
    p_patient_id,
    (select auth.uid()),
    p_morning_time,
    p_afternoon_time,
    p_night_time,
    p_timezone,
    now()
  )
  on conflict (patient_id, owner_user_id) do update
  set morning_time = excluded.morning_time,
      afternoon_time = excluded.afternoon_time,
      night_time = excluded.night_time,
      timezone = excluded.timezone,
      updated_at = now();

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Notification settings could not be saved';
  end if;

  for item in select value from jsonb_array_elements(p_updates)
  loop
    update public.patient_medicine_dose_events
    set scheduled_for = (item->>'scheduled_for')::timestamptz,
        notification_id = nullif(item->>'notification_id', ''),
        updated_at = now()
    where id = (item->>'event_id')::uuid
      and patient_id = p_patient_id
      and owner_user_id = (select auth.uid())
      and status = 'scheduled';

    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'Dose event ownership or state mismatch';
    end if;
  end loop;
end;
$$;

revoke all on function public.replace_patient_notification_schedule(
  uuid, time, time, time, text, jsonb
) from public, anon;

grant execute on function public.replace_patient_notification_schedule(
  uuid, time, time, time, text, jsonb
) to authenticated;
