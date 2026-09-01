-- In-app notifications, the design ported from the Kanvas Academy.
--
-- Two kinds of row in one table:
--   customer rows - user_id set, for_admin false: "your request was accepted",
--                   "we updated your site". Each customer reads only their own.
--   admin rows    - user_id null, for_admin true: "a new customer joined",
--                   "a new request arrived". Read only by the admin email.
--
-- Written only by the server (the api/ functions with the service role), so
-- there is no insert policy - the absence is the point: nobody can hand
-- themselves good news. Read state is one timestamp on the profile rather
-- than a flag per row; unread is simply "created after you last looked".
--
-- (This file also carried live chat when it was first written. Chat was
-- removed from the site before this migration was ever run; the full chat
-- schema is in the repository history - PR #84 - if it comes back.)

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  -- Null exactly when this is an admin row.
  user_id uuid references auth.users (id) on delete cascade,
  for_admin boolean not null default false,
  title text not null,
  body text,
  -- Optional in-app link, same as the Academy's action_href.
  href text,
  created_at timestamptz not null default now(),
  -- A row is for one side or the other, never both and never neither.
  constraint notifications_one_audience check ((user_id is null) = for_admin)
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc)
  where user_id is not null;

create index if not exists notifications_admin_idx
  on public.notifications (created_at desc)
  where for_admin;

alter table public.notifications enable row level security;

drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own"
  on public.notifications for select
  using (
    (user_id is not null and auth.uid() = user_id)
    or (for_admin and (auth.jwt() ->> 'email') = 'kane@kanvas.one')
  );

grant select on public.notifications to authenticated;

alter table public.profiles
  add column if not exists notifications_seen_at timestamptz;

grant update (notifications_seen_at) on public.profiles to authenticated;
