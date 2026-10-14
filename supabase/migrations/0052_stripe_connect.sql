-- A One club's own Stripe account, connected to Kanvas One's (Stripe
-- Connect). Created from the admin build page; the club finishes Stripe's
-- onboarding from a link we send them. Their site then takes payments in
-- this account (its STRIPE_CONNECT_ACCOUNT).

alter table public.profiles
  add column if not exists stripe_connect_id text
    check (stripe_connect_id is null or stripe_connect_id ~ '^acct_[A-Za-z0-9]{6,64}$');

comment on column public.profiles.stripe_connect_id is
  'The club''s connected Stripe account (acct_...), made by the admin API action stripeConnect. Null until made.';
