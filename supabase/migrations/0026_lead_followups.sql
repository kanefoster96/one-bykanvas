-- Follow-up stamps for free-example leads. The daily cron
-- (/api/followups) sends at most two emails per lead after their example
-- goes out, and these columns are what make a rerun safe: each send is
-- recorded, so nothing ever goes twice.
alter table public.leads
  add column if not exists followup1_sent_at timestamptz,
  add column if not exists followup2_sent_at timestamptz;
