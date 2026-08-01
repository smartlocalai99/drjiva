create or replace function public.normalize_hospital_name(value text)
returns text
language sql
immutable
strict
parallel safe
security invoker
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      lower(btrim(value)),
      '[^[:alnum:]]+',
      ' ',
      'g'
    )
  );
$$;

alter table public.hospitals
  add column normalized_name text
  generated always as (public.normalize_hospital_name(name)) stored;

create unique index hospitals_normalized_name_uidx
  on public.hospitals(normalized_name);

insert into public.hospitals(name)
select min(custom_hospital.name)
from public.patient_custom_hospitals as custom_hospital
group by public.normalize_hospital_name(custom_hospital.name)
on conflict (normalized_name) do nothing;

create or replace function public.sync_patient_custom_hospital_to_shared()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.hospitals(name)
  values (new.name)
  on conflict (normalized_name) do nothing;

  return new;
end;
$$;

revoke all on function public.sync_patient_custom_hospital_to_shared()
  from public;

drop trigger if exists sync_patient_custom_hospital_to_shared
  on public.patient_custom_hospitals;

create trigger sync_patient_custom_hospital_to_shared
after insert or update of name
on public.patient_custom_hospitals
for each row
execute function public.sync_patient_custom_hospital_to_shared();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'hospitals'
  ) then
    alter publication supabase_realtime add table public.hospitals;
  end if;
end;
$$;
