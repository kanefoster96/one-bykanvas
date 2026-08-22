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

- **Reviews** in `index.html` are placeholders (`Sample Name`). Replace them
  with real, attributed quotes — the section is marked with an HTML comment.
- **Lead form** currently validates and logs to the console only. Point the
  submit handler in `script.js` at a real endpoint (Formspree, a Vercel
  function, or your CRM).
- Check the footer legal note matches your actual terms.

## Plans

| Plan     | Price      | Includes |
|----------|-----------|----------|
| Business | £50/mo    | Build, domain, hosting, requested features, support. Edits £35 each |
| Pro      | £90/mo    | + 5 edits/mo, SEO review, testing |
| Max      | £150/mo   | + 10 edits/mo, monthly SEO improvements |
| App      | £100/mo   | Add-on: iOS + Android, bug fixes, 1 improvement/mo |
