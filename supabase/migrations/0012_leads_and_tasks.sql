-- Two things the admin page has had no home for: enquiries from the public
-- lead form (which until now were logged to the browser console and lost),
-- and the follow-ups that come out of them.

-- ------------------------------------------------------------------ leads
-- Someone who filled in the form on the marketing site. Not an account -
-- they have no login and may never make one. A lead becomes a contact only
-- if they go on to sign up, which is a separate thing entirely.
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) between 1 and 200),
  business      text not null check (length(btrim(business)) between 1 and 200),
  email         text not null check (length(btrim(email)) between 3 and 320),
  plan_interest text,
  about         text check (about is null or length(about) <= 4000),
  want_app      boolean not null default false,
  status        text not null default 'new'
                check (status in ('new', 'contacted', 'quoted', 'won', 'lost')),
  admin_notes   text,
  created_at    timestamptz not null default now()
);

comment on table public.leads is
  'Enquiries from the public form on the marketing site. Written only by
   api/lead.js through the service role - the form is anonymous, so there is
   no session to scope an insert to and nothing here is customer-readable.';
comment on column public.leads.status is
  'new | contacted | quoted | won | lost - the pipeline, worked by hand from
   the admin page. Nothing moves it automatically.';

create index if not exists leads_created_idx on public.leads (created_at desc);

alter table public.leads enable row level security;
-- Deliberately no policies and no grants: fully closed to anon and
-- authenticated, same as seo_updates. Only the service role touches it.

-- ------------------------------------------------------------------ tasks
-- A follow-up to do. Optionally about a customer or a lead, but a task with
-- neither is fine - "renew the Porkbun account" is worth writing down too.
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(btrim(title)) between 1 and 300),
  due_on     date,
  done_at    timestamptz,
  user_id    uuid references auth.users (id) on delete cascade,
  lead_id    uuid references public.leads (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.tasks is
  'The admin''s own to-do list. done_at rather than a boolean so a finished
   task still says when it was finished.';

create index if not exists tasks_open_idx on public.tasks (done_at, due_on);

alter table public.tasks enable row level security;
-- Admin-only, same reasoning as leads above.
