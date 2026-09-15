-- Money in the numbers, and the thread from a visit to a payment.
--
-- The Analytics tab is the same for every site: visitors, pages, journeys,
-- and - where the site takes payments or has live chat - how many of those
-- visitors messaged, and how many paid. That needs one row per payment a
-- site took, and a way to tie a payment and a chat back to the visit.
--
-- The link is the beacon's session id: random per browser tab, gone when
-- the tab closes, never a cookie. chat.js sends it when a conversation
-- starts; the site's thank-you page sends it with the payment. Nothing
-- about the person is kept beyond what they typed into the chat or the
-- checkout.

-- ---------------------------------------------------------- payments --

create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references public.sites (id) on delete cascade,
  -- Where the row came from: 'site' (the beacon call on a thank-you
  -- page), 'stripe' (a connected Stripe account, later), 'manual'.
  source         text not null default 'site' check (source in ('site', 'stripe', 'manual')),
  -- The order or payment id on the site's side, so the same payment
  -- reported twice (a refreshed thank-you page) is one row.
  ref            text not null,
  amount_pence   integer not null check (amount_pence >= 0),
  currency       text not null default 'gbp',
  status         text not null default 'paid' check (status in ('paid', 'refunded', 'partly_refunded')),
  refunded_pence integer not null default 0 check (refunded_pence >= 0),
  customer_email text,
  customer_name  text,
  description    text,
  -- The beacon session of the visit that paid, when known.
  session        text,
  paid_at        timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  unique (site_id, ref)
);
create index if not exists payments_site_paid on public.payments (site_id, paid_at desc);

alter table public.payments enable row level security;
drop policy if exists "payments: owner reads own site" on public.payments;
create policy "payments: owner reads own site" on public.payments
  for select using (exists (select 1 from public.sites s where s.id = payments.site_id and s.owner_id = auth.uid()));
grant select on public.payments to authenticated;

-- ----------------------------------------------- conversations: session --

-- Which visit a chat belongs to, so "messaged, then paid" can be counted.
alter table public.conversations add column if not exists session text;
create index if not exists conversations_site_session on public.conversations (site_id, session) where session is not null;
