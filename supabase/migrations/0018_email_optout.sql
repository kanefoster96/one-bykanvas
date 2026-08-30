-- Whether this customer has turned optional email off.
--
-- Only covers notifications about their site - something added, something
-- improved. Anything about their plan or a payment is a service message about
-- a contract they are paying for and is never suppressed, which is why the
-- unsubscribe header only goes on the optional kind: offering to stop email we
-- would send anyway, and then sending it, is what actually damages a sender's
-- standing with the inbox providers.

alter table public.profiles
  add column if not exists notify_optout boolean not null default false;

comment on column public.profiles.notify_optout is
  'True once they have used the unsubscribe link in a site-update email.
   Written only by api/unsubscribe.js with the service role, from a signed
   token - there is no session on a link opened from an inbox.';

-- Theirs to set, so the account page writes it straight from the browser and
-- the checkbox takes effect the moment it is ticked. Granted column by column:
-- this decides nothing about billing, access or how much work an account is
-- owed, it only says whether they want to hear about it. RLS already limits
-- every write to their own row.

grant update (notify_optout) on public.profiles to authenticated;
