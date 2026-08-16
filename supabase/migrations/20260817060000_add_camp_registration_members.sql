-- Lets a patient register more than one person for a camp (themselves plus
-- family members) in one booking, capturing each additional person's name.

alter table public.hospital_event_registrations
  add column if not exists attendee_count integer not null default 1
    check (attendee_count between 1 and 10),
  add column if not exists attendee_names text[] not null default '{}';
