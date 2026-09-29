-- The owner may read their site row, but not its event secret: the
-- dashboard holds that server-side, and a browser session (or anything
-- running in one) must not be able to lift it. Column-level grants do
-- what the row policy cannot: everything but the secret.
revoke select on public.sites from authenticated;
grant select (id, owner_id, name, url, status, created_at, dashboard_url, modules, labels, deep_links,
              phone_number, forward_to, missed_call_text, watch_until)
  on public.sites to authenticated;
