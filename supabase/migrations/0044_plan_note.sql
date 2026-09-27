-- A month after a plan goes live, one email about the plan above theirs:
-- informative, sent once. subscribed_at is stamped by the Stripe webhook
-- the first time a subscription is live; plan_note_sent_at is what makes
-- the email once-only.
alter table public.profiles
  add column if not exists subscribed_at timestamptz,
  add column if not exists plan_note_sent_at timestamptz;
