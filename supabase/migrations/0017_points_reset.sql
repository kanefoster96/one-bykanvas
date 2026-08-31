-- When the current month's points started counting.
--
-- Until now the window was derived as current_period_end minus one calendar
-- month, in three separate copies of the same code. That is wrong twice: it
-- cannot see an upgrade part-way through a month, and JavaScript's setMonth
-- has no 31st of February, so on long months the window silently slid by a
-- day or three.
--
-- Written only by the server: the webhook moves it forward at each renewal,
-- and api/change-plan.js stamps it when someone upgrades, because an upgrade
-- is a fresh payment for a bigger allowance and starts that allowance over.

-- The backfill below reads current_period_end, which was added to the live
-- database by hand before any migration recorded it. Created here (a no-op
-- where it already exists) so this file runs on a fresh database too; the
-- full billing set is recorded properly in 0022.
alter table public.profiles
  add column if not exists current_period_end timestamptz;

alter table public.profiles
  add column if not exists points_reset_at timestamptz;

comment on column public.profiles.points_reset_at is
  'Start of the current points window. Renewals move it to the new period
   start; an upgrade moves it to the moment of the upgrade. Never written from
   the browser - it decides how much free work an account is owed.';

-- Deliberately no insert or update grant to authenticated: a customer who
-- could set this could reset their own allowance whenever they liked. RLS
-- already limits reads to their own row, and the blanket select grant on
-- profiles covers reading it.

-- Existing subscribers get a sensible starting point rather than a null that
-- every reader has to guess around: the period they are currently paying for.
update public.profiles
   set points_reset_at = current_period_end - interval '1 month'
 where points_reset_at is null
   and current_period_end is not null;
