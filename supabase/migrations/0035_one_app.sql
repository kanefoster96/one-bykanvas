-- The One app: site config, the analytics beacon, device tokens for push,
-- and the notification row growing into a typed event with a deep link.
--
-- The app is a notification layer, live chat and analytics. Everything a
-- customer manages lives in their own site's dashboard, so the app never
-- needs generic screens: it needs to know where that dashboard is, what
-- the site has (modules), and what the business calls things (labels),
-- so one notification template reads naturally for a plumber and a cafe.

-- ------------------------------------------------------------- sites --

alter table public.sites
  -- The site's own admin dashboard, opened inside the app's Dashboard tab.
  add column if not exists dashboard_url text,
  -- Which app features this site has: chat, payments, bookings, reviews.
  add column if not exists modules text[] not null default '{}',
  -- Display words per event type: {"work":"order","person":"client"}.
  add column if not exists labels jsonb not null default '{}'::jsonb,
  -- Where a record lives in the dashboard: {"payment":"/orders/{id}"}.
  add column if not exists deep_links jsonb not null default '{}'::jsonb;

-- The app reads its own site row (RLS: owner reads own, from 0034).
grant select on public.sites to authenticated;

-- ------------------------------------------------------- page views --

-- One row per page view from the beacon on every site we host. No cookie,
-- no fingerprint: the session id is random per browser tab session and
-- gone when the tab closes. Written only by api/beacon.js with the service
-- role; read by the owner through RLS.
create table if not exists public.page_views (
  id         bigint generated always as identity primary key,
  site_id    uuid not null references public.sites (id) on delete cascade,
  session    text not null,
  path       text not null default '/',
  referrer   text,
  device     text not null default 'desktop' check (device in ('phone', 'desktop')),
  country    text,
  created_at timestamptz not null default now()
);
create index if not exists page_views_site_created on public.page_views (site_id, created_at desc);

alter table public.page_views enable row level security;
drop policy if exists "page_views: owner reads own site" on public.page_views;
create policy "page_views: owner reads own site" on public.page_views
  for select using (exists (select 1 from public.sites s where s.id = page_views.site_id and s.owner_id = auth.uid()));
grant select on public.page_views to authenticated;

-- ----------------------------------------------------- device tokens --

-- One row per installed app that agreed to notifications. Server only:
-- registered through api/app.js with the session, never read by the
-- browser. is_admin marks Kane's own phones, so "a customer asked" can
-- reach them without looking up who the admin is on every send.
create table if not exists public.device_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  is_admin     boolean not null default false,
  platform     text not null check (platform in ('ios', 'android', 'web')),
  token        text not null unique,
  app_version  text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Stamped when the push service says the token is dead; skipped after.
  failed_at    timestamptz
);
create index if not exists device_tokens_user_idx on public.device_tokens (user_id) where failed_at is null;
create index if not exists device_tokens_admin_idx on public.device_tokens (is_admin) where is_admin and failed_at is null;
alter table public.device_tokens enable row level security;

-- ------------------------------------------------------ notifications --

-- A notification is now an event: which site, what kind, and where it
-- points. Existing rows keep working (kind null, href as before).
alter table public.notifications
  add column if not exists site_id   uuid references public.sites (id) on delete cascade,
  -- money_in | money_failed | money_refund | money_cancelled | work | booking | person | chat | review | support
  add column if not exists kind      text,
  -- The record the app opens: {"kind":"payment","id":"...","path":"/orders/..."}
  -- or {"kind":"chat","id":"<conversation>"}, opened natively.
  add column if not exists deep_link jsonb,
  add column if not exists pushed_at timestamptz;
create index if not exists notifications_site_created on public.notifications (site_id, created_at desc) where site_id is not null;
