-- Extra columns captured by the get-started wizard.
alter table public.profiles
  add column if not exists site_uses     text[],
  add column if not exists selected_plan text,
  add column if not exists onboarded_at  timestamptz;

comment on column public.profiles.site_uses is
  'Up to three things the customer wants the site to do, in their words.';
comment on column public.profiles.selected_plan is
  'Plan chosen during onboarding. Billing is not driven from this yet.';

alter table public.profiles drop constraint if exists profiles_selected_plan_check;
alter table public.profiles
  add constraint profiles_selected_plan_check
  check (selected_plan is null or selected_plan in ('business','pro','max'));

alter table public.profiles drop constraint if exists profiles_site_uses_check;
alter table public.profiles
  add constraint profiles_site_uses_check
  check (site_uses is null or array_length(site_uses, 1) between 1 and 3);
