-- Enable delete policies and grants for tablet app tables

-- 1. tablet_submissions
create policy "anyone can delete tablet submissions" on public.tablet_submissions
  for delete using (true);
grant delete on public.tablet_submissions to authenticated, anon;
-- 2. hospitals
create policy "anyone can delete hospitals" on public.hospitals
  for delete using (true);
grant delete on public.hospitals to authenticated, anon;
-- 3. medicines
create policy "anyone can delete medicines" on public.medicines
  for delete using (true);
grant delete on public.medicines to authenticated, anon;
