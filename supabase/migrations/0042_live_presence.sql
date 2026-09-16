-- Live, not refreshed: who is on the site now, and messages as they land.
--
-- The app already hears new messages through Realtime. It now also hears
-- conversations change (someone comes online, a thread is opened or
-- closed) and page views land (a visitor moves to another page), so the
-- green bar and the inbox move on their own.
--
-- watch_until: the owner is looking at their Chat tab. The widget on the
-- site asks, only while that is true, whether the owner has opened a chat
-- with this visitor (api/chat.js ping), so an owner can message someone
-- who is browsing and see it pop up in front of them - the way Wix does -
-- without every visitor polling all day.

alter table public.sites add column if not exists watch_until timestamptz;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'page_views') then
    alter publication supabase_realtime add table public.page_views;
  end if;
end $$;
