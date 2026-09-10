-- Multi-tenant MCP: sites, per-user tokens, and site scoping.
--
-- sites: the thing a caller is allowed to talk about. One row per profile
-- today (id = the owner's profile id, so every existing table keyed by
-- user_id lines up without a rewrite), owned by owner_id. A customer sees
-- their own; the admin sees all. RLS says so at the database, and the MCP
-- server checks the same thing on every call before touching anything.
--
-- mcp_tokens: personal access tokens minted from the account page. Only
-- the sha256 of the token is stored; the token itself is shown once. The
-- owner can list and revoke their own; nobody else can read them.
--
-- The MCP ledgers gain who and which site, so the audit and the hourly
-- limit are per user and a pending action can only be confirmed by the
-- user who previewed it.

create table if not exists public.sites (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null default '',
  url        text,
  status     text not null default 'building' check (status in ('building', 'live', 'paused')),
  created_at timestamptz not null default now()
);
create index if not exists sites_owner_idx on public.sites (owner_id);

-- One site per existing profile, with the profile's id as the site id.
insert into public.sites (id, owner_id, name, url, status, created_at)
select p.id, p.id, coalesce(p.business_name, ''), p.site_url, coalesce(p.site_status, 'building'), coalesce(p.created_at, now())
  from public.profiles p
 where not exists (select 1 from public.sites s where s.id = p.id);

alter table public.sites enable row level security;
drop policy if exists "sites: owner reads own" on public.sites;
create policy "sites: owner reads own" on public.sites
  for select using (owner_id = auth.uid());
grant select on public.sites to authenticated;

-- Requests belong to a site. Backfilled from user_id, which is the site id
-- for every existing customer.
alter table public.requests add column if not exists site_id uuid references public.sites (id) on delete set null;
update public.requests r set site_id = r.user_id
 where r.site_id is null and exists (select 1 from public.sites s where s.id = r.user_id);
create index if not exists requests_site_idx on public.requests (site_id, last_note_at desc);

-- ------------------------------------------------------------- tokens --

create table if not exists public.mcp_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  token_hash   text not null unique,
  label        text not null default 'Claude',
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index if not exists mcp_tokens_user_idx on public.mcp_tokens (user_id);

alter table public.mcp_tokens enable row level security;
drop policy if exists "mcp_tokens: owner reads own" on public.mcp_tokens;
create policy "mcp_tokens: owner reads own" on public.mcp_tokens
  for select using (user_id = auth.uid());
-- Never the hash: the browser lists labels and dates, nothing that could
-- be replayed. Minting and revoking go through api/mcp-tokens.js.
grant select (id, user_id, label, created_at, last_used_at, revoked_at) on public.mcp_tokens to authenticated;

-- ------------------------------------------------------------ ledgers --

alter table public.mcp_pending_actions
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists site_id uuid references public.sites (id) on delete set null;
alter table public.mcp_actions
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists site_id uuid references public.sites (id) on delete set null;
create index if not exists mcp_actions_user_created on public.mcp_actions (user_id, created_at desc);
create index if not exists mcp_actions_site_created on public.mcp_actions (site_id, created_at desc);
