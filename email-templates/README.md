# Supabase Auth email templates

These two aren't sent by this app's own code - they're sent directly by
Supabase Auth (`confirm-signup.html` when someone signs up, `reset-password.html`
when someone asks to reset their password), so they live here as reference
files rather than in `api/`. Paste their contents into the Supabase dashboard
by hand; nothing in this repo deploys them automatically.

Both are **generated** from the same branded shell every other email uses, so
they cannot drift out of step with it:

```
node email-templates/build.js
```

Edit the copy in `build.js`, run it, then paste the regenerated files into the
Supabase dashboard. Never hand-edit the `.html` files - the next run overwrites
them.

## One-time setup

1. **Route Supabase Auth email through Resend**, so these actually get
   delivered reliably (Supabase's own built-in sender is rate-limited and
   not meant for production use):
   Supabase Dashboard → Authentication → Emails → SMTP Settings → enable
   Custom SMTP:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: your Resend API key
   - Sender email: the same address `EMAIL_FROM` uses in Vercel
   - Sender name: `one, by Kanvas`

2. **Paste the templates**: Authentication → Email Templates →
   - "Confirm signup" → paste `confirm-signup.html`
   - "Reset password" → paste `reset-password.html`

   Supabase's own `{{ .ConfirmationURL }}` variable is left in place in both
   files - it fills in automatically, nothing to edit there.
