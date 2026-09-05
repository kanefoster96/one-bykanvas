-- Win-back timing. The webhook stamps canceled_at when a plan ends and
-- clears both columns when one comes (back) alive; the daily cron sends a
-- single "your site is waiting" email 30-60 days after cancellation, and
-- winback_sent_at is what makes that once-only.
alter table public.profiles
  add column if not exists canceled_at timestamptz,
  add column if not exists winback_sent_at timestamptz;
