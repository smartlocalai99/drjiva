-- Health Feed: a hospital can ask that its patients see only its own
-- doctors' reels. Dhruva asked for it (its patients see Dr. Mounika's
-- reels only); every other patient still sees all reels.
-- Additions only: two columns, an index, two functions.

alter table public.hospitals
  add column if not exists feed_own_doctors_only boolean not null default false;

-- Which hospital a reel-posting doctor belongs to (doctors.hospital_name is
-- free text and does not always match hospitals.name).
alter table public.doctors
  add column if not exists hospital_id uuid references public.hospitals (id);

create index if not exists doctors_hospital_id_idx
  on public.doctors (hospital_id) where hospital_id is not null;

-- The doctors who post reels today.
update public.doctors d
set hospital_id = h.id
from public.hospitals h
where h.code = 'DHRUVA' and d.display_name = 'Dr. Mounika' and d.hospital_name ilike 'dhruva%' and d.hospital_id is null;

update public.doctors d
set hospital_id = h.id
from public.hospitals h
where h.code = 'AMSH' and d.display_name = 'Dr. Ritish Reddy' and d.hospital_name ilike 'asian%' and d.hospital_id is null;

update public.hospitals set feed_own_doctors_only = true where code = 'DHRUVA';

-- The reel authors this phone may see: null = everyone. When a patient on
-- this phone belongs to a hospital that asked for its own doctors only,
-- the doctors of that patient's hospitals. Uses the phone's own login,
-- returns only doctor phone numbers (already public on their reels).
create or replace function public.health_feed_doctor_scope()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  with my_patients as (
    select dl.patient_id
    from public.patient_device_links dl
    where dl.owner_user_id = auth.uid()
  ),
  my_hospitals as (
    select c.hospital_id from public.patient_medicine_courses c join my_patients p on p.patient_id = c.patient_id where c.hospital_id is not null
    union
    select hp.hospital_id from public.care_hospital_patients hp join my_patients p on p.patient_id = hp.patient_id
    union
    select f.hospital_id from public.care_followups f join my_patients p on p.patient_id = f.patient_id
    union
    select pl.hospital_id from public.care_plans pl join my_patients p on p.patient_id = pl.patient_id
    union
    select cy.hospital_id from public.care_cycles cy join my_patients p on p.patient_id = cy.patient_id
  ),
  own_doctors as (
    select array_agg(d.phone_number order by d.phone_number) as phones
    from public.doctors d
    where d.is_active and d.hospital_id in (select mh.hospital_id from my_hospitals mh)
  )
  select case
    when exists (
      select 1 from my_hospitals mh join public.hospitals h on h.id = mh.hospital_id
      where h.feed_own_doctors_only
    )
    -- No doctor linked yet: show everything rather than an empty feed.
    then (select od.phones from own_doctors od)
    else null
  end;
$$;

-- The reels feed: health_posts limited to the scope above, newest first
-- (the API cannot sort a function's rows itself). Runs with the caller's
-- rights, so the usual access rules on health_posts still apply.
create or replace function public.health_feed_posts()
returns setof public.health_posts
language sql
stable
security invoker
set search_path = ''
as $$
  with scope as (select public.health_feed_doctor_scope() as phones)
  select hp.*
  from public.health_posts hp, scope
  where scope.phones is null or hp.doctor_phone = any (scope.phones)
  order by hp.published_at desc nulls last, hp.created_at desc;
$$;

revoke all on function public.health_feed_doctor_scope() from public;
revoke all on function public.health_feed_posts() from public;
grant execute on function public.health_feed_doctor_scope() to anon, authenticated;
grant execute on function public.health_feed_posts() to anon, authenticated;
