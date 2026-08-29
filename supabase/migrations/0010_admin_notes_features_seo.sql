-- Admin-only additions: freeform notes and an editable feature list per
-- customer, and a logged history of monthly SEO updates for Max customers.

alter table public.profiles
  add column if not exists admin_notes   text,
  add column if not exists site_features text[];

comment on column public.profiles.admin_notes is
  'Freeform, admin-only notes about this customer. Never shown to them.';
comment on column public.profiles.site_features is
  'Freely editable list of things this customer''s site can do - added by
   hand while building, or automatically when a feature request is marked
   done. Shown to the customer as "Features on your site".';

-- No grants for either: both are admin-only, written from the service role,
-- same reasoning as active_plan and the billing columns.

-- ------------------------------------------------------------- seo_updates
create table if not exists public.seo_updates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  note       text not null check (length(btrim(note)) between 1 and 2000),
  created_at timestamptz not null default now()
);

comment on table public.seo_updates is
  'One row per monthly SEO update logged for a Max-plan customer - what was
   actually changed, not just that something was. Admin-only, written and
   read through the service role and never exposed to the customer.';

create index if not exists seo_updates_user_created_idx
  on public.seo_updates (user_id, created_at desc);

alter table public.seo_updates enable row level security;
-- Deliberately no policies and no grants - fully closed to anon/authenticated.
-- Only the admin endpoint, via the service role, ever touches this table.
