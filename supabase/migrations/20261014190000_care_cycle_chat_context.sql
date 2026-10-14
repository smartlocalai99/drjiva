-- My Care, part 6: "Ask DrJiva" knows the patient's fertility treatment
-- day and steps (OI-TI / IUI), so "when is my IUI?" gets a real answer.
-- Only adds a function and re-creates care_chat_begin with the same body
-- plus the cycle in its context. No names or numbers go to the AI.

create or replace function public.care_chat_cycle_context(p_patient_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'treatment', x.v ->> 'titleEn',
    'day1', x.v ->> 'anchorDate',
    'dayOfCycle', (public.care_today() - (x.v ->> 'anchorDate')::date) + 1,
    'steps', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', s ->> 'date',
        'day', ((s ->> 'date')::date - (x.v ->> 'anchorDate')::date) + 1,
        'step', s ->> 'labelEn',
        'who', s ->> 'who',
        'done', (s ->> 'status') is not null
      ) order by s ->> 'date', (s ->> 'day')::integer), '[]'::jsonb)
      from jsonb_array_elements(x.v -> 'steps') s
    )
  )
  from (
    select public.care_cycle_view(c.id) as v
    from public.care_cycles c
    where c.patient_id = p_patient_id and c.status = 'active'
    order by c.created_at desc
    limit 1
  ) x;
$$;

revoke all on function public.care_chat_cycle_context(uuid) from public, anon, authenticated;

create or replace function public.care_chat_begin(p_mobile text, p_message text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_patient_id uuid := public.care_linked_patient_id(p_mobile);
  v_today date := public.care_today();
  v_message text := btrim(coalesce(p_message, ''));
  v_count integer;
  v_message_id uuid;
  v_history jsonb;
begin
  if char_length(v_message) = 0 or char_length(v_message) > 1000 then
    raise exception 'invalid_message' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('care_chat:' || v_patient_id::text, 0));

  select count(*)
  into v_count
  from public.care_chat_messages m
  where m.patient_id = v_patient_id
    and m.role = 'user'
    and (m.created_at at time zone 'Asia/Kolkata')::date = v_today;

  if v_count >= 30 then
    raise exception 'daily_limit' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('role', h.role, 'content', h.content) order by h.created_at), '[]'::jsonb)
  into v_history
  from (
    select m.role, m.content, m.created_at
    from public.care_chat_messages m
    where m.patient_id = v_patient_id
    order by m.created_at desc
    limit 10
  ) h;

  insert into public.care_chat_messages (patient_id, owner_user_id, role, content)
  values (v_patient_id, v_uid, 'user', v_message)
  returning id into v_message_id;

  return jsonb_build_object(
    'messageId', v_message_id,
    'remainingToday', 30 - v_count - 1,
    'history', v_history,
    'context', public.care_chat_context(v_patient_id)
      || jsonb_strip_nulls(jsonb_build_object('cycle', public.care_chat_cycle_context(v_patient_id)))
  );
end;
$$;
