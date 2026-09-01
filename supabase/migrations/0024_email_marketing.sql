-- Email marketing for Pro and Max.
--
-- A business keeps its own customer list (audience) and sends campaigns -
-- subject, a message, an optional image and link - to everyone on it, from
-- an address at their own domain. We pay for the sending; they get the tool.
--
-- The audience is theirs to manage from the browser: RLS scopes every read,
-- insert and delete to the owner. Unsubscribes are set only by the server
-- (the unsubscribe link in each email carries a signed token), and campaigns
-- are written only by the server too - the send endpoint is what counts the
-- recipients and does the sending, so nothing here grants insert.

-- ------------------------------------------------------------- audience
create table if not exists public.audience (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  email           text not null,
  name            text,
  unsubscribed_at timestamptz,           -- set by the unsubscribe link, never by the owner
  created_at      timestamptz not null default now(),
  unique (user_id, email)
);

alter table public.audience enable row level security;

drop policy if exists "audience: own read"   on public.audience;
drop policy if exists "audience: own write"  on public.audience;
drop policy if exists "audience: own delete" on public.audience;

create policy "audience: own read" on public.audience
  for select using (auth.uid() = user_id);

create policy "audience: own write" on public.audience
  for insert with check (auth.uid() = user_id);

create policy "audience: own delete" on public.audience
  for delete using (auth.uid() = user_id);

grant select, insert, delete on public.audience to authenticated;

create index if not exists audience_user_idx
  on public.audience (user_id, created_at desc);

-- ------------------------------------------------------------ campaigns
-- One row per blast actually sent. Read-only history for the owner.
create table if not exists public.campaigns (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  subject         text not null,
  body            text not null,
  image_url       text,
  link_url        text,
  link_text       text,
  recipient_count integer not null default 0,
  sent_at         timestamptz not null default now()
);

alter table public.campaigns enable row level security;

drop policy if exists "campaigns: own read" on public.campaigns;

create policy "campaigns: own read" on public.campaigns
  for select using (auth.uid() = user_id);

grant select on public.campaigns to authenticated;

create index if not exists campaigns_user_idx
  on public.campaigns (user_id, sent_at desc);

-- ------------------------------------------- the address they send from
-- Set from the admin page once their domain is verified with the email
-- provider; the send endpoint refuses to send until it is. Deliberately no
-- update grant for customers - a wrong value here is a deliverability
-- problem on a domain we look after.
alter table public.profiles
  add column if not exists campaign_from text;

-- ------------------------------------------------------ campaign images
-- Public bucket: the image goes inside an email, so it has to be readable
-- without credentials. Writes stay in a folder named after the owner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campaign-images', 'campaign-images', true, 3145728,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "campaign-images: public read" on storage.objects;
drop policy if exists "campaign-images: write own"   on storage.objects;
drop policy if exists "campaign-images: delete own"  on storage.objects;

create policy "campaign-images: public read" on storage.objects
  for select using (bucket_id = 'campaign-images');

create policy "campaign-images: write own" on storage.objects
  for insert with check (
    bucket_id = 'campaign-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "campaign-images: delete own" on storage.objects
  for delete using (
    bucket_id = 'campaign-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
