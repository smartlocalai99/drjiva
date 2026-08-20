-- App Store rejected the app under guideline 1.2 (UGC) for missing content
-- moderation on the Health Feed's patient comments: no way to report
-- objectionable content, no way to block an abusive user, and no record of
-- users agreeing to terms before using the feed. This adds the three
-- supporting tables. content_reports has no select policy for
-- anon/authenticated on purpose — only a service-role backend (doctorsjiva's
-- admin API) can read reports, so one patient can never see who reported
-- what. blocked_users and terms_acceptance follow the same owner_user_id
-- pattern as patient_device_links.

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_owner_user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  post_id uuid not null,
  comment_id uuid,
  reason text not null check (
    reason in ('objectionable', 'harassment', 'spam', 'misleading_medical', 'violence', 'other')
  ),
  description text,
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.content_reports enable row level security;

grant insert on public.content_reports to authenticated;

create policy "Patients can file their own reports"
on public.content_reports
for insert to authenticated
with check (reporter_owner_user_id = auth.uid());

create table public.blocked_users (
  blocker_owner_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_owner_user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (blocker_owner_user_id, blocked_owner_user_id)
);

alter table public.blocked_users enable row level security;

grant select, insert, delete on public.blocked_users to authenticated;

create policy "Patients manage their own block list"
on public.blocked_users
for all to authenticated
using (blocker_owner_user_id = auth.uid())
with check (blocker_owner_user_id = auth.uid());

create table public.terms_acceptance (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  primary key (owner_user_id, terms_version)
);

alter table public.terms_acceptance enable row level security;

grant insert on public.terms_acceptance to authenticated;

create policy "Patients record their own terms acceptance"
on public.terms_acceptance
for insert to authenticated
with check (owner_user_id = auth.uid());
