-- Optimize database query performance with indexes

-- 1. Index foreign keys on tablet_submissions to speed up relational joins and checks
create index if not exists idx_tablet_submissions_hospital_id on public.tablet_submissions(hospital_id);
create index if not exists idx_tablet_submissions_medicine_id on public.tablet_submissions(medicine_id);
-- 2. Index search columns on medicines and hospitals to speed up sorting and filters
create index if not exists idx_medicines_name on public.medicines(name);
create index if not exists idx_hospitals_name on public.hospitals(name);
