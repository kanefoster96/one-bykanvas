-- Email marketing: who may be sent it, and a record of what went out.
--
-- marketing_optin is deliberately NOT notify_optout. That one covers updates
-- about a customer's own site, which is service mail about work they are
-- paying for. This one covers selling to them. Someone can reasonably want the
-- first and not the second, and in the UK the two sit under different rules -
-- reusing one flag for both would mean an unsubscribe from marketing silently
-- switching off mail about their own website, or worse, the other way round.

alter table public.profiles
  add column if not exists marketing_optin boolean not null default true;

comment on column public.profiles.marketing_optin is
  'Whether they may be sent marketing. Defaults true on the PECR soft opt-in:
   these are people who signed up or bought, being told about similar services,
   and every signup form and every marketing email offers a way out. Set false
   by the customer - from the account page, or the unsubscribe link.';

-- Theirs to set, same reasoning as notify_optout: it decides nothing about
-- billing or access, and RLS limits every write to their own row.
grant update (marketing_optin) on public.profiles to authenticated;

-- ------------------------------------------------------------ broadcasts
-- What was sent, to whom, and when. Not for analytics - it is so that "did
-- that go out, and who got it" has an answer that is not somebody's memory.
create table if not exists public.broadcasts (
  id           uuid primary key default gen_random_uuid(),
  subject      text not null,
  title        text not null,
  body         text not null,
  image_path   text,
  button_text  text,
  button_url   text,
  audience     text not null,
  sent_count   integer not null default 0,
  failed_count integer not null default 0,
  created_at   timestamptz not null default now()
);

comment on table public.broadcasts is
  'One row per marketing send. Written only by api/admin.js with the service
   role; no grants to authenticated, so it is invisible to customers.';

create index if not exists broadcasts_created_idx on public.broadcasts (created_at desc);

alter table public.broadcasts enable row level security;
-- No policies and no grants: closed to anon and authenticated, same as leads.

-- ------------------------------------------------------- broadcast-images
-- Public, unlike every other bucket here. A picture in an email is fetched by
-- the reader's mail client, which has no session and cannot sign a URL, and a
-- signed link would expire while the email sits in an inbox forever.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'broadcast-images', 'broadcast-images', true, 5242880,
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "broadcast-images: admin write"  on storage.objects;
drop policy if exists "broadcast-images: admin delete" on storage.objects;

-- Readable by anyone, because that is the point. Writable by one address.
create policy "broadcast-images: admin write" on storage.objects
  for insert with check (
    bucket_id = 'broadcast-images'
    and (auth.jwt() ->> 'email') = 'kane@kanvas.one'
  );

create policy "broadcast-images: admin delete" on storage.objects
  for delete using (
    bucket_id = 'broadcast-images'
    and (auth.jwt() ->> 'email') = 'kane@kanvas.one'
  );
