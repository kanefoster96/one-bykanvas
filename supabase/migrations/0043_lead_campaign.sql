-- Where a free-example lead came from: the ad's utm tags and the page the
-- form was on, in one short line, so the admin can see which trade and
-- which campaign is producing customers. Written by api/lead.js from what
-- the browser kept in sessionStorage from the first page it landed on.
alter table public.leads
  add column if not exists campaign text check (campaign is null or length(campaign) <= 200);

comment on column public.leads.campaign is
  'utm_source / utm_medium / utm_campaign / utm_content and the landing path, joined; null when they arrived with none.';
