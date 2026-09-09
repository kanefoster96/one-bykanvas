-- Requests become conversations.
--
-- A request row is the header of one conversation: what the customer wants,
-- where it has got to. Every message in it - the original ask included - is
-- a row in request_notes underneath. The customer's own message is written
-- there too, so the thread reads the same from top to bottom.
--
-- Status is what the customer sees, in plain words on the page:
--   new         Open - waiting on us
--   waiting     We've got a question for you - waiting on the customer
--   in_progress Being built
--   done        Done
-- 'accepted' folds into new (points are gone, so there is nothing to
-- accept); 'declined' is allowed on old rows only and reads as Done.

alter table public.requests
  add column if not exists title            text,
  add column if not exists done_at          timestamptz,
  add column if not exists last_note_at     timestamptz,
  add column if not exists last_note_by     text,
  add column if not exists customer_seen_at timestamptz;

alter table public.requests drop constraint if exists requests_last_note_by_check;
alter table public.requests add constraint requests_last_note_by_check
  check (last_note_by is null or last_note_by in ('customer', 'admin'));

update public.requests set status = 'new' where status = 'accepted';

alter table public.requests drop constraint if exists requests_status_check;
alter table public.requests add constraint requests_status_check
  check (status in ('new', 'waiting', 'in_progress', 'done', 'declined'));

comment on column public.requests.status is
  'new (Open, waiting on us) | waiting (a question for the customer) |
   in_progress (Being built) | done. declined survives on old rows only.';
comment on column public.requests.title is
  'One short line: picked from the feature catalogue or the first line of
   what they typed. The subject of every email about it.';
comment on column public.requests.last_note_by is
  'Who wrote the newest note - decides whose turn it is, and drives both
   badges: the admin counts requests where it is customer, the customer
   counts ones where it is admin and newer than customer_seen_at.';
comment on column public.requests.customer_seen_at is
  'When the customer last opened the thread. The one column they write
   themselves - see the update grant below.';

-- ---------------------------------------------------------------- notes --

create table if not exists public.request_notes (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null references public.requests (id) on delete cascade,
  author           text not null check (author in ('customer', 'admin')),
  body             text not null check (length(btrim(body)) between 1 and 4000),
  -- Ours only: never shown to the customer, never emailed. The read policy
  -- below is what keeps it that way, not the page.
  private          boolean not null default false,
  -- Up to five paths in the request-attachments bucket, each under the
  -- owning customer's folder (admin uploads go in <user>/admin/...).
  attachment_paths text[],
  -- Null until the digest has sent it. Notes by one author on one request
  -- inside ten minutes go out as a single email.
  emailed_at       timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists request_notes_request_idx
  on public.request_notes (request_id, created_at);
create index if not exists request_notes_unmailed_idx
  on public.request_notes (created_at)
  where emailed_at is null and not private;

alter table public.request_notes enable row level security;

drop policy if exists "request_notes: read own, not private" on public.request_notes;
create policy "request_notes: read own, not private" on public.request_notes
  for select using (
    not private
    and exists (
      select 1 from public.requests r
      where r.id = request_notes.request_id and r.user_id = auth.uid()
    )
  );

grant select on public.request_notes to authenticated;
-- Deliberately no insert policy: a note is written by api/requests.js or
-- api/admin.js, because writing one also moves the status, stamps
-- last_note_*, and queues the email - none of which a bare insert would do.

-- The one thing a customer writes to a request directly: "I've seen this".
-- Column-level grant, so the same policy cannot be used to touch anything
-- else on the row.
drop policy if exists "requests: mark seen" on public.requests;
create policy "requests: mark seen" on public.requests
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant update (customer_seen_at) on public.requests to authenticated;

-- ------------------------------------------------------------- backfill --

-- Old requests: the first line of what they typed is the title, and the
-- whole message becomes note one, so they show up in the new list intact.
update public.requests
   set title = left(split_part(detail, E'\n', 1), 120)
 where title is null;

insert into public.request_notes (request_id, author, body, attachment_paths, created_at)
select r.id, 'customer', r.detail, r.attachment_paths, r.created_at
  from public.requests r
 where not exists (select 1 from public.request_notes n where n.request_id = r.id);

update public.requests
   set last_note_at = created_at, last_note_by = 'customer'
 where last_note_at is null;

update public.requests
   set done_at = created_at
 where status in ('done', 'declined') and done_at is null;

-- --------------------------------------------------------- attachments --

-- Photos and PDFs, 10 MB each. Same bucket, same "own folder" policies for
-- the customer; the admin gets read and write across the bucket so a note
-- from us can carry a picture too. Keep the email list in step with
-- DEFAULT_ADMINS in api/admin.js.
update storage.buckets
   set file_size_limit    = 10485760,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
 where id = 'request-attachments';

drop policy if exists "request-attachments: admin read"  on storage.objects;
drop policy if exists "request-attachments: admin write" on storage.objects;

create policy "request-attachments: admin read" on storage.objects
  for select using (
    bucket_id = 'request-attachments'
    and (auth.jwt() ->> 'email') in ('kane.foster@ymail.com', 'kane@kanvas.one')
  );
create policy "request-attachments: admin write" on storage.objects
  for insert with check (
    bucket_id = 'request-attachments'
    and (auth.jwt() ->> 'email') in ('kane.foster@ymail.com', 'kane@kanvas.one')
  );
