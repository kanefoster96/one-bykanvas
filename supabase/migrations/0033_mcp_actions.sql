-- The MCP server's two ledgers.
--
-- mcp_pending_actions: a write tool's first call validates, loads the real
-- record and parks what it would do here with a plain-English preview.
-- confirm(id) runs it once, within ten minutes; cancel(id) drops it. A
-- pending row is never executed twice: executed_at is checked and set in
-- the same statement.
--
-- mcp_actions: everything that was actually done from chat, with the
-- preview it was confirmed against and what came back. Read by the
-- actions_recent tool and by the 20-an-hour limit on confirmations.
--
-- Both are service-role only: RLS on, no policies, no grants.

create table if not exists public.mcp_pending_actions (
  id           uuid primary key default gen_random_uuid(),
  tool         text not null,
  args         jsonb not null default '{}'::jsonb,
  preview      text not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '10 minutes'),
  executed_at  timestamptz,
  cancelled_at timestamptz,
  result       jsonb
);
create index if not exists mcp_pending_actions_open
  on public.mcp_pending_actions (expires_at)
  where executed_at is null and cancelled_at is null;

create table if not exists public.mcp_actions (
  id         uuid primary key default gen_random_uuid(),
  pending_id uuid references public.mcp_pending_actions (id) on delete set null,
  tool       text not null,
  args       jsonb not null default '{}'::jsonb,
  preview    text not null,
  result     jsonb,
  created_at timestamptz not null default now()
);
create index if not exists mcp_actions_created on public.mcp_actions (created_at desc);

alter table public.mcp_pending_actions enable row level security;
alter table public.mcp_actions enable row level security;
