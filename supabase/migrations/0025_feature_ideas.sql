-- The ideas library becomes editable.
--
-- The thirty starter ideas stay baked into feature-ideas.js; anything the
-- admin adds lands here and is merged in by every page that shows the
-- library - the signup wizard, the account page's request form, and the
-- admin's own feature editor. Public read on purpose: the wizard runs for
-- visitors with no account, and an idea list is marketing copy, not data.
-- Writes go only through the admin endpoint with the service role.

create table if not exists public.feature_ideas (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists feature_ideas_name_idx
  on public.feature_ideas (lower(name));

alter table public.feature_ideas enable row level security;

drop policy if exists "feature ideas: public read" on public.feature_ideas;
create policy "feature ideas: public read" on public.feature_ideas
  for select using (true);

grant select on public.feature_ideas to anon, authenticated;
