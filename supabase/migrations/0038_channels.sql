-- One inbox, three channels. A conversation is now web chat, a text
-- thread or a WhatsApp thread; the owner replies to all three from the
-- Chat tab and the reply goes back the way it came. Text and WhatsApp
-- threads are keyed by the site and the person's number, so every text
-- from the same number is one thread. A missed call opens that thread
-- with a note, so "call back" and "text back" are one tap away.

alter table public.conversations
  add column if not exists channel text not null default 'web' check (channel in ('web', 'sms', 'whatsapp'));
create unique index if not exists conversations_channel_phone_key
  on public.conversations (site_id, channel, visitor_phone) where channel <> 'web';

-- A note the system writes into a thread: "Missed call, texted them".
alter table public.messages drop constraint if exists messages_author_check;
alter table public.messages add constraint messages_author_check check (author in ('visitor', 'owner', 'system'));
alter table public.conversations drop constraint if exists conversations_last_message_by_check;
alter table public.conversations add constraint conversations_last_message_by_check check (last_message_by in ('visitor', 'owner', 'system'));

-- Calls the owner places from the app, showing the site's number.
alter table public.call_log drop constraint if exists call_log_kind_check;
alter table public.call_log add constraint call_log_kind_check check (kind in ('call', 'missed', 'sms_in', 'call_out'));

grant select (id, site_id, channel, visitor_name, visitor_email, visitor_phone, page, status, last_message_at, last_message_by, last_message_preview, owner_seen_at, visitor_online_at, blocked_at, created_at) on public.conversations to authenticated;
