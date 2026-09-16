-- Contacts: every person a site has dealt with, in one place in the app.
--
-- Filled automatically from live chat, enquiries and payments (anyone who
-- left a name, email or phone), and by hand. One row per person per site,
-- matched on email or phone. Notes hang off a contact: "boiler is a Worcester
-- 30i, serviced March", the kind of thing a trade keeps in their head.
--
-- Business plans and above. The API refuses Starter; the app hides it.

create table if not exists public.contacts (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references public.sites (id) on delete cascade,
  name          text,
  email         text,
  phone         text,
  -- Digits only, so 07700 900123 and +44 7700 900123 are one person.
  phone_key     text,
  address       text,
  company       text,
  -- Where the row came from first: manual | chat | enquiry | payment.
  source        text not null default 'manual' check (source in ('manual', 'chat', 'enquiry', 'payment')),
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists contacts_site_email on public.contacts (site_id, lower(email)) where email is not null;
create unique index if not exists contacts_site_phone on public.contacts (site_id, phone_key) where phone_key is not null;
create index if not exists contacts_site_seen on public.contacts (site_id, last_seen_at desc);

create table if not exists public.contact_notes (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  site_id    uuid not null references public.sites (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists contact_notes_contact on public.contact_notes (contact_id, created_at desc);

alter table public.contacts enable row level security;
alter table public.contact_notes enable row level security;
drop policy if exists "contacts: owner reads own site" on public.contacts;
create policy "contacts: owner reads own site" on public.contacts
  for select using (exists (select 1 from public.sites s where s.id = contacts.site_id and s.owner_id = auth.uid()));
drop policy if exists "contact_notes: owner reads own site" on public.contact_notes;
create policy "contact_notes: owner reads own site" on public.contact_notes
  for select using (exists (select 1 from public.sites s where s.id = contact_notes.site_id and s.owner_id = auth.uid()));
grant select on public.contacts to authenticated;
grant select on public.contact_notes to authenticated;

-- A chat the owner starts from a contact has no visitor holding a token
-- yet. The email carries a claim code; the widget on the site swaps it for
-- a token (api/chat.js claim) and the thread carries on there.
alter table public.conversations add column if not exists claim_code text;
