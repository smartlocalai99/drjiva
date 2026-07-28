-- Capture catalogue columns already used by the Medico tablet catalogue.
alter table public.medicines
  add column if not exists hospital_id text,
  add column if not exists hospital_name text;

drop policy if exists "staff can create medicines" on public.medicines;
drop policy if exists "staff can update medicines" on public.medicines;
drop policy if exists "anyone can create medicines" on public.medicines;
drop policy if exists "anyone can update medicines" on public.medicines;

create policy "Verified staff can create medicines"
on public.medicines
for insert
to authenticated
with check (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.id = (select auth.uid())
  )
);

create policy "Verified staff can update medicines"
on public.medicines
for update
to authenticated
using (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.id = (select auth.uid())
  )
);

-- Preserve the separate unauthenticated tablet-collector workflow without
-- allowing anonymous-authenticated patient sessions to mutate catalogues.
create policy "Tablet collectors can create medicines"
on public.medicines
for insert
to anon
with check (true);

create policy "Tablet collectors can update medicines"
on public.medicines
for update
to anon
using (true)
with check (true);

drop policy if exists "anyone can create hospitals" on public.hospitals;
drop policy if exists "anyone can update hospitals" on public.hospitals;

create policy "Verified staff can create hospitals"
on public.hospitals
for insert
to authenticated
with check (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.id = (select auth.uid())
  )
);

create policy "Verified staff can update hospitals"
on public.hospitals
for update
to authenticated
using (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.staff_profiles
    where staff_profiles.id = (select auth.uid())
  )
);

create policy "Tablet collectors can create hospitals"
on public.hospitals
for insert
to anon
with check (true);

create policy "Tablet collectors can update hospitals"
on public.hospitals
for update
to anon
using (true)
with check (true);
