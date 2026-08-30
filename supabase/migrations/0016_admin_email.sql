-- Narrow admin access to the business address alone.
--
-- kane.foster@ymail.com was the admin while the domain was being set up. It is
-- now an ordinary customer account used for testing signup and checkout, so
-- leaving it on the list showed it the admin pill and would have let it read
-- the template build notes. The code lists are changed alongside this
-- (DEFAULT_ADMINS in api/admin.js, ADMINS in admin-pill.js); these policies are
-- what actually enforce it on storage.
--
-- Note the ADMIN_EMAILS environment variable in Vercel overrides the code list
-- entirely, and is not reachable from here - if it still names the old address,
-- that address is still an admin whatever this migration says.

drop policy if exists "template-assets: admin read"   on storage.objects;
drop policy if exists "template-assets: admin write"  on storage.objects;
drop policy if exists "template-assets: admin delete" on storage.objects;

create policy "template-assets: admin read" on storage.objects
  for select using (
    bucket_id = 'template-assets'
    and (auth.jwt() ->> 'email') = 'kane@kanvas.one'
  );

create policy "template-assets: admin write" on storage.objects
  for insert with check (
    bucket_id = 'template-assets'
    and (auth.jwt() ->> 'email') = 'kane@kanvas.one'
  );

create policy "template-assets: admin delete" on storage.objects
  for delete using (
    bucket_id = 'template-assets'
    and (auth.jwt() ->> 'email') = 'kane@kanvas.one'
  );
