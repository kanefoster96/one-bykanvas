/* Sending email through Resend.
 *
 * Two rules hold this together.
 *
 * Without RESEND_API_KEY nothing is sent and nothing breaks: every call returns
 * quietly. That is what lets this ship before the domain is verified, and it is
 * why the callers below do not guard their own calls.
 *
 * And a failed send never reaches the caller. The one place this is used is the
 * Stripe webhook, where throwing would return a 500, and a 500 makes Stripe
 * retry the event - so a bounced notification would rewrite the subscription
 * again and again. A customer's payment must never depend on our mail working.
 */
const ENDPOINT = 'https://api.resend.com/emails';
const TIMEOUT_MS = 5000;

/* Where our own mail comes from. Resend needs this to be a verified domain, so
   until one is set up the default will be rejected - which is fine, because
   without a key nothing is attempted anyway. */
function sender() {
  return process.env.EMAIL_FROM || 'one by Kanvas <onboarding@resend.dev>';
}

function adminAddresses() {
  return (process.env.ADMIN_EMAILS || 'kane@kanvas.one')
    .split(',').map(s => s.trim()).filter(Boolean);
}

/* Returns 'sent', 'skipped' or 'failed'. Never throws.
 *
 * html is optional - internal admin-facing notices stay text-only, since
 * nobody but us reads them and plain text is one less thing to get wrong.
 * Anything a customer sees should pass both: Resend (and most inboxes)
 * expect a text part alongside html, not html alone. */
async function sendEmail({ to, subject, text, html, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return 'skipped';

  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length || !subject || !text) return 'skipped';

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: sender(),
        to: recipients,
        subject,
        text,
        ...(html ? { html } : {}),
        ...(replyTo ? { reply_to: replyTo } : {})
      }),
      signal: ctrl.signal
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('email: resend refused', res.status, detail.slice(0, 300));
      return 'failed';
    }
    return 'sent';
  } catch (err) {
    console.error('email: send failed', err && err.message);
    return 'failed';
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendEmail, adminAddresses };
