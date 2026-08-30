-- The email a customer wants shown on their own website for their customers
-- to reach them. Distinct from the address they log in with, which lives in
-- auth.users and is ours to contact them on - this one is public-facing
-- content, theirs to set, and only ever appears on the site we build.

alter table public.profiles
  add column if not exists public_email text;

comment on column public.profiles.public_email is
  'Contact address the customer wants on their own site. Not their login
   email - that is in auth.users and is how we reach them.';

-- Theirs to set, like requested_domain: it decides nothing about billing or
-- access, so it is granted rather than admin-only.
grant insert (public_email), update (public_email)
  on public.profiles to authenticated;
