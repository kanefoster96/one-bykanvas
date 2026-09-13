-- Missed calls answered by text, and enquiries answered by email. Both
-- are Max features, both land on the owner's phone through the app.
--
-- A site on Max gets a phone number of its own (bought in Twilio, set
-- here by the admin). Calls to it ring the owner's mobile; if nobody
-- answers, the caller gets a text within seconds and the owner gets a
-- notification. Texts back to that number reach the owner too.
--
-- An enquiry is a contact form on the site posting to api/enquiry.js:
-- stored, pushed to the owner, emailed to the owner, and answered to
-- the sender straight away so nobody wonders if it went through.

alter table public.sites
  add column if not exists phone_number     text,  -- the site's own number, E.164
  add column if not exists forward_to       text,  -- the owner's mobile, E.164
  add column if not exists missed_call_text text;  -- override for the text-back
create unique index if not exists sites_phone_number_key on public.sites (phone_number) where phone_number is not null;

create table if not exists public.call_log (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.sites (id) on delete cascade,
  kind        text not null check (kind in ('call', 'missed', 'sms_in')),
  from_number text,
  body        text,
  texted_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists call_log_site_created on public.call_log (site_id, created_at desc);
alter table public.call_log enable row level security;
drop policy if exists "call_log: owner reads own site" on public.call_log;
create policy "call_log: owner reads own site" on public.call_log
  for select using (exists (select 1 from public.sites s where s.id = call_log.site_id and s.owner_id = auth.uid()));
grant select on public.call_log to authenticated;

create table if not exists public.enquiries (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references public.sites (id) on delete cascade,
  name       text,
  email      text,
  phone      text,
  message    text not null,
  page       text,
  replied_at timestamptz,  -- when the automatic "we'll be in touch" went
  created_at timestamptz not null default now()
);
create index if not exists enquiries_site_created on public.enquiries (site_id, created_at desc);
alter table public.enquiries enable row level security;
drop policy if exists "enquiries: owner reads own site" on public.enquiries;
create policy "enquiries: owner reads own site" on public.enquiries
  for select using (exists (select 1 from public.sites s where s.id = enquiries.site_id and s.owner_id = auth.uid()));
grant select on public.enquiries to authenticated;
