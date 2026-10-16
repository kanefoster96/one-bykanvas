-- Customers write to their own rows straight from the browser (account page,
-- sign-up wizard, notifications), and row level security only checks WHOSE
-- row it is, not WHICH columns change. With Supabase's default table grants
-- a signed-in customer could therefore set their own active_plan,
-- subscription_status, admin_notes, Stripe ids or referral fields from the
-- browser console: a free upgrade to One. Column grants close that: the
-- browser may write only what the pages themselves write, and everything
-- else is the server's (service role, which these grants do not touch).

-- profiles: the sign-up wizard (get-started.js buildRow, replayed by
-- account.js flushPendingOnboarding), the account page (business details,
-- name, logo, the two email switches) and notifications.js (seen time).
-- Upserts need INSERT and UPDATE on every column they send, id included.
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant insert (
  id, business_name, contact_name, business_type, site_uses, selected_plan,
  requested_domain, domain_owned, site_goals, max_model, onboarded_at,
  public_email, phone, address, service_area, opening_hours, services,
  existing_links, avatar_path, notifications_seen_at, notify_optout, marketing_optin
) on public.profiles to authenticated;
grant update (
  id, business_name, contact_name, business_type, site_uses, selected_plan,
  requested_domain, domain_owned, site_goals, max_model, onboarded_at,
  public_email, phone, address, service_area, opening_hours, services,
  existing_links, avatar_path, notifications_seen_at, notify_optout, marketing_optin
) on public.profiles to authenticated;

-- requests: the browser only marks a thread read (requests.js). New requests,
-- prices and statuses all go through the server.
revoke insert, update, delete, truncate on public.requests from anon, authenticated;
grant update (customer_seen_at) on public.requests to authenticated;
-- ("requests: insert own" stays as a policy but does nothing without INSERT.)

-- audience: written only by the server (imports, unsubscribe). A customer
-- adding addresses of their own choosing to a mailing list is not wanted.
revoke insert, update, delete, truncate on public.audience from anon, authenticated;
-- (Its "own write" and "own delete" policies likewise do nothing now.)
