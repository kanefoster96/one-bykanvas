-- Photos a customer sends through the Max setup form: their work, the van,
-- the team. Public read, like logos, since they end up on a public site;
-- writes only inside a folder named after the user's id. 12 MB a file,
-- because phone photos are big and nobody should have to shrink one.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos', 'photos', true, 12582912,
  array['image/png','image/jpeg','image/webp','image/heic','image/heif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "photos: public read"  on storage.objects;
drop policy if exists "photos: write own"    on storage.objects;
drop policy if exists "photos: update own"   on storage.objects;
drop policy if exists "photos: delete own"   on storage.objects;

create policy "photos: public read" on storage.objects
  for select using (bucket_id = 'photos');

create policy "photos: write own" on storage.objects
  for insert with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "photos: update own" on storage.objects
  for update using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "photos: delete own" on storage.objects
  for delete using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
