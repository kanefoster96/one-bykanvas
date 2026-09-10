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

## Admin from a Claude chat (MCP)

`api/mcp.js` is an MCP server for the admin side: inbox and edit requests,
customers, memberships, payments and refunds, leads, partners. Read tools
answer straight away. Every write tool returns a plain-English preview and
a `confirmation_id`; nothing sends, charges, refunds or changes a plan until
`confirm(confirmation_id)` is called, within ten minutes, once. Everything
confirmed is written to `mcp_actions`, and `actions_recent` reads it back.

Setup, once:

1. Run `supabase/migrations/0033_mcp_actions.sql`.
2. In Vercel, add `MCP_ADMIN_TOKEN` (a long random secret, 32+ characters)
   and `MCP_READ_ONLY=true`. Writes stay refused until it is exactly `false`.

Connect:

- Claude Code:
  `claude mcp add kanvas --transport http https://kanvas.one/api/mcp --header "Authorization: Bearer $MCP_ADMIN_TOKEN"`
- claude.ai and Cowork: Settings → Connectors → Add custom connector →
  `https://kanvas.one/api/mcp/<token>`

The token URL is a password. Never share it or paste it into a chat; if it
leaks, change `MCP_ADMIN_TOKEN` in Vercel and the old one stops working.
