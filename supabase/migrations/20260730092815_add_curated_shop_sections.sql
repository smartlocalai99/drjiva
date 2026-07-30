-- These fields already exist in the production catalogue. Declare them in the
-- migration history as well so a fresh environment can run the same Shop query.
alter table public.medicines
  add column if not exists price numeric,
  add column if not exists dosage_form text,
  add column if not exists composition text,
  add column if not exists therapeutic_categories text[];

create table public.shop_product_sections (
  code text primary key,
  title text not null,
  sort_order integer not null unique check (sort_order > 0),
  created_at timestamptz not null default now(),
  constraint shop_product_sections_code_check
    check (code in ('headache', 'body_pains', 'fever', 'cold'))
);

create table public.shop_product_section_items (
  section_code text not null
    references public.shop_product_sections(code) on delete cascade,
  medicine_id uuid not null
    references public.medicines(id) on delete cascade,
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  primary key (section_code, medicine_id),
  unique (section_code, sort_order)
);

create index shop_product_section_items_medicine_idx
  on public.shop_product_section_items (medicine_id);

alter table public.shop_product_sections enable row level security;
alter table public.shop_product_section_items enable row level security;

revoke all on public.shop_product_sections from public, anon, authenticated;
revoke all on public.shop_product_section_items
  from public, anon, authenticated;
grant select on public.shop_product_sections to authenticated;
grant select on public.shop_product_section_items to authenticated;

create policy "Authenticated users read shop sections"
on public.shop_product_sections
for select
to authenticated
using (true);

create policy "Authenticated users read curated shop products"
on public.shop_product_section_items
for select
to authenticated
using (true);

insert into public.shop_product_sections (code, title, sort_order)
values
  ('headache', 'Headache', 1),
  ('body_pains', 'Body Pains', 2),
  ('fever', 'Fever', 3),
  ('cold', 'Cold', 4)
on conflict (code) do update
set title = excluded.title,
    sort_order = excluded.sort_order;

-- This is an explicit merchandising allow-list, not an inferred diagnosis.
-- Keep it reviewed when catalogue names or product availability change.
insert into public.shop_product_section_items (
  section_code,
  medicine_id,
  sort_order
)
select seed.section_code, medicine.id, seed.sort_order
from (
  values
    ('headache', 'DART', 1),
    ('headache', 'DOLO-650', 2),
    ('headache', 'FEPANIL-500', 3),
    ('body_pains', 'CHYMOMET -AP', 1),
    ('body_pains', 'DOLOSTAT - MR', 2),
    ('body_pains', 'DOLOSTAT-PC', 3),
    ('body_pains', 'HIFENAC -SR', 4),
    ('body_pains', 'MAHAGESIC -SP', 5),
    ('fever', 'DOLO-650', 1),
    ('fever', 'FEPANIL-500', 2),
    ('fever', 'P-100 DROPS', 3),
    ('fever', 'SYP IBUGESIC', 4),
    ('cold', 'KOLQ', 1),
    ('cold', 'CETZINE', 2),
    ('cold', 'SYP MAXTRA', 3),
    ('cold', 'SYP-FLUCOLD AF', 4),
    ('cold', 'MAXTRA DROPS', 5)
) as seed(section_code, medicine_name, sort_order)
join public.medicines as medicine
  on lower(btrim(medicine.name)) = lower(seed.medicine_name)
  and medicine.price > 0
  and nullif(btrim(medicine.image_url), '') is not null
on conflict (section_code, medicine_id) do update
set sort_order = excluded.sort_order;
