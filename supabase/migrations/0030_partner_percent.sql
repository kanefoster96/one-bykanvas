-- Partners earn a share of each payment rather than a flat amount: 25% of
-- what the customer actually paid, for their first 12 payments. rate_pence
-- stays as the fallback for a partner promised a flat amount instead - set
-- their rate_percent to null and rate_pence to the amount.
alter table public.partners
  add column if not exists rate_percent integer default 25;
