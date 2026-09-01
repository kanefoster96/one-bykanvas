-- In-app notifications, the design ported from the Kanvas Academy.
--
-- Targeted, per-customer rows: "your request was accepted", "we updated your
-- site". Written only by the server (api/admin.js with the service role), so
-- there is no insert policy - the absence is the point. Read state is one
-- timestamp on the profile rather than a flag per row; unread is simply
-- "created after you last looked".
--
-- (This file also carried live chat when it was first written. Chat was
-- removed from the site before this migration was ever run; the full chat
-- schema is in the repository history - PR #84 - if it comes back.)

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  -- Optional in-app link, same as the Academy's action_href.
  href text,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own"
  on public.notifications for select
  using (auth.uid() = user_id);

grant select on public.notifications to authenticated;

alter table public.profiles
  add column if not exists notifications_seen_at timestamptz;

grant update (notifications_seen_at) on public.profiles to authenticated;
