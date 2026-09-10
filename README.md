# one — by Kanvas

Marketing site for **one**, a service that builds and hosts websites for small
businesses on a flat monthly fee.

## Stack

Static HTML, CSS and vanilla JS. No build step, no dependencies.

```
index.html      all sections
styles.css      Apple-inspired design system (tokens at the top of the file)
script.js       menu, scroll reveal, review rail, FAQ, lead form
assets/         favicon
```

## Run locally

```bash
python3 -m http.server 8000    # then open http://localhost:8000
```

## Deploy

Any static host. On Vercel: import the repo, framework preset **Other**, no
build command, output directory `.`.

## Before launch

- **Reviews** (`reviews.js`, `FALLBACK` array) are still placeholder quotes
  with invented names — swap them for real, attributed customer quotes, or
  connect Google reviews via `/api/reviews` (see the comment at the top of
  the file).
- **Lead form** currently validates and logs to the console only. Point the
  submit handler in `script.js` at a real endpoint (Formspree, a Vercel
  function, or your CRM).
- Check the footer legal note matches your actual terms.

## Plans

| Plan     | Price   | Includes |
|----------|---------|----------|
| Starter  | £25/mo  | A live site built for you, contact details, hours, socials, photos, meet the team, found on Google. One change a month through the dashboard. |
| Business | £50/mo  | Everything above plus unlimited changes, payments online, bookings or orders, customer logins and records, reviews asked for automatically, live chat and forms. |
| Max      | £250/mo | Everything in Business plus monthly SEO improvements, business email at their own address, first in the queue. |

Annual is ten months' money for twelve. Prices live in `api/_plans.js` and
nowhere else. Pro is legacy and no longer sold.

## Kanvas One from a Claude chat (MCP)

`api/mcp.js` is a multi-tenant MCP server. A call is resolved to a Kanvas One
user account, then `list_sites` says which sites that account may talk about:
a customer sees the sites they own, the admin sees every site. Every other
site tool takes a `site_id` and the server checks, on every call, that the
site belongs to the caller before reading or writing anything. A site that is
not theirs is a permission error. Queries are scoped to that site; with
`SUPABASE_JWT_SECRET` set, a customer's reads also run through a client signed
as them, so row level security enforces the same thing in the database.

Read tools answer straight away. Every write tool returns a plain-English
preview and a `confirmation_id`; nothing sends, charges, refunds or changes a
plan until `confirm(confirmation_id)` is called, within ten minutes, once, by
the user who previewed it. Everything confirmed is written to `mcp_actions`.

Customers get: `list_sites`, `site_summary`, `inbox_list`, `request_get`,
`orders_list`, `membership_get`, `actions_recent`, and with confirm
`request_reply`, `request_new`, `membership_change_plan`, `membership_cancel`.
The admin gets all of those on any site, plus `summary`, `customers_list`,
`memberships_list`, `leads_list`, `partners_list`, and with confirm
`request_set_status`, `refund`, `email_send`, `customer_note`, `site_set`,
`lead_send_preview`, `partner_mark_paid`.

Three kinds of token are accepted, in the `Authorization: Bearer` header or as
`/api/mcp/<token>` in the path:

- a personal token (`k1_...`) minted from the account page's "Connect Claude"
  card (`api/mcp-tokens.js`), stored only as a hash, revocable there;
- a Supabase session access token, which is how an in-app assistant will call
  the same `callTool` with the signed-in user;
- `MCP_ADMIN_TOKEN`, the admin's standing token.

Setup, once:

1. Run `supabase/migrations/0033_mcp_actions.sql` and `0034_sites_and_mcp_tokens.sql`.
2. In Vercel, add `MCP_ADMIN_TOKEN` (a long random secret, 32+ characters) and
   `MCP_READ_ONLY=true`. Writes stay refused until it is exactly `false`.
   Optionally add `SUPABASE_JWT_SECRET` (the project's JWT secret) so customer
   reads go through row level security.

Connect:

- Claude Code:
  `claude mcp add kanvas --transport http https://kanvas.one/api/mcp --header "Authorization: Bearer <token>"`
- claude.ai and Cowork: Settings → Connectors → Add custom connector →
  `https://kanvas.one/api/mcp/<token>`

A token URL is a password. Customers revoke theirs from the account page; the
admin token changes in Vercel.

## The One app

`app/` is the customer's phone app: notifications, live chat and
analytics for their site, with their own dashboard opened inside it and the
Requests feature as the Support tab. It runs at `/app/` and, through
Capacitor, as the native iOS and Android app. `beacon.js` is the one-line
analytics tag every site gets; `api/beacon.js` stores the views, `api/app.js`
serves the app, `chat.js` and `api/chat.js` are the live chat widget and its
endpoint, `api/_notify.js` words every event with the site's own labels
and `api/_push.js` sends it to their phone. Setup and the native build are in
`app/README.md`.

