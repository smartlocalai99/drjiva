-- Fixes reminders being tied to whichever device/anonymous session created
-- them instead of the patient's mobile number. Today, patient_medicine_courses
-- RLS only allows owner_user_id = auth.uid() — so a medicine added on one
-- phone (e.g. a parent's) is invisible when the same patient's mobile number
-- is used to log in on a different phone. patient_device_links records every
-- device that has ever logged in as (or added a medicine for) a given
-- patient's mobile number, and new RLS policies grant those devices full
-- access to that patient's medicine courses/slots/dose events regardless of
-- which device originally created the row. This is additive — the existing
-- owner_user_id-based policies are untouched, so nothing that already works
-- can break.

create table public.patient_device_links (
  patient_id uuid not null references public.patients(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (patient_id, owner_user_id)
);

alter table public.patient_device_links enable row level security;

grant select, insert on public.patient_device_links to authenticated;

create policy "Devices see their own patient links"
on public.patient_device_links
for select to authenticated
using (owner_user_id = auth.uid());

create or replace function public.link_patient_device(p_mobile text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_mobile text;
  v_patient_id uuid;
begin
  if v_owner is null then
    raise exception 'Not authenticated';
  end if;

  v_mobile := right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10);
  if length(v_mobile) <> 10 then
    return;
  end if;

  select id into v_patient_id
  from public.patients
  where mobile = v_mobile;

  if v_patient_id is null then
    return;
  end if;

  insert into public.patient_device_links (patient_id, owner_user_id)
  values (v_patient_id, v_owner)
  on conflict (patient_id, owner_user_id) do nothing;
end;
$$;

revoke all on function public.link_patient_device(text) from public;
grant execute on function public.link_patient_device(text) to authenticated;

create policy "Linked devices access patient medicine courses"
on public.patient_medicine_courses
for all to authenticated
using (
  exists (
    select 1 from public.patient_device_links dl
    where dl.patient_id = patient_medicine_courses.patient_id
      and dl.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.patient_device_links dl
    where dl.patient_id = patient_medicine_courses.patient_id
      and dl.owner_user_id = auth.uid()
  )
);

create policy "Linked devices access patient medicine course slots"
on public.patient_medicine_course_slots
for all to authenticated
using (
  exists (
    select 1 from public.patient_medicine_courses c
    join public.patient_device_links dl on dl.patient_id = c.patient_id
    where c.id = patient_medicine_course_slots.course_id
      and dl.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.patient_medicine_courses c
    join public.patient_device_links dl on dl.patient_id = c.patient_id
    where c.id = patient_medicine_course_slots.course_id
      and dl.owner_user_id = auth.uid()
  )
);

create policy "Linked devices access patient medicine dose events"
on public.patient_medicine_dose_events
for all to authenticated
using (
  exists (
    select 1 from public.patient_device_links dl
    where dl.patient_id = patient_medicine_dose_events.patient_id
      and dl.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.patient_device_links dl
    where dl.patient_id = patient_medicine_dose_events.patient_id
      and dl.owner_user_id = auth.uid()
  )
);
