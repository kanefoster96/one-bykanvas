-- Hardening: monitoring, rate limits, and the database advisor's findings.

-- Monitoring (api/_health.js, api/health.js). Each scheduled job records
-- when it last finished; the daily check alerts if one has gone quiet.
create table if not exists public.health_beats (
  job text primary key,
  ok_at timestamptz not null default now(),
  detail text
);
-- Instant alerts are throttled per kind, so a failing webhook that Stripe
-- retries does not send one push per retry.
create table if not exists public.alert_throttle (
  key text primary key,
  last_at timestamptz not null default now(),
  suppressed int not null default 0
);

-- Rate limits for the forms anyone can use (api/_rate.js). Fixed windows,
-- counted atomically here so two requests at once cannot both slip under.
create table if not exists public.rate_hits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 1,
  primary key (key, window_start)
);
alter table public.health_beats enable row level security;
alter table public.alert_throttle enable row level security;
alter table public.rate_hits enable row level security;

create or replace function public.hit_rate(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into public.rate_hits (key, window_start) values (p_key, ws)
  on conflict (key, window_start) do update set hits = public.rate_hits.hits + 1
  returning hits into n;
  -- Now and then, clear out windows nobody needs any more.
  if random() < 0.01 then
    delete from public.rate_hits where window_start < now() - interval '2 days';
  end if;
  return n > p_max;   -- true: over the limit
end;
$$;
revoke all on function public.hit_rate(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate(text, int, int) to service_role;

-- Foreign keys without an index (advisor 0001).
create index if not exists contact_notes_site_idx on public.contact_notes (site_id);
create index if not exists mcp_actions_pending_idx on public.mcp_actions (pending_id);
create index if not exists mcp_pending_actions_site_idx on public.mcp_pending_actions (site_id);
create index if not exists mcp_pending_actions_user_idx on public.mcp_pending_actions (user_id);
create index if not exists partner_payouts_partner_idx on public.partner_payouts (partner_id);
create index if not exists profiles_partner_idx on public.profiles (partner_id);
create index if not exists profiles_referred_by_idx on public.profiles (referred_by);

-- Row level security that called auth.uid() / auth.jwt() once per row
-- (advisor 0003). Same rules, the call wrapped in a select so Postgres
-- works it out once per query.
alter policy "audience: own delete" on public.audience
  using ((select auth.uid()) = user_id);
alter policy "audience: own read" on public.audience
  using ((select auth.uid()) = user_id);
alter policy "audience: own write" on public.audience
  with check ((select auth.uid()) = user_id);
alter policy "call_log: owner reads own site" on public.call_log
  using (EXISTS ( SELECT 1 FROM public.sites s WHERE ((s.id = call_log.site_id) AND (s.owner_id = (select auth.uid())))));
alter policy "campaigns: own read" on public.campaigns
  using ((select auth.uid()) = user_id);
alter policy "contact_notes: owner reads own site" on public.contact_notes
  using (EXISTS ( SELECT 1 FROM public.sites s WHERE ((s.id = contact_notes.site_id) AND (s.owner_id = (select auth.uid())))));
alter policy "contacts: owner reads own site" on public.contacts
  using (EXISTS ( SELECT 1 FROM public.sites s WHERE ((s.id = contacts.site_id) AND (s.owner_id = (select auth.uid())))));
alter policy "conversations: owner reads own site" on public.conversations
  using (EXISTS ( SELECT 1 FROM public.sites s WHERE ((s.id = conversations.site_id) AND (s.owner_id = (select auth.uid())))));
alter policy "enquiries: owner reads own site" on public.enquiries
  using (EXISTS ( SELECT 1 FROM public.sites s WHERE ((s.id = enquiries.site_id) AND (s.owner_id = (select auth.uid())))));
alter policy "max_onboarding: read own or admin" on public.max_onboarding
  using (((select auth.uid()) = user_id) OR (((select auth.jwt()) ->> 'email'::text) = 'kane@kanvas.one'::text));
alter policy "mcp_tokens: owner reads own" on public.mcp_tokens
  using (user_id = (select auth.uid()));
alter policy "messages: owner reads own site" on public.messages
  using (EXISTS ( SELECT 1 FROM public.sites s WHERE ((s.id = messages.site_id) AND (s.owner_id = (select auth.uid())))));
alter policy "notifications: read own" on public.notifications
  using (((user_id IS NOT NULL) AND ((select auth.uid()) = user_id)) OR (for_admin AND (((select auth.jwt()) ->> 'email'::text) = 'kane@kanvas.one'::text)));
alter policy "page_clicks: owner reads own site" on public.page_clicks
  using (EXISTS ( SELECT 1 FROM public.sites s WHERE ((s.id = page_clicks.site_id) AND (s.owner_id = (select auth.uid())))));
alter policy "page_views: owner reads own site" on public.page_views
  using (EXISTS ( SELECT 1 FROM public.sites s WHERE ((s.id = page_views.site_id) AND (s.owner_id = (select auth.uid())))));
alter policy "payments: owner reads own site" on public.payments
  using (EXISTS ( SELECT 1 FROM public.sites s WHERE ((s.id = payments.site_id) AND (s.owner_id = (select auth.uid())))));
alter policy "request_notes: read own, not private" on public.request_notes
  using ((NOT private) AND (EXISTS ( SELECT 1 FROM public.requests r WHERE ((r.id = request_notes.request_id) AND (r.user_id = (select auth.uid()))))));
alter policy "requests: insert own" on public.requests
  with check ((select auth.uid()) = user_id);
alter policy "requests: mark seen" on public.requests
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "requests: read own" on public.requests
  using ((select auth.uid()) = user_id);
alter policy "site_features: read own" on public.site_features
  using ((select auth.uid()) = user_id);
alter policy "sites: owner reads own" on public.sites
  using (owner_id = (select auth.uid()));
