-- Booked appointments are separate from schedule windows. Historical completion
-- dates are optional, so existing clients continue to work unchanged.
-- Ordered after the existing child-schedule care_plan_view replacement.

CREATE OR REPLACE FUNCTION public.care_plan_view(p_plan_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with cp as (
    select
      p.*,
      h.name as hospital_name,
      case when p.plan_type = 'pregnancy' then p.edd_date - 280 else p.birth_date end as start_date,
      sn.display_name as started_by_name
    from public.care_plans p
    join public.hospitals h on h.id = p.hospital_id
    left join public.care_nurses sn on sn.id = p.started_by_nurse_id
    where p.id = p_plan_id
  ),
  visits as (
    select v.id, v.code, v.title_en, v.title_te, v.sort_order, w.from_date, w.to_date
    from cp
    join public.care_schedule_visits v on v.plan_type = cp.plan_type and v.is_active
      -- The hospital's own schedule if it has one, else the standard one.
      and v.hospital_id is not distinct from (
        select hs.hospital_id
        from public.care_schedule_visits hs
        where hs.plan_type = cp.plan_type and hs.hospital_id = cp.hospital_id and hs.is_active
        limit 1
      )
    cross join lateral public.care_window(cp.start_date, v.due_unit, v.due_from, v.due_to) w
  ),
  items as (
    select
      i.id,
      i.code,
      i.label_en,
      i.label_te,
      i.sort_order,
      vis.id as visit_id,
      (i.is_conditional or (i.only_for_gender is not null and cp.child_gender is null)) as conditional,
      i.is_optional as optional,
      coalesce(iw.from_date, vis.from_date) + i.due_plus_days as from_date,
      coalesce(iw.to_date, vis.to_date) + i.due_plus_days as to_date,
      pi.status,
      pi.done_on,
      pn.display_name as nurse_name
    from visits vis
    join public.care_schedule_items i on i.visit_id = vis.id and i.is_active
    cross join cp
    left join lateral (
      select w2.from_date, w2.to_date
      from public.care_window(cp.start_date, i.due_unit, i.due_from, i.due_to) w2
      where i.due_unit is not null
    ) iw on true
    left join public.care_plan_items pi on pi.plan_id = cp.id and pi.item_id = i.id
    left join public.care_nurses pn on pn.id = pi.nurse_id
    where i.only_for_gender is null
       or cp.child_gender is null
       or i.only_for_gender = cp.child_gender
  )
  select jsonb_build_object(
    'id', cp.id,
    'type', cp.plan_type,
    'status', cp.status,
    'personName', cp.person_name,
    'lmpDate', cp.lmp_date,
    'eddDate', cp.edd_date,
    'birthDate', cp.birth_date,
    'gender', cp.child_gender,
    'startDate', cp.start_date,
    'hospitalId', cp.hospital_id,
    'hospitalName', cp.hospital_name,
    'doctorName', cp.doctor_name,
    'startedByNurse', cp.started_by_name,
    'createdAt', cp.created_at,
    'hiddenByPatient', cp.hidden_by_patient_at is not null,
    'visits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', vis.id,
        'plannedDate', (select d.planned_date from public.care_plan_visit_dates d where d.plan_id = cp.id and d.visit_id = vis.id),
        'code', vis.code,
        'titleEn', vis.title_en,
        'titleTe', vis.title_te,
        'fromDate', vis.from_date,
        'toDate', vis.to_date,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', it.id,
            'code', it.code,
            'labelEn', it.label_en,
            'labelTe', it.label_te,
            'conditional', it.conditional,
            'optional', it.optional,
            'fromDate', it.from_date,
            'toDate', it.to_date,
            'status', it.status,
            'doneOn', it.done_on,
            'nurseName', it.nurse_name
          ) order by it.sort_order)
          from items it
          where it.visit_id = vis.id
        ), '[]'::jsonb)
      ) order by vis.sort_order)
      from visits vis
    ), '[]'::jsonb)
  )
  from cp;
$function$
;

CREATE OR REPLACE FUNCTION public.care_nurse_save_visit(p_nurse_id uuid, p_patient_id uuid, p_items jsonb, p_next_date date, p_note text, p_care_doctor_id uuid DEFAULT NULL::uuid, p_doctor_name text DEFAULT NULL::text, p_plan_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_nurse public.care_nurses := public.care_require_nurse(p_nurse_id);
  v_today date := public.care_today();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_item jsonb;
  v_plan_id uuid;
  v_item_id uuid;
  v_status text;
  v_done_on date;
  v_doctor_id uuid;
  v_doctor_name text;
  v_department text;
begin
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, p_patient_id);

  if p_next_date is not null and (p_next_date < v_today or p_next_date > v_today + 400) then
    raise exception 'invalid_next_date' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;
  if p_plan_id is not null and not exists (
    select 1 from public.care_plans p where p.id = p_plan_id and p.patient_id = p_patient_id
  ) then
    raise exception 'unknown_plan' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_plan_id := (v_item ->> 'planId')::uuid;
    v_item_id := (v_item ->> 'itemId')::uuid;
    v_status := v_item ->> 'status';
    v_done_on := null;
    if v_item ? 'doneOn' then
      begin
        v_done_on := (v_item ->> 'doneOn')::date;
      exception when others then
        raise exception 'invalid_done_date' using errcode = '22023';
      end;
      if v_done_on is null or v_done_on > v_today or v_done_on < date '1900-01-01' then
        raise exception 'invalid_done_date' using errcode = '22023';
      end if;
    end if;

    if not exists (
      select 1
      from public.care_plans p
      join public.care_schedule_visits sv on sv.plan_type = p.plan_type
      join public.care_schedule_items si on si.visit_id = sv.id
      where p.id = v_plan_id
        and p.patient_id = p_patient_id
        and p.hospital_id = v_nurse.hospital_id
        and p.status = 'active'
        and si.id = v_item_id
    ) then
      raise exception 'unknown_item' using errcode = '22023';
    end if;

    if v_status in ('done', 'not_needed') then
      insert into public.care_plan_items (plan_id, item_id, status, done_on, nurse_id, hospital_id, updated_at)
      values (v_plan_id, v_item_id, v_status, coalesce(v_done_on, v_today), v_nurse.id, v_nurse.hospital_id, now())
      on conflict (plan_id, item_id) do update
        set status = excluded.status,
            done_on = case when v_done_on is not null then v_done_on
              when care_plan_items.status = excluded.status then care_plan_items.done_on
              else excluded.done_on end,
            nurse_id = excluded.nurse_id,
            hospital_id = excluded.hospital_id,
            updated_at = now();
    elsif v_status = 'clear' then
      delete from public.care_plan_items where plan_id = v_plan_id and item_id = v_item_id;
    else
      raise exception 'invalid_item_status' using errcode = '22023';
    end if;
  end loop;

  select r.care_doctor_id, r.doctor_name, r.department
  into v_doctor_id, v_doctor_name, v_department
  from public.care_nurse_resolve_doctor(v_nurse.hospital_id, p_care_doctor_id, p_doctor_name) r;

  insert into public.care_followups
    (patient_id, plan_id, hospital_id, nurse_id, nurse_name, doctor_name, care_doctor_id, department, visit_date, next_date, note)
  values
    (p_patient_id, p_plan_id, v_nurse.hospital_id, v_nurse.id, v_nurse.display_name, v_doctor_name, v_doctor_id,
     coalesce(v_department, 'general'), v_today, p_next_date, v_note);

  perform public.care_link_hospital_patient(v_nurse.hospital_id, p_patient_id, v_nurse.id);
  return public.care_nurse_patient(p_nurse_id, p_patient_id);
end;
$function$
;
