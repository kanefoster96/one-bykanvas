-- The billing columns, written down.
--
-- These five were added to the live database by hand while Stripe was being
-- wired up, and never made it into a migration file - so the repository said
-- one schema and the database ran another, and a fresh `db reset` produced a
-- database the API could not run against. Every add is idempotent, so on the
-- live database this whole file is a no-op.
--
-- All of them are written only by the server (the webhook and checkout, with
-- the service role). subscription_status and active_plan decide what an
-- account is entitled to, which is exactly why no grant lets the browser
-- write them; RLS already scopes reads to the customer's own row.

alter table public.profiles
  add column if not exists stripe_customer_id text;

alter table public.profiles
  add column if not exists stripe_subscription_id text;

alter table public.profiles
  add column if not exists subscription_status text;

-- Also created in 0017 (which needs it for a backfill); repeated here so this
-- file alone documents the full billing set.
alter table public.profiles
  add column if not exists current_period_end timestamptz;

alter table public.profiles
  add column if not exists active_plan text;

comment on column public.profiles.stripe_customer_id is
  'Stripe customer id, written at first checkout. Server-only.';
comment on column public.profiles.stripe_subscription_id is
  'Stripe subscription id, written by the webhook. Server-only.';
comment on column public.profiles.subscription_status is
  'Stripe subscription status as last reported by the webhook. The pair
   active/trialing is what the API treats as a live, paying account.';
comment on column public.profiles.current_period_end is
  'When the current billing period ends, from the webhook. Renewal date on
   the account page, and the fallback points-window boundary.';
comment on column public.profiles.active_plan is
  'The plan the customer is actually paying for. Written only by the webhook
   - selected_plan is customer-writable and must never be used for
   entitlements. Cleared when the subscription stops being live.';
