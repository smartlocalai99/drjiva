-- Nurse desk: add several tests / scans from the case sheet in one save.
-- One call, one transaction, one page view back (instead of one call per test).
-- Only adds a function; care_nurse_add_extra_item stays as it is.

create or replace function public.care_nurse_add_extra_items(
  p_nurse_id uuid,
  p_patient_id uuid,
  p_labels text[],
  p_due_date date,
  p_done boolean default false,
  p_plan_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nurse public.care_nurses := public.care_require_nurse(p_nurse_id);
  v_today date := public.care_today();
  v_done boolean := coalesce(p_done, false);
  v_labels text[];
  v_plan_id uuid;
begin
  perform public.care_assert_hospital_patient(v_nurse.hospital_id, p_patient_id);

  -- Tidy spaces, drop blanks and repeats (case-insensitive), keep the order picked.
  select coalesce(array_agg(l.label order by l.first_at), '{}')
  into v_labels
  from (
    select distinct on (lower(c.label)) c.label, c.ord as first_at
    from (
      select btrim(regexp_replace(coalesce(x.raw, ''), '\s+', ' ', 'g')) as label, x.ord
      from unnest(p_labels) with ordinality as x(raw, ord)
    ) c
    where c.label <> ''
    order by lower(c.label), c.ord
  ) l;

  if cardinality(v_labels) = 0 or cardinality(v_labels) > 30 then
    raise exception 'invalid_test_name' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_labels) l where char_length(l) < 2 or char_length(l) > 80) then
    raise exception 'invalid_test_name' using errcode = '22023';
  end if;
  if p_due_date is null or p_due_date < v_today - 60 or p_due_date > v_today + 400 then
    raise exception 'invalid_test_date' using errcode = '22023';
  end if;
  if v_done and p_due_date > v_today then
    raise exception 'invalid_test_date' using errcode = '22023';
  end if;
  if p_plan_id is not null then
    select p.id into v_plan_id
    from public.care_plans p
    where p.id = p_plan_id and p.patient_id = p_patient_id and p.status = 'active';
    if v_plan_id is null then
      raise exception 'unknown_plan' using errcode = '22023';
    end if;
  end if;

  insert into public.care_extra_items
    (hospital_id, patient_id, plan_id, label, due_date, status, done_on,
     status_by_nurse_id, status_by_nurse_name, added_by_nurse_id, added_by_nurse_name)
  select
    v_nurse.hospital_id, p_patient_id, v_plan_id, l.label, p_due_date,
    case when v_done then 'done' end,
    case when v_done then v_today end,
    case when v_done then v_nurse.id end,
    case when v_done then v_nurse.display_name end,
    v_nurse.id, v_nurse.display_name
  from unnest(v_labels) with ordinality as l(label, ord)
  order by l.ord;

  perform public.care_link_hospital_patient(v_nurse.hospital_id, p_patient_id, v_nurse.id);
  return public.care_nurse_patient_v2(p_nurse_id, p_patient_id);
end;
$$;

revoke all on function public.care_nurse_add_extra_items(uuid, uuid, text[], date, boolean, uuid) from public, anon, authenticated;
grant execute on function public.care_nurse_add_extra_items(uuid, uuid, text[], date, boolean, uuid) to service_role;
