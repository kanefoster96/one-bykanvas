-- A third kind of request: the customer changed their business details, and
-- their live site probably needs the same change.
--
-- It goes through the same queue as edits and features so there is one place
-- to look for work, but it costs nothing: zero points, so it never eats an
-- allowance, and shortfallFor() can only ever return zero for it, so the
-- accept step charges nothing without needing a special case.

alter table public.requests drop constraint if exists requests_kind_check;
alter table public.requests drop constraint if exists requests_points_match;

alter table public.requests
  add constraint requests_kind_check check (kind in ('edit', 'feature', 'info'));

alter table public.requests
  add constraint requests_points_match check (
    (kind = 'edit'    and points = 1) or
    (kind = 'feature' and points = 3) or
    (kind = 'info'    and points = 0)
  );

comment on column public.requests.kind is
  'edit (1 point) | feature (3 points) | info (0 points - a business-details
   change we raise ourselves from api/business-updated.js, free by design).';

-- The customer-facing insert grant is unchanged and still only lets them
-- write kind/points directly; an info row is written by the service role in
-- api/business-updated.js, never from the browser.
