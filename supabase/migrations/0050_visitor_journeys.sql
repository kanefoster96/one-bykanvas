-- Each visit as a story: where it came from, the pages in order, and what
-- was clicked on the way.
--
-- page_views gains where the visit came from, worked out by api/beacon.js
-- from the page address and the referrer: 'Facebook', 'Google', and so on,
-- whether that was an ad (utm tags marking paid traffic, or a click id
-- that only ads carry), and the campaign the ad's tags name. The click id
-- itself is never kept. city is the town Vercel already worked out from
-- the connection, as coarse as the country we keep now.
--
-- page_clicks holds the buttons and links a visitor pressed: the words on
-- the button and where it went (a page, another site, a phone call, a form
-- sent). Never what anyone typed. Same session id as page_views, so a
-- visit's views and clicks interleave into one journey.

alter table public.page_views
  add column if not exists source   text check (source is null or length(source) <= 40),
  -- 'yes': marked as paid. 'likely': a Facebook or Instagram click id, which
  -- ads always carry but a shared post can too. null: not from an ad.
  add column if not exists from_ad  text check (from_ad is null or from_ad in ('yes', 'likely')),
  add column if not exists campaign text check (campaign is null or length(campaign) <= 120),
  add column if not exists city     text check (city is null or length(city) <= 60);

create table if not exists public.page_clicks (
  id         bigint generated always as identity primary key,
  site_id    uuid not null references public.sites (id) on delete cascade,
  session    text not null,
  path       text not null default '/',
  -- The words on what was pressed: "Get my free design".
  label      text not null check (length(label) <= 80),
  -- Where it went: a page path, another site's host, 'phone', 'email', 'form'.
  target     text check (target is null or length(target) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists page_clicks_site_created on public.page_clicks (site_id, created_at desc);

alter table public.page_clicks enable row level security;
drop policy if exists "page_clicks: owner reads own site" on public.page_clicks;
create policy "page_clicks: owner reads own site" on public.page_clicks
  for select using (exists (select 1 from public.sites s where s.id = page_clicks.site_id and s.owner_id = auth.uid()));
grant select on public.page_clicks to authenticated;
