-- Partner programme (branding studios etc). A partner has a code that is
-- also a Stripe promotion code; checkout stamps the buyer's profile with
-- the partner when the code is applied, and the webhook records a fixed
-- commission (rate_pence, default £12) for each of that customer's first
-- 12 paid invoices. unique(invoice_id) makes webhook retries free, and
-- payouts are a separate ledger so balance = earned - paid, with history.
-- Everything here is service-role only: no policies, no grants.

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  code text not null,
  rate_pence integer not null default 1200,
  created_at timestamptz not null default now()
);
create unique index if not exists partners_code_key on public.partners (lower(code));

create table if not exists public.partner_payments (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  user_id uuid not null,
  invoice_id text not null unique,
  amount_pence integer not null,
  created_at timestamptz not null default now()
);
create index if not exists partner_payments_partner on public.partner_payments (partner_id);
create index if not exists partner_payments_user on public.partner_payments (user_id);

create table if not exists public.partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  amount_pence integer not null,
  created_at timestamptz not null default now()
);

alter table public.partners enable row level security;
alter table public.partner_payments enable row level security;
alter table public.partner_payouts enable row level security;

alter table public.profiles
  add column if not exists partner_id uuid references public.partners (id) on delete set null,
  add column if not exists partner_code text;
