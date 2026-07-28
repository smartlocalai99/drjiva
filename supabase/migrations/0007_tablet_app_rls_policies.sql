-- supabase/migrations/0007_tablet_app_rls_policies.sql

-- 1. Create table for tracking tablet photo submissions
create table if not exists public.tablet_submissions (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  image_url text not null,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
-- Enable RLS for tablet_submissions
alter table public.tablet_submissions enable row level security;
-- Policies for tablet_submissions (both authenticated staff and anonymous collectors)
create policy "anyone can read tablet submissions" on public.tablet_submissions
  for select using (true);
create policy "anyone can insert tablet submissions" on public.tablet_submissions
  for insert with check (true);
grant select, insert on public.tablet_submissions to authenticated, anon;
-- 2. Add code column to hospitals table if it doesn't exist
alter table public.hospitals add column if not exists code text;
-- 3. Enable insert and select policies on hospitals so anyone (including anon) can read and add new hospitals on-the-fly
create policy "anyone can read hospitals" on public.hospitals
  for select using (true);
create policy "anyone can create hospitals" on public.hospitals
  for insert with check (true);
create policy "anyone can update hospitals" on public.hospitals
  for update using (true) with check (true);
grant select, insert, update on public.hospitals to authenticated, anon;
-- 4. Enable insert/update policies on medicines for anon role so image URLs can be saved without logging in
create policy "anyone can create medicines" on public.medicines
  for insert with check (true);
create policy "anyone can update medicines" on public.medicines
  for update using (true) with check (true);
grant insert, update on public.medicines to authenticated, anon;
-- 5. Enable storage upload permissions for the anonymous role on the public 'medicine-images' bucket
create policy "medicine images anon upload" on storage.objects
  for insert to anon with check (bucket_id = 'medicine-images');
create policy "medicine images anon replace" on storage.objects
  for update to anon using (bucket_id = 'medicine-images') with check (bucket_id = 'medicine-images');
-- 6. Seed initial hospitals with their unique codes if they do not exist
insert into public.hospitals (name, code)
select name, code from (
  values 
    ('ASIAN MULTI SPECIALITY HOSPITALS', 'AMSH'),
    ('PRIME HOSPITALS', 'PRIME'),
    ('Vedanta Hospitals', 'VEDANTA'),
    ('PALLA Hospitals', 'PALLA'),
    ('Sunrise Multi Speciality Hospital', 'SUNRISE')
) as t(name, code)
where not exists (
  select 1 from public.hospitals h where upper(h.name) = upper(t.name)
);
-- Update existing hospitals in the database that don't have codes set
update public.hospitals set code = 'AMSH' where upper(name) = 'ASIAN MULTI SPECIALITY HOSPITALS' and code is null;
update public.hospitals set code = 'PRIME' where upper(name) = 'PRIME HOSPITALS' and code is null;
update public.hospitals set code = 'VEDANTA' where upper(name) = 'VEDANTA HOSPITALS' and code is null;
update public.hospitals set code = 'PALLA' where upper(name) = 'PALLA HOSPITALS' and code is null;
update public.hospitals set code = 'SUNRISE' where upper(name) = 'SUNRISE MULTI SPECIALITY HOSPITAL' and code is null;
