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

| Plan     | Price      | Includes |
|----------|-----------|----------|
| Business | £50/mo    | Build, domain, hosting, requested features, support. 1 point/mo |
| Pro      | £120/mo   | + 3 points/mo, SEO review, testing |
| Max      | £250/mo   | + 5 points/mo, monthly SEO updates |
| App      | £100/mo   | Add-on: iOS + Android, bug fixes, 1 improvement/mo |

An edit costs 1 point, a feature 3, on every plan — see `api/_plans.js`
(REQUEST_COST) for the exact pence values. Beyond a plan's points, an edit
is £40 and a feature £120.
