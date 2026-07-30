-- Adds a "Stomach Pain" shelf to the shop's curated category list, matching
-- the existing headache/body_pains/fever/cold allow-list precedent: a
-- merchandising categorisation of already-listed, already-labelled catalogue
-- products by well-known brand name, not a new medical claim.
alter table public.shop_product_sections
  drop constraint shop_product_sections_code_check;

alter table public.shop_product_sections
  add constraint shop_product_sections_code_check
  check (code in ('headache', 'body_pains', 'fever', 'cold', 'stomach_pain'));

insert into public.shop_product_sections (code, title, sort_order)
values ('stomach_pain', 'Stomach Pain', 5)
on conflict (code) do update
set title = excluded.title,
    sort_order = excluded.sort_order;

insert into public.shop_product_section_items (
  section_code,
  medicine_id,
  sort_order
)
select seed.section_code, medicine.id, seed.sort_order
from (
  values
    ('stomach_pain', 'OMEZ DSR', 1),
    ('stomach_pain', 'PANTOCID DSR', 2),
    ('stomach_pain', 'RABLET D', 3),
    ('stomach_pain', 'PANTOCID L', 4),
    ('stomach_pain', 'MAAPAN 40 MG', 5),
    ('stomach_pain', 'PANTACEA D', 6)
) as seed(section_code, medicine_name, sort_order)
join public.medicines as medicine
  on lower(btrim(medicine.name)) = lower(seed.medicine_name)
  and upper(btrim(medicine.hospital_name)) = 'ASIAN MULTI SPECIALITY HOSPITALS'
  and nullif(btrim(medicine.image_url), '') is not null
on conflict (section_code, medicine_id) do update
set sort_order = excluded.sort_order;
