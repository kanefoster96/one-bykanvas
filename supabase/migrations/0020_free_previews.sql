-- The free one-page example: what a request for one needs beyond an enquiry.
--
-- These land in leads rather than a table of their own. A free example and an
-- enquiry are the same thing to whoever answers them - somebody who has asked
-- to be contacted - and splitting them would mean two inboxes and two places
-- to forget to look. source is what tells them apart.

alter table public.leads
  add column if not exists source text not null default 'enquiry',
  add column if not exists handle text,
  add column if not exists requested_domain text;

comment on column public.leads.source is
  'enquiry (the homepage form) | free-preview (the /free offer). Written by
   api/lead.js only; anything unrecognised is stored as enquiry rather than
   trusted, so a crafted post cannot invent categories.';

comment on column public.leads.handle is
  'Their Instagram or Facebook, whichever they gave. Free-form on purpose -
   people write @name, a full URL, or just the name, and rejecting any of
   those to enforce a shape would cost more leads than it saves.';

comment on column public.leads.requested_domain is
  'The address they picked while asking. A wish, not a purchase and not a
   reservation - nothing is registered until they start a plan, and the page
   says so.';

-- Free examples are answered in the order they arrive, so they are read by
-- source and date together.
create index if not exists leads_source_created_idx
  on public.leads (source, created_at desc);
