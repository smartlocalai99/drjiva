-- Pair the protected order RPCs with the server-side PWA bridge. The
-- high-entropy plaintext credential is stored only in Vercel; this migration
-- contains its one-way SHA-256 digest.
insert into public.order_dashboard_config (
  singleton,
  access_code_sha256
)
values (
  true,
  '9b81b6d849b3a3826ae6ec776e2d55e25d21a064140d055168b558e2b9280eca'
)
on conflict (singleton) do update
set access_code_sha256 = excluded.access_code_sha256,
    updated_at = now();

