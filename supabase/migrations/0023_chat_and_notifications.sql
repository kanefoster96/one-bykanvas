-- Live chat and in-app notifications, ported from the Kanvas Academy design.
--
-- Chat is one running conversation per customer with "one" - the same shape
-- as the Academy's member/coach chat, simplified for a single admin. Unlike
-- the Academy (where every write goes through a server action), writes here
-- go straight from the browser under row level security, because this site
-- is at Vercel's function cap and has no server to spare: the policies below
-- are therefore the whole security model, not a second layer.
--
-- The admin is identified by email, the same rule the broadcast-images
-- bucket already uses.

-- ------------------------------------------------------------ conversations
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  -- Read markers, one per side, exactly as the Academy does it. Written by
  -- whichever side just looked; each drives the other side's unread badge.
  user_last_read_at timestamptz,
  admin_last_read_at timestamptz,
  -- When the admin was last emailed about this conversation - the throttle
  -- that stops a chatty customer generating forty emails. Stamped by the
  -- server (api/requests.js chatNudge), read by nobody else.
  admin_notified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.chat_conversations enable row level security;

drop policy if exists "chat: own conversation or admin" on public.chat_conversations;
create policy "chat: own conversation or admin"
  on public.chat_conversations for select
  using (auth.uid() = user_id or (auth.jwt() ->> 'email') = 'kane@kanvas.one');

-- The first message a customer ever sends creates their conversation from
-- the browser, so insert must be allowed - but only as themselves.
drop policy if exists "chat: customer creates own conversation" on public.chat_conversations;
create policy "chat: customer creates own conversation"
  on public.chat_conversations for insert
  with check (auth.uid() = user_id);

-- Both sides stamp read markers and bump last_message_at. The column grant
-- below keeps every other column out of reach. A customer could in theory
-- write their own admin_last_read_at and hide their message from the unread
-- count - accepted: the only person they can sabotage is themselves.
drop policy if exists "chat: participants update markers" on public.chat_conversations;
create policy "chat: participants update markers"
  on public.chat_conversations for update
  using (auth.uid() = user_id or (auth.jwt() ->> 'email') = 'kane@kanvas.one')
  with check (auth.uid() = user_id or (auth.jwt() ->> 'email') = 'kane@kanvas.one');

grant select, insert on public.chat_conversations to authenticated;
grant update (last_message_at, user_last_read_at, admin_last_read_at)
  on public.chat_conversations to authenticated;

-- ---------------------------------------------------------------- messages
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  -- Who wrote it. Two values only; which one a writer may use is pinned by
  -- the insert policies, so a customer cannot speak as us.
  sender text not null check (sender in ('customer', 'admin')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_idx
  on public.chat_messages (conversation_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "chat: read own conversation's messages" on public.chat_messages;
create policy "chat: read own conversation's messages"
  on public.chat_messages for select
  using (
    (auth.jwt() ->> 'email') = 'kane@kanvas.one'
    or exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "chat: customer writes in own conversation" on public.chat_messages;
create policy "chat: customer writes in own conversation"
  on public.chat_messages for insert
  with check (
    sender = 'customer'
    and exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "chat: admin replies anywhere" on public.chat_messages;
create policy "chat: admin replies anywhere"
  on public.chat_messages for insert
  with check (sender = 'admin' and (auth.jwt() ->> 'email') = 'kane@kanvas.one');

grant select, insert on public.chat_messages to authenticated;

-- ------------------------------------------------------------ notifications
-- Targeted, per-customer rows: "your request was accepted", "we updated your
-- site". Written only by the server (api/admin.js with the service role), so
-- there is no insert policy - the absence is the point.
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

-- Read state is one timestamp on the profile rather than a flag per row -
-- the Academy reached the same conclusion. Unread = created after this.
alter table public.profiles
  add column if not exists notifications_seen_at timestamptz;

grant update (notifications_seen_at) on public.profiles to authenticated;

-- ------------------------------------------------------------ realtime
-- Adds the chat tables to Realtime's default publication so an open chat
-- hears new messages live (each subscriber still filtered by the select
-- policies above). Guarded: re-adding an included table throws.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'chat_conversations'
  ) then
    alter publication supabase_realtime add table public.chat_conversations;
  end if;
end $$;
