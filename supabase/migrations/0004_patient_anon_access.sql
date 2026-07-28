-- supabase/migrations/0004_patient_anon_access.sql

-- Enable read and write permissions for the anon role on patients (for login/registration)
create policy "anon can read patients" on public.patients
  for select to anon using (true);
create policy "anon can create patients" on public.patients
  for insert to anon with check (true);
grant select, insert on public.patients to anon;
-- Enable read permissions for the anon role on medicines, dispenses, dispense_items, and patient_reports
create policy "anon can read medicines" on public.medicines
  for select to anon using (true);
grant select on public.medicines to anon;
create policy "anon can read dispenses" on public.dispenses
  for select to anon using (true);
grant select on public.dispenses to anon;
create policy "anon can read dispense items" on public.dispense_items
  for select to anon using (true);
grant select on public.dispense_items to anon;
create policy "anon can read patient reports" on public.patient_reports
  for select to anon using (true);
grant select on public.patient_reports to anon;
-- Enable read and write permissions for the anon role on push_tokens (for notification tokens)
create policy "anon can read push tokens" on public.push_tokens
  for select to anon using (true);
create policy "anon can insert push tokens" on public.push_tokens
  for insert to anon with check (true);
create policy "anon can update push tokens" on public.push_tokens
  for update to anon using (true) with check (true);
grant select, insert, update on public.push_tokens to anon;
-- Enable read and write permissions for the anon role on dose_logs (for logging taken doses)
create policy "anon can read dose logs" on public.dose_logs
  for select to anon using (true);
create policy "anon can insert dose logs" on public.dose_logs
  for insert to anon with check (true);
grant select, insert on public.dose_logs to anon;
