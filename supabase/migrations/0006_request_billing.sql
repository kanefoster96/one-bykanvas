-- Billing an edit/feature request that fell outside the plan's monthly points.
--
-- Charging happens by hand from the admin page, once a request is marked
-- done - never automatically, and never twice. billed_at is what stops the
-- second click from charging a card again.

alter table public.requests
  add column if not exists billed_at             timestamptz,
  add column if not exists billed_amount         integer,
  add column if not exists stripe_payment_intent_id text;

comment on column public.requests.billed_at is
  'When the card on file was charged for this request, if it fell outside the
   month''s points. Null means either still covered by points, or not charged
   yet. Set only by the admin endpoint, after Stripe confirms the payment.';
comment on column public.requests.billed_amount is
  'Pence actually charged. Kept alongside billed_at as the historical record,
   since _plans.js pricing could change after the fact.';
comment on column public.requests.stripe_payment_intent_id is
  'The PaymentIntent that charged it, for looking the payment up in Stripe.';

-- No grants for these three: they are service-role-only, same reasoning as
-- profiles.active_plan - nothing here is the customer's to set or see change
-- itself, only to read as part of their own row (already covered by the
-- table's existing select grant).
