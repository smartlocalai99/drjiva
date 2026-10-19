-- 1. Medicine alarms: a phone saves the IDs of all its alerts in one call
--    (it was one update per alert, about 70, which stopped halfway when the
--    app went to the background). Runs as the caller, so the existing access
--    rules decide which dose rows it may touch.
-- 2. Visit reminders: phones now always set their own 8 PM / 8 AM alarms.
--    The server pushes only to phones that have not opened the app since the
--    nurse set the date (their push token was last refreshed before it), so
--    nobody gets the same reminder twice once iPhone push works.
-- Only adds a function and replaces care_send_followup_reminders.

create or replace function public.save_dose_notification_ids(
  p_event_ids uuid[],
  p_notification_ids text[]
)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  with x as (
    select t.event_id, t.notification_id
    from unnest(p_event_ids, p_notification_ids) as t(event_id, notification_id)
    where t.event_id is not null and t.notification_id is not null
  ), changed as (
    update public.patient_medicine_dose_events e
    set notification_id = x.notification_id
    from x
    where e.id = x.event_id
    returning 1
  )
  select count(*)::integer from changed;
$$;

revoke all on function public.save_dose_notification_ids(uuid[], text[]) from public, anon;
grant execute on function public.save_dose_notification_ids(uuid[], text[]) to authenticated;

create or replace function public.care_send_followup_reminders(p_kind text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target date;
  v_messages jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_badge integer;
  r record;
begin
  if p_kind is null or p_kind not in ('eve', 'day') then
    raise exception 'kind must be eve or day';
  end if;
  v_target := public.care_today() + case when p_kind = 'eve' then 1 else 0 end;

  for r in
    with newest as (
      select distinct on (f.patient_id, f.hospital_id)
        f.id, f.patient_id, f.hospital_id, f.next_date, f.created_at
      from public.care_followups f
      order by f.patient_id, f.hospital_id, f.created_at desc
    )
    select
      n.id as followup_id,
      n.next_date,
      h.name as hospital_name,
      t.owner_user_id,
      t.patient_id,
      t.expo_push_token,
      t.language
    from newest n
    join public.hospitals h on h.id = n.hospital_id
    join public.care_push_tokens t on t.patient_id = n.patient_id
    join public.patient_device_links dl
      on dl.patient_id = t.patient_id and dl.owner_user_id = t.owner_user_id
    where n.next_date = v_target
      -- The phone opened the app after the date was set: it has its own
      -- alarms for this visit.
      and t.updated_at < n.created_at
      and not exists (
        select 1 from public.care_followup_reminder_log l
        where l.followup_id = n.id and l.kind = p_kind and l.owner_user_id = t.owner_user_id
      )
  loop
    insert into public.care_followup_reminder_log (followup_id, kind, owner_user_id)
    values (r.followup_id, p_kind, r.owner_user_id)
    on conflict do nothing;

    -- The app icon shows how many visit reminders are unread on this phone
    -- (1 the night before, 2 on the morning); opening My Care clears it.
    update public.care_push_tokens
    set unread = unread + 1
    where owner_user_id = r.owner_user_id and patient_id = r.patient_id;
    select coalesce(sum(t2.unread), 1)::integer into v_badge
    from public.care_push_tokens t2
    where t2.owner_user_id = r.owner_user_id;

    v_messages := v_messages || jsonb_build_array(jsonb_build_object(
      'to', r.expo_push_token,
      'title', case
        when r.language = 'te' and p_kind = 'eve' then 'రేపు హాస్పిటల్ సందర్శన'
        when r.language = 'te' then 'ఈరోజు హాస్పిటల్ సందర్శన'
        when p_kind = 'eve' then 'Hospital visit tomorrow'
        else 'Hospital visit today'
      end,
      'body', case
        when r.language = 'te' and p_kind = 'eve' then r.hospital_name || ' లో మీ ఫాలో-అప్ సందర్శన రేపు ఉంది.'
        when r.language = 'te' then r.hospital_name || ' లో మీ ఫాలో-అప్ సందర్శన ఈరోజు ఉంది.'
        when p_kind = 'eve' then 'Your follow-up visit at ' || r.hospital_name || ' is tomorrow, ' || to_char(r.next_date, 'Dy DD Mon') || '.'
        else 'Your follow-up visit at ' || r.hospital_name || ' is today. Please visit the hospital.'
      end,
      'sound', 'default',
      'badge', v_badge,
      'channelId', 'care-followups',
      'priority', 'high',
      'data', jsonb_build_object('type', 'care_followup', 'followupId', r.followup_id)
    ));
    v_count := v_count + 1;

    if jsonb_array_length(v_messages) >= 100 then
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := v_messages,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
        timeout_milliseconds := 10000
      );
      v_messages := '[]'::jsonb;
    end if;
  end loop;

  if jsonb_array_length(v_messages) > 0 then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_messages,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      timeout_milliseconds := 10000
    );
  end if;

  return v_count;
end;
$$;
