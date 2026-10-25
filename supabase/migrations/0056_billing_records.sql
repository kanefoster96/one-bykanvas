-- Kanvas One's own money, kept here so the admin app can show it without
-- asking Stripe for everything every time. (public.payments is something
-- else: the payments customers' own sites take.)
--
--   billing_charges        one row per Stripe charge on a Kanvas One
--                          customer: plan payments (Starter, Business, One;
--                          monthly or annual) and one-off request charges.
--                          Written by the Stripe webhook and caught up by
--                          the daily job (api/followups.js), keyed on the
--                          charge so either can write it any number of times.
--   billing_cancellations  one row per subscription that was set to end or
--                          ended: why (the reason picked in the admin app,
--                          or given in the Stripe portal), who, and when.
--   billing_disputes       a customer's bank disputing a charge: Stripe's
--                          dispute, mirrored, with the evidence drafted here.
--   ad_spend               what was spent on our own ads each month, typed
--                          in by hand, for cost per customer.
--   sent_once              a key per one-off send (the monthly numbers email
--                          for a month), so a rerun never sends it twice.
--
-- All service role only: no grants to anon or authenticated, RLS on with no
-- policies, the same as build_steps.

create table if not exists public.billing_charges (
  charge_id          text primary key,
  invoice_id         text,
  payment_intent_id  text,
  user_id            uuid references public.profiles (id) on delete set null,
  stripe_customer_id text,
  subscription_id    text,
  plan               text,
  kind               text not null default 'plan' check (kind in ('plan', 'extra')),
  billing_reason     text,
  interval           text,
  status             text not null check (status in ('paid', 'failed', 'refunded', 'partly_refunded', 'pending')),
  amount             integer not null default 0 check (amount >= 0),
  refunded           integer not null default 0 check (refunded >= 0),
  fee                integer,
  currency           text not null default 'gbp',
  failure_message    text,
  disputed           boolean not null default false,
  charged_at         timestamptz not null,
  updated_at         timestamptz not null default now()
);
create index if not exists billing_charges_charged_at on public.billing_charges (charged_at desc);
create index if not exists billing_charges_user on public.billing_charges (user_id);
create index if not exists billing_charges_invoice on public.billing_charges (invoice_id);

create table if not exists public.billing_cancellations (
  subscription_id text primary key,
  user_id         uuid references public.profiles (id) on delete set null,
  plan            text,
  reason          text,
  note            text,
  source          text check (source in ('admin', 'portal', 'payment_failed', 'dispute', 'stripe')),
  by_email        text,
  scheduled_at    timestamptz,
  ends_at         timestamptz,
  undone_at       timestamptz,
  ended_at        timestamptz,
  updated_at      timestamptz not null default now()
);
create index if not exists billing_cancellations_ended on public.billing_cancellations (ended_at desc);
create index if not exists billing_cancellations_user on public.billing_cancellations (user_id);

create table if not exists public.billing_disputes (
  dispute_id      text primary key,
  charge_id       text,
  invoice_id      text,
  user_id         uuid references public.profiles (id) on delete set null,
  amount          integer not null default 0,
  currency        text not null default 'gbp',
  reason          text,
  status          text,
  evidence_due_by timestamptz,
  evidence        jsonb,
  submitted_at    timestamptz,
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  updated_at      timestamptz not null default now()
);

create table if not exists public.ad_spend (
  month      date primary key,
  amount     integer not null default 0 check (amount >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.sent_once (
  key     text primary key,
  sent_at timestamptz not null default now()
);

alter table public.billing_charges enable row level security;
alter table public.billing_cancellations enable row level security;
alter table public.billing_disputes enable row level security;
alter table public.ad_spend enable row level security;
alter table public.sent_once enable row level security;
revoke all on public.billing_charges, public.billing_cancellations, public.billing_disputes,
  public.ad_spend, public.sent_once from anon, authenticated;

comment on table public.billing_charges is 'Every Stripe charge on a Kanvas One customer (plan payments and request charges). Written by the webhook and the daily catch-up in api/followups.js; service role only.';
comment on table public.billing_cancellations is 'Why and when each subscription was set to end or ended. Service role only.';
comment on table public.billing_disputes is 'Bank disputes on Kanvas One charges, with drafted evidence. Service role only.';
comment on table public.ad_spend is 'Our own ad spend by month, entered by hand in the admin app, for cost per customer.';
comment on table public.sent_once is 'Keys for one-off sends, so a rerun never sends twice.';
