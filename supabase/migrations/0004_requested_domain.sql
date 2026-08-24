-- The web address the customer asked for during onboarding.
--
-- Separate from site_url, which is the address their finished site is served
-- from. This one is a request: what they picked in the wizard, before anyone has
-- bought anything. It is theirs to set, so unlike site_url it is granted to the
-- customer; it decides nothing about billing or access.

alter table public.profiles
  add column if not exists requested_domain text;

alter table public.profiles drop constraint if exists profiles_requested_domain_check;
alter table public.profiles
  add constraint profiles_requested_domain_check
  check (
    requested_domain is null
    or requested_domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,63})+$'
  );

comment on column public.profiles.requested_domain is
  'The address the customer asked for in the wizard. A request, not a purchase -
   site_url is where their finished site actually lives.';

grant insert (requested_domain), update (requested_domain)
  on public.profiles to authenticated;
