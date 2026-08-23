-- What the customer account page reads and writes.
--
-- Two rules run through this file. Anything the customer could gain from
-- changing is not granted to them: the live URL, the site status and the plan
-- Stripe is actually billing are all written by us. And a request's point cost
-- is a function of its kind, enforced in the database, so a crafted insert
-- cannot book a three-point feature for one point.

-- ---------------------------------------------------------------- profiles --

alter table public.profiles
  add column if not exists active_plan text,
  add column if not exists site_url    text,
  add column if not exists site_status text not null default 'building';

alter table public.profiles drop constraint if exists profiles_active_plan_check;
alter table public.profiles
  add constraint profiles_active_plan_check
  check (active_plan is null or active_plan in ('business','pro','max'));

alter table public.profiles drop constraint if exists profiles_site_status_check;
alter table public.profiles
  add constraint profiles_site_status_check
  check (site_status in ('building','live','paused'));

comment on column public.profiles.active_plan is
  'The plan Stripe is billing, written by the webhook only. selected_plan is
   customer-writable and must never decide what someone is entitled to.';
comment on column public.profiles.site_url is
  'The customer''s live site. Set by us when it goes live.';
comment on column public.profiles.site_status is
  'building | live | paused. Drives the pill on the account page.';

-- No grants for the three columns above: profiles has table-level SELECT for
-- authenticated but per-column INSERT/UPDATE, so leaving them out of the grant
-- list is what makes them read-only to the customer.

-- ---------------------------------------------------------------- requests --

create table if not exists public.requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('edit', 'feature')),
  points     smallint not null,
  detail     text not null check (length(btrim(detail)) between 1 and 4000),
  status     text not null default 'new'
             check (status in ('new', 'in_progress', 'done', 'declined')),
  created_at timestamptz not null default now(),
  -- An edit is one point, a feature is three. Checked here rather than trusted
  -- from the browser.
  constraint requests_points_match check (
    (kind = 'edit'    and points = 1) or
    (kind = 'feature' and points = 3)
  )
);

create index if not exists requests_user_created_idx
  on public.requests (user_id, created_at desc);

alter table public.requests enable row level security;

drop policy if exists "requests: read own"   on public.requests;
drop policy if exists "requests: insert own" on public.requests;

create policy "requests: read own" on public.requests
  for select using (auth.uid() = user_id);
create policy "requests: insert own" on public.requests
  for insert with check (auth.uid() = user_id);

-- Deliberately no update or delete policy. Once a request is made the customer
-- cannot rewrite its kind, retag its points or delete it to free the month's
-- allowance; we move status from the service role.

grant select on public.requests to authenticated;
grant insert (user_id, kind, points, detail) on public.requests to authenticated;
