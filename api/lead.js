/* Catches an enquiry from the public form on the marketing site.
 *
 * The only endpoint here that anyone can call without a session - the form
 * sits on a public page and the person filling it in has no account yet, by
 * definition. So everything is validated and length-capped here rather than
 * trusted, and the service role is used purely because there is no session
 * to scope an insert to.
 *
 * The email to us is best effort, same as everywhere else: the lead is
 * already saved by the time it is attempted, so a mail problem costs a
 * notification, not the enquiry.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');
const { sendEmail, adminAddresses } = require('./_email.js');

const PLAN_INTEREST = ['business', 'pro', 'max', 'unsure'];

/* Deliberately loose - a real address this rejects is worse than a fake one
   it lets through, since the fake one just sits in a list we ignore. */
function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function clean(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('lead: missing environment variables:',
      missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', ') || '(none named)');
    return res.status(500).json({ error: 'Not configured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    const name = clean(body.name, 200);
    const business = clean(body.business, 200);
    const email = clean(body.email, 320);
    const about = clean(body.about, 4000);
    const planRaw = String(body.plan || '').toLowerCase();
    const plan_interest = PLAN_INTEREST.includes(planRaw) ? planRaw : null;

    if (!name || !business) return res.status(400).json({ error: 'Tell us your name and business.' });
    if (!looksLikeEmail(email)) return res.status(400).json({ error: 'That email does not look right.' });

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: row, error } = await db.from('leads').insert({
      name, business, email, about: about || null,
      plan_interest, want_app: Boolean(body.wantApp)
    }).select().single();
    if (error) throw new Error(error.message);

    const site = process.env.SITE_URL || 'https://one-bykanvas.vercel.app';
    const result = await sendEmail({
      to: adminAddresses(),
      subject: `New enquiry: ${business}`,
      text: `${name} at ${business} got in touch.\n\n`
          + `Email:     ${email}\n`
          + `Interested in: ${plan_interest || 'not said'}\n`
          + `Wants an app: ${body.wantApp ? 'yes' : 'no'}\n\n`
          + `What they said:\n${about || '-'}\n\n`
          + `Admin: ${site}/admin.html`,
      replyTo: email
    });
    console.log('lead: notify email', result);

    return res.status(200).json({ ok: true, id: row.id });
  } catch (err) {
    console.error('lead:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
