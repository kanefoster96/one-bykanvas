-- Enquiries from the public form on the marketing site.
--
-- Until now that form validated, said thanks, and dropped the enquiry into
-- console.log - so every enquiry since launch was lost. api/lead.js emails
-- us the moment one arrives, which is how they actually get read; this table
-- is the durable copy behind that, so a mail problem costs a notification
-- rather than the enquiry itself.

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) between 1 and 200),
  business      text not null check (length(btrim(business)) between 1 and 200),
  email         text not null check (length(btrim(email)) between 3 and 320),
  plan_interest text,
  about         text check (about is null or length(about) <= 4000),
  want_app      boolean not null default false,
  created_at    timestamptz not null default now()
);

comment on table public.leads is
  'Enquiries from the public form. Written only by api/lead.js through the
   service role - the form is anonymous, so there is no session to scope an
   insert to and nothing here is customer-readable.';

create index if not exists leads_created_idx on public.leads (created_at desc);

alter table public.leads enable row level security;
-- Deliberately no policies and no grants: fully closed to anon and
-- authenticated, same as seo_updates. Only the service role touches it.
