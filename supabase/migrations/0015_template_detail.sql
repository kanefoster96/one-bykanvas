-- Templates become a proper catalogue: a customer-facing description of what
-- the feature actually does, plus build notes and reference images that are
-- ours alone - code, gotchas, how it was put together last time.

alter table public.templates
  add column if not exists admin_notes  text,
  add column if not exists admin_images text[];

comment on column public.templates.description is
  'What the feature does, in the customer''s language. Shown in the picker
   before they request it, so they can tell whether it is the thing they
   mean.';
comment on column public.templates.admin_notes is
  'Build notes - code, gotchas, how it went together last time. Never leaves
   the admin page; the column grant below is what enforces that.';
comment on column public.templates.admin_images is
  'Storage paths in the template-assets bucket. Ours only, same as notes.';

-- The customer reads this table straight from the browser, so a blanket
-- select grant would hand them the build notes as well - RLS narrows rows,
-- never columns. Re-grant column by column instead.
revoke select on public.templates from authenticated;
grant select (id, kind, name, description, active, created_at)
  on public.templates to authenticated;

-- ------------------------------------------------------- template-assets
-- Private, and admin-only: unlike request screenshots there is no owning
-- customer to scope this to, so the policies name the admins directly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'template-assets', 'template-assets', false, 5242880,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "template-assets: admin read"   on storage.objects;
drop policy if exists "template-assets: admin write"  on storage.objects;
drop policy if exists "template-assets: admin delete" on storage.objects;

/* Keep this list in step with DEFAULT_ADMINS in api/admin.js and ADMINS in
   admin-pill.js. The service role bypasses all of this, so the admin
   endpoint keeps working regardless. */
create policy "template-assets: admin read" on storage.objects
  for select using (
    bucket_id = 'template-assets'
    and (auth.jwt() ->> 'email') in ('kane.foster@ymail.com', 'kane@kanvas.one')
  );

create policy "template-assets: admin write" on storage.objects
  for insert with check (
    bucket_id = 'template-assets'
    and (auth.jwt() ->> 'email') in ('kane.foster@ymail.com', 'kane@kanvas.one')
  );

create policy "template-assets: admin delete" on storage.objects
  for delete using (
    bucket_id = 'template-assets'
    and (auth.jwt() ->> 'email') in ('kane.foster@ymail.com', 'kane@kanvas.one')
  );
