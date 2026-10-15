-- Health Feed: a switch to keep a doctor's reels out of the patient feed
-- for now (nothing is deleted; turn it off to show them again).
-- 2026-10-15: only Dr. Mounika's reels for patients; Dr. Ritish Reddy
-- (Asian Hospitals) hidden. Additions only: one column, new function body.

alter table public.doctors
  add column if not exists hide_from_feed boolean not null default false;

update public.doctors
set hide_from_feed = true
where display_name = 'Dr. Ritish Reddy' and hospital_name ilike 'asian%';

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
  where (scope.phones is null or hp.doctor_phone = any (scope.phones))
    and not exists (
      select 1 from public.doctors d
      where d.phone_number = hp.doctor_phone and d.hide_from_feed
    )
  order by hp.published_at desc nulls last, hp.created_at desc;
$$;
