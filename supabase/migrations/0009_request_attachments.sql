-- Screenshots on an edit/feature request - the part of the site to change,
-- or a feature from somewhere else to copy. Private, unlike the avatars
-- bucket: these are internal to the request, never meant for the public
-- site, so only the uploader (and us, via the service role) can ever see
-- one.

alter table public.requests
  add column if not exists attachment_paths text[];

comment on column public.requests.attachment_paths is
  'Storage paths in the request-attachments bucket, each starting with the
   owning user''s id - checked again server-side on submission so a crafted
   request cannot reference a path it does not own. Cleared once the
   customer clears them after the build is live.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-attachments', 'request-attachments', false, 5242880,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "request-attachments: write own"  on storage.objects;
drop policy if exists "request-attachments: read own"   on storage.objects;
drop policy if exists "request-attachments: delete own" on storage.objects;

create policy "request-attachments: write own" on storage.objects
  for insert with check (
    bucket_id = 'request-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "request-attachments: read own" on storage.objects
  for select using (
    bucket_id = 'request-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "request-attachments: delete own" on storage.objects
  for delete using (
    bucket_id = 'request-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
