-- Which subscription has had its "new customer" moment: the welcome email,
-- our email, the referral reward and Meta's Purchase. The Stripe webhook
-- claims it with a conditional update, so the several events Stripe sends
-- for one signup (and a card that fails and then pays) announce it once.
-- A new subscription after a cancellation is a new id, so it is announced.

alter table public.profiles
  add column if not exists announced_subscription_id text;

-- Everyone already on a subscription has been announced.
update public.profiles
   set announced_subscription_id = stripe_subscription_id
 where stripe_subscription_id is not null
   and announced_subscription_id is null;

comment on column public.profiles.announced_subscription_id is
  'The Stripe subscription the webhook last announced (welcome, admin email, referral reward, Meta Purchase). Claimed by conditional update so each subscription is announced once.';
