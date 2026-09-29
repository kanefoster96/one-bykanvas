-- A secret per site, so the site's own dashboard can raise events on the
-- owner's phone through api/event.js (a booking made, a job done, money
-- refunded). Shown on the admin page under One app; the dashboard keeps
-- it server-side and sends it as a bearer token. Two v4 UUIDs hashed give
-- 128 bits without needing pgcrypto.
alter table public.sites
  add column if not exists event_secret text not null
  default md5(gen_random_uuid()::text || gen_random_uuid()::text);
