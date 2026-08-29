-- A proper features-on-your-site table, replacing the plain text[] column
-- added in 0010: each entry needs its own timestamp (for the 30-day "new"
-- pill) and its own id (so a single one can be marked updated or removed),
-- neither of which a plain array on profiles could give it.

create table if not exists public.site_features (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.site_features is
  'What a customer''s site can do, shown to them as "Features on your site"
   with a green NEW pill for 30 days after updated_at. Admin-managed only -
   added by hand, or automatically when a feature request is marked done.';
comment on column public.site_features.updated_at is
  'Bumped by "mark as updated" as well as on insert - this, not created_at,
   is what the 30-day NEW pill is measured against.';

create index if not exists site_features_user_updated_idx
  on public.site_features (user_id, updated_at desc);

alter table public.site_features enable row level security;

drop policy if exists "site_features: read own" on public.site_features;
create policy "site_features: read own" on public.site_features
  for select using (auth.uid() = user_id);

-- Read-only to the customer - adding, updating or removing one is an admin
-- action taken through the service role, never from the browser.
grant select on public.site_features to authenticated;

-- Carry over anything already added through the feature editor shipped in
-- 0010, so nothing typed in gets lost when that column stops being read.
insert into public.site_features (user_id, name, created_at, updated_at)
select id, unnest(site_features), now(), now()
from public.profiles
where site_features is not null and array_length(site_features, 1) > 0;

comment on column public.profiles.site_features is
  'Superseded by the site_features table (0011) - kept only so nothing is
   lost; no longer read or written by the app.';
