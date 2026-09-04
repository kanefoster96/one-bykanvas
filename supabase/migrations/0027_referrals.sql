-- Built-in referrals. Every customer gets a code (minted server-side the
-- first time their account page asks for it); a new signup can enter one at
-- checkout, and when that signup's plan goes live the referrer's next
-- month is credited automatically in Stripe. referral_rewarded_at on the
-- REFERRED customer's row is the once-only latch.
alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references auth.users (id) on delete set null,
  add column if not exists referred_by_code text,
  add column if not exists referral_rewarded_at timestamptz;

create unique index if not exists profiles_referral_code_key
  on public.profiles (lower(referral_code));
