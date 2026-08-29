-- Named, reusable edit/feature templates, and a real "accepted" stage.
--
-- Two things land together because they depend on each other: a request
-- picked from a template now shows its price before it is even sent, which
-- is what lets it skip straight past "Request" to "Accepted" on submission -
-- the email round-trip is only needed when nobody has already agreed to the
-- price, which reclassifying still forces back to.

-- --------------------------------------------------------------- templates

create table if not exists public.templates (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('edit', 'feature')),
  name        text not null check (length(btrim(name)) between 1 and 120),
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.templates is
  'Named edit/feature requests saved from past work, so a customer can pick
   one instead of writing from scratch. Managed entirely from the admin
   page - retiring one (active = false) keeps it out of the picker without
   losing the history of who picked it before.';

alter table public.templates enable row level security;

drop policy if exists "templates: read active" on public.templates;
create policy "templates: read active" on public.templates
  for select using (active = true);

-- Read-only to customers - creating, renaming or retiring one is an admin
-- action taken through the service role, never from the browser.
grant select on public.templates to authenticated;

-- ------------------------------------------------------- requests: accepted

alter table public.requests drop constraint if exists requests_status_check;
alter table public.requests
  add constraint requests_status_check
  check (status in ('new', 'accepted', 'in_progress', 'done', 'declined'));

comment on column public.requests.status is
  'new | accepted | in_progress | done | declined. A request reaches
   accepted the moment the points cover it or the customer has agreed to
   the price - shown to the customer as, in order, Request, Accepted,
   In build, Live.';
