# Supabase Auth email templates

Two emails are not sent by this app's own code. Supabase Auth sends them
directly - `confirm-signup.html` when someone signs up, `reset-password.html`
when someone asks to reset their password - so they live here rather than in
`api/`, and they have to be pasted into the Supabase dashboard by hand.
Nothing in this repo deploys them.

Both are **generated** from the same branded shell every other email uses, so
they cannot drift out of step with it:

```
node email-templates/build.js
```

Edit the copy in `build.js`, run it, then paste the regenerated files into the
Supabase dashboard. Never hand-edit the `.html` files - the next run
overwrites them.

Only these two matter. Supabase also ships templates for magic links, invites
and email changes; none of those flows exist in this app (customers can change
their password, not their address), so those templates never fire.

---

## One-time setup

### 1. An API key for Supabase to send with

Resend → **API Keys** → **Create API Key**.

- Name: `Supabase SMTP`
- Permission: **Sending access**
- Domain: `kanvas.one`

Make it a separate key from the one Vercel uses, so either can be revoked
without breaking the other. Resend shows the key once - paste it straight into
step 2 and nowhere else.

### 2. Route Supabase Auth email through Resend

Supabase's built-in sender is rate-limited and explicitly not meant for
production, so this step is what makes these emails actually arrive.

Supabase Dashboard → **Authentication** → **Emails** → **SMTP Settings** →
enable **Custom SMTP**:

| Field | Value |
| --- | --- |
| Sender email | the address `EMAIL_FROM` uses in Vercel |
| Sender name | `Kanvas (one.)` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the key from step 1 |

Save. While you are on that screen, check **Authentication → Rate Limits →
emails sent per hour** - it lifts off the built-in ceiling once custom SMTP is
on, but the new default is still finite.

### 3. Paste the templates

Supabase Dashboard → **Authentication** → **Emails** → **Templates**:

| Template | Subject | Body |
| --- | --- | --- |
| Confirm signup | `Confirm your email` | `confirm-signup.html` |
| Reset password | `Reset your password` | `reset-password.html` |

Replace the whole body, not part of it. Supabase's own `{{ .ConfirmationURL }}`
variable is already in both files and fills itself in - nothing to edit there.

### 4. Allowlist where the links land

This is the step that silently breaks things if it is skipped. Both flows ask
Supabase to send the customer to `/account.html` afterwards
(`emailRedirectTo` in `auth.js` and `get-started.js`, `redirectTo` in the
forgot-password handler). An address that is not on the allowlist is ignored,
and the customer is dropped somewhere else with no error to explain it.

Supabase Dashboard → **Authentication** → **URL Configuration**:

- **Site URL**: `https://kanvas.one`
- **Redirect URLs**: add `https://kanvas.one/account.html`, plus the Vercel
  preview domain if you test signups there.

### 5. Test both, with a real address

Sign up with an address you actually control and that has no account yet, then
use **Forgot password** on the login page for the other. Check the branding
looks right, and that the button lands you on `/account.html` already signed
in. Resend → **Logs** shows whether each one left the building.

A made-up address fails silently and looks exactly like a broken template.
