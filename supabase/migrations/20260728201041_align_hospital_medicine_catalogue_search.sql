-- The original Asian Hospital tablet collector used the local key `amsh1`.
-- The patient app selects hospitals by their database UUID, so align those
-- catalogue rows with the canonical hospital record.
update public.medicines as medicine
set hospital_id = hospital.id::text,
    hospital_name = hospital.name
from (
  select id, name
  from public.hospitals
  where upper(code) = 'AMSH'
  order by
    (upper(name) = 'ASIAN MULTI SPECIALITY HOSPITALS') desc,
    created_at
  limit 1
) as hospital
where lower(trim(medicine.hospital_id)) = 'amsh1';

-- The app loads one hospital's catalogue in name order once, then filters the
-- in-memory list as the patient types.
create index if not exists medicines_hospital_name_idx
  on public.medicines (hospital_id, name);
