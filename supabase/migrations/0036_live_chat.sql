-- Live chat: a visitor on a site talks to the owner in the One app.
--
-- A conversation belongs to a site. The visitor is anonymous: they hold
-- a random token (only its hash is stored) that lets them read and write
-- their own thread through api/chat.js, and nothing else. The owner reads
-- everything on their site through RLS, in the app, and replies through
-- api/app.js - in the chat, and by email when the visitor has left one
-- and gone.

create table if not exists public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  site_id              uuid not null references public.sites (id) on delete cascade,
  visitor_token_hash   text not null unique,
  visitor_name         text,
  visitor_email        text,
  visitor_phone        text,
  page                 text,
  status               text not null default 'open' check (status in ('open', 'closed')),
  last_message_at      timestamptz not null default now(),
  last_message_by      text not null default 'visitor' check (last_message_by in ('visitor', 'owner')),
  last_message_preview text,
  owner_seen_at        timestamptz,
  -- Stamped by every poll while the widget is open: "still on the site".
  visitor_online_at    timestamptz,
  blocked_at           timestamptz,
  -- When the owner's phone was last told about this thread, so a burst
  -- of messages is one notification, not ten.
  pushed_at            timestamptz,
  created_at           timestamptz not null default now()
);
create index if not exists conversations_site_last on public.conversations (site_id, last_message_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  site_id         uuid not null references public.sites (id) on delete cascade,
  author          text not null check (author in ('visitor', 'owner')),
  body            text not null,
  -- Set when an owner reply was also emailed to the visitor.
  emailed_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conversation_created on public.messages (conversation_id, created_at);
create index if not exists messages_site_created on public.messages (site_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversations: owner reads own site" on public.conversations;
create policy "conversations: owner reads own site" on public.conversations
  for select using (exists (select 1 from public.sites s where s.id = conversations.site_id and s.owner_id = auth.uid()));
drop policy if exists "messages: owner reads own site" on public.messages;
create policy "messages: owner reads own site" on public.messages
  for select using (exists (select 1 from public.sites s where s.id = messages.site_id and s.owner_id = auth.uid()));
-- Never the token hash.
grant select (id, site_id, visitor_name, visitor_email, visitor_phone, page, status, last_message_at, last_message_by, last_message_preview, owner_seen_at, visitor_online_at, blocked_at, created_at) on public.conversations to authenticated;
grant select on public.messages to authenticated;

-- The app listens for new messages on its site as they land.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
