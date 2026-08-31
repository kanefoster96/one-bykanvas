-- Sending someone their finished free example.
--
-- Two columns rather than none, because "did I already send this one?" is a
-- question with a real cost attached: sending twice looks careless, and never
-- sending at all loses the lead. The admin page reads these to say which is
-- which, and to stop a second send being one stray click away.

alter table public.leads
  add column if not exists preview_url text,
  add column if not exists preview_sent_at timestamptz;

comment on column public.leads.preview_url is
  'Where their finished example lives. Typed in by us on the admin page, and
   put on the button in the email they get.';

comment on column public.leads.preview_sent_at is
  'When that email went. Null means still to do - which is what the admin
   page sorts and filters on, so an unanswered request cannot quietly sink
   down a list.';

-- The work queue is "free examples not yet sent, oldest first", so it gets an
-- index rather than a scan that grows with every enquiry ever taken.
create index if not exists leads_pending_previews_idx
  on public.leads (created_at)
  where source = 'free-preview' and preview_sent_at is null;
