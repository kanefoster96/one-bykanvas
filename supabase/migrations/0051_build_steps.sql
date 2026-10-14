-- The build checklist on the admin page: one row per step ticked off for a
-- customer's job. A row that exists is a step done; unticking deletes it.
--
-- job is which checklist: 'site' (every plan), 'app' and 'ads' (One). step
-- is the step's key from build-steps.js, which holds the wording and the
-- order, so a step can be reworded without touching the rows. Only the
-- admin API writes here (service role); nobody else can read or write it.

create table if not exists public.build_steps (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  job      text not null check (job in ('site', 'app', 'ads')),
  step     text not null check (length(step) between 1 and 60),
  done_at  timestamptz not null default now(),
  done_by  text check (done_by is null or length(done_by) <= 120),
  primary key (user_id, job, step)
);

alter table public.build_steps enable row level security;

comment on table public.build_steps is 'The admin build checklist: one row per step ticked for a customer''s job (site, app, ads). Step keys and wording live in build-steps.js. Service role only.';
