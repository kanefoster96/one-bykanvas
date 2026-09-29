-- What a Max customer tells us to build their system: services, prices,
-- how they get customers, how they book and take payment, the access we
-- need. One row per customer, everything optional, saved whenever they
-- like. The answers are a jsonb blob so a new question is a form change,
-- not a migration. Written and read by the owner; the admin reads every
-- row. Saves go through api/onboarding.js, which also tells the admin what
-- changed.
create table if not exists public.max_onboarding (
  user_id uuid primary key references auth.users (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.max_onboarding enable row level security;

drop policy if exists "max_onboarding: read own or admin" on public.max_onboarding;
create policy "max_onboarding: read own or admin"
  on public.max_onboarding for select
  using (auth.uid() = user_id or (auth.jwt() ->> 'email') = 'kane@kanvas.one');

grant select on public.max_onboarding to authenticated;
