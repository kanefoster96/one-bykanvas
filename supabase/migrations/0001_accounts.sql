-- one by Kanvas — customer accounts
-- Profile data plus an avatar/logo, both locked to the owning user by RLS.

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  business_name  text,
  contact_name   text,
  phone          text,
  business_type  text,   -- "cafe", "barber", "landscaping"…
  address        text,
  service_area   text,   -- for businesses that travel to customers
  opening_hours  text,
  services       text,   -- menu / service list, or notes about it
  site_goals     text,   -- what they want the site to do
  existing_links text,   -- current site, socials, Google listing
  avatar_path    text,   -- storage path inside the avatars bucket
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.profiles is
  'Business details captured at signup, used to brief a new site build.';

alter table public.profiles enable row level security;

-- A user may only ever see or touch their own row.
drop policy if exists "profiles: read own"   on public.profiles;
drop policy if exists "profiles: insert own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;

create policy "profiles: read own"   on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- Deliberately no delete policy: account deletion should cascade from
-- auth.users rather than leaving an orphaned auth user with no profile.

-- keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------- profile row on signup
-- Runs as the definer so it can insert before the new user has a session.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, business_name, contact_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'business_name', ''),
    nullif(new.raw_user_meta_data ->> 'contact_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------- avatars
-- Public read: these are business logos that end up on a public website
-- anyway. Writes are restricted to a folder named after the user's id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 2097152,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: public read"  on storage.objects;
drop policy if exists "avatars: write own"    on storage.objects;
drop policy if exists "avatars: update own"   on storage.objects;
drop policy if exists "avatars: delete own"   on storage.objects;

create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars: write own" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: update own" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: delete own" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ------------------------------------------------------------ hardening
-- Both functions above are trigger functions and are never meant to be called
-- over the REST API, where SECURITY DEFINER would run them as the owner.
-- Triggers are invoked by Postgres itself and do not check EXECUTE, so this
-- closes /rest/v1/rpc/... without affecting the triggers.
revoke all on function public.handle_new_user()  from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
