-- Reclassifying a request (edit <-> feature) can raise its price. When it
-- does, work should not start until the customer has agreed to pay it -
-- confirm_token is the one-click link that lets them say so without logging
-- in, and price_confirmed_at is when they did.

alter table public.requests
  add column if not exists confirm_token      text unique,
  add column if not exists price_confirmed_at timestamptz;

comment on column public.requests.confirm_token is
  'Set when a reclassification raised the price and the customer has not yet
   confirmed it. Cleared the moment they click the link, so the same link can
   never be used twice and its presence alone is what blocks the request
   moving to in_progress. Null the rest of the time.';
comment on column public.requests.price_confirmed_at is
  'When the customer clicked the confirm link. Historical record only - the
   block itself is driven by confirm_token, not this.';

-- Service-role only, same reasoning as billed_at - nothing here is the
-- customer's to set themselves, only to read as part of their own row.
