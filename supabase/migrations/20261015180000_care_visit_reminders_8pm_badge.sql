-- Visit reminders, 2026-10-15 (asked by the hospital): 8 PM the night
-- before (was 6 PM) and 8 AM on the visit day, as push notifications with
-- a number badge on the app icon that clears when the patient opens My
-- Care. Additions only: one column, one function, a new body for
-- care_send_followup_reminders, and the evening job moved to 8 PM IST.

alter table public.care_push_tokens
  add column if not exists unread integer not null default 0;

create or replace function public.care_send_followup_reminders(p_kind text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
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
        f.id, f.patient_id, f.hospital_id, f.next_date
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

-- The patient opened My Care: no unread visit reminders on this phone.
create or replace function public.care_mark_reminders_seen()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.care_push_tokens set unread = 0
  where owner_user_id = auth.uid() and unread <> 0;
$$;

revoke all on function public.care_mark_reminders_seen() from public, anon;
grant execute on function public.care_mark_reminders_seen() to authenticated;

-- 8 PM India time (14:30 UTC) the night before; the 8 AM job stays.
select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'care-followup-eve'), schedule := '30 14 * * *');
