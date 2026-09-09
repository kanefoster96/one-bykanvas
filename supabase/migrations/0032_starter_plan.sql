-- The Starter plan: £25 a month for a one page site with no forms, chat,
-- dashboard or automated emails, and changes once a month by email. It is
-- the feature downsell under Business - a different product at a lower
-- price, not the same site discounted - so it only needs the plan checks
-- widened. Prices live in api/_plans.js.

alter table public.profiles drop constraint if exists profiles_selected_plan_check;
alter table public.profiles
  add constraint profiles_selected_plan_check
  check (selected_plan is null or selected_plan in ('starter', 'business', 'pro', 'max'));

alter table public.profiles drop constraint if exists profiles_active_plan_check;
alter table public.profiles
  add constraint profiles_active_plan_check
  check (active_plan is null or active_plan in ('starter', 'business', 'pro', 'max'));
