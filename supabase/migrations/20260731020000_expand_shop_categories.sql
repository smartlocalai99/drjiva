-- Adds five more general-condition shelves to the shop (allergy/cough,
-- heart & BP, diabetes care, skin care, vitamins) and fills out the
-- existing headache/fever/body pains shelves with more matching catalogue
-- products. Same merchandising-only precedent as the earlier shelves: an
-- already-listed, already-labelled product placed on a category shelf by
-- well-known brand name, not a new medical claim.
alter table public.shop_product_sections
  drop constraint shop_product_sections_code_check;

alter table public.shop_product_sections
  add constraint shop_product_sections_code_check
  check (code in (
    'headache', 'body_pains', 'fever', 'cold', 'stomach_pain',
    'allergy_cough', 'heart_bp', 'diabetes_care', 'skin_care', 'vitamins'
  ));

insert into public.shop_product_sections (code, title, sort_order)
values
  ('allergy_cough', 'Allergy & Cough', 6),
  ('heart_bp', 'Heart & BP', 7),
  ('diabetes_care', 'Diabetes Care', 8),
  ('skin_care', 'Skin Care', 9),
  ('vitamins', 'Vitamins & Supplements', 10)
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
    -- Fill out existing shelves with more matching products.
    ('headache', 'FLEXON TAB', 4),
    ('headache', 'FLEXON SYRUP', 5),
    ('headache', 'SUMO L DS SYP', 6),
    ('fever', 'CALPOL 650 MG', 5),
    ('body_pains', 'BACLOF 10 MG TAB', 6),
    ('body_pains', 'MEFENAC SPAS TAB', 7),
    ('body_pains', 'FLEXURA D', 8),
    -- Allergy & Cough.
    ('allergy_cough', 'ALLEGRA 120 MG TAB', 1),
    ('allergy_cough', 'ALRGEE 180', 2),
    ('allergy_cough', 'ATORNIZ C', 3),
    ('allergy_cough', 'AVIL 25MG TAB', 4),
    ('allergy_cough', 'ASCORIL LS SYP', 5),
    -- Heart & BP.
    ('heart_bp', 'AMLOKIND AT TAB', 1),
    ('heart_bp', 'ATORVA 80 TAB', 2),
    ('heart_bp', 'ECOSPRIN 75MG', 3),
    ('heart_bp', 'TELMA H TAB', 4),
    ('heart_bp', 'TELVAS 20', 5),
    -- Diabetes Care.
    ('diabetes_care', 'GLIVIPRIDE M1 1305', 1),
    ('diabetes_care', 'GLIVIPRIDE M2', 2),
    ('diabetes_care', 'GLIVIPRIDE MV1', 3),
    ('diabetes_care', 'GLIVIPRIDE MV2', 4),
    -- Skin Care.
    ('skin_care', 'CALLY CURE LOTION', 1),
    ('skin_care', 'ATARAX ANTI ITCHY LOTION', 2),
    ('skin_care', 'KETONAM CREAM', 3),
    ('skin_care', 'SALIXID CREAM', 4),
    ('skin_care', 'SITCOM LD CREAM', 5),
    -- Vitamins & Supplements.
    ('vitamins', 'B LONG F TAB', 1),
    ('vitamins', 'BENADON', 2),
    ('vitamins', 'D3 CAP', 3),
    ('vitamins', 'LIMCEE', 4),
    ('vitamins', 'ULTRA D3 DROPS', 5)
) as seed(section_code, medicine_name, sort_order)
join public.medicines as medicine
  on lower(btrim(medicine.name)) = lower(seed.medicine_name)
  and upper(btrim(medicine.hospital_name)) = 'ASIAN MULTI SPECIALITY HOSPITALS'
  and nullif(btrim(medicine.image_url), '') is not null
on conflict (section_code, medicine_id) do update
set sort_order = excluded.sort_order;
