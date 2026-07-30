create table public.patient_document_hospitals (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  normalized_name text generated always as (
    lower(btrim(regexp_replace(name, '[^[:alnum:]]+', ' ', 'g')))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_document_hospitals_owner_patient_name_key
    unique (owner_user_id, patient_id, normalized_name),
  constraint patient_document_hospitals_id_owner_patient_key
    unique (id, owner_user_id, patient_id),
  constraint patient_document_hospitals_normalized_name_check
    check (char_length(normalized_name) between 2 and 120)
);

alter table public.patient_document_hospitals enable row level security;

revoke all on public.patient_document_hospitals from public, anon, authenticated;
grant select, insert, update on public.patient_document_hospitals
  to authenticated;

create policy "Patients read own document hospitals"
on public.patient_document_hospitals
for select
to authenticated
using ((select auth.uid()) = owner_user_id);

create policy "Patients create own document hospitals"
on public.patient_document_hospitals
for insert
to authenticated
with check ((select auth.uid()) = owner_user_id);

create policy "Patients update own document hospitals"
on public.patient_document_hospitals
for update
to authenticated
using ((select auth.uid()) = owner_user_id)
with check ((select auth.uid()) = owner_user_id);

-- Keep the reviewed directory immutable. App-created names belong only to the
-- authenticated patient's private directory above.
revoke all on public.document_hospitals from public, anon, authenticated;
grant select on public.document_hospitals to authenticated;

alter table public.patient_reports
  add column patient_document_hospital_id uuid,
  add constraint patient_reports_patient_document_hospital_owner_patient_fkey
    foreign key (patient_document_hospital_id, owner_user_id, patient_id)
    references public.patient_document_hospitals(id, owner_user_id, patient_id)
    on delete restrict,
  add constraint patient_reports_document_hospital_choice_check
    check (
      uploaded_by <> 'patient'
      or (
        (document_hospital_id is not null)
        <> (patient_document_hospital_id is not null)
      )
    );

create index patient_reports_patient_document_hospital_fk_idx
  on public.patient_reports (
    patient_document_hospital_id,
    owner_user_id,
    patient_id
  )
  where patient_document_hospital_id is not null;
