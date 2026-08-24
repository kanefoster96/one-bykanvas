-- Whether the address in requested_domain is one they already own.
--
-- It changes what we do with it entirely: a new name gets registered, one they
-- already hold gets pointed at the new site or transferred in. It also changes
-- what "taken" means in the wizard - their own domain being registered is the
-- expected answer, not a problem - so the availability check is skipped for it.

alter table public.profiles
  add column if not exists domain_owned boolean not null default false;

comment on column public.profiles.domain_owned is
  'true when requested_domain is a domain the customer already holds, so it is
   moved rather than registered.';

grant insert (domain_owned), update (domain_owned)
  on public.profiles to authenticated;
