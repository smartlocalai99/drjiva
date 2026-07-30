-- Nullable, reviewer-populated shop copy for the Asian Hospitals medicine
-- shop. Columns are seeded only with conservative, non-invented fallback
-- copy ("being verified" style text) where no reviewed description exists;
-- shop_information_source_name/url/reviewed_at stay null unless a claim is
-- genuinely sourced. The mobile client prefers a reviewed value here and
-- falls back to its own generated copy when a column is null.
-- No public write access is granted — existing catalogue read and
-- staff/collector mutation policies remain unchanged.
alter table public.medicines
  add column if not exists shop_short_description text,
  add column if not exists shop_full_description text,
  add column if not exists shop_common_uses text,
  add column if not exists shop_safety_note text,
  add column if not exists shop_information_source_name text,
  add column if not exists shop_information_source_url text,
  add column if not exists shop_information_reviewed_at timestamptz;

create index if not exists medicines_asian_shop_catalogue_idx
  on public.medicines (hospital_name, name, id)
  where nullif(btrim(image_url), '') is not null;
