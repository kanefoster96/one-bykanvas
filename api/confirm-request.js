/* Public confirmation link for a reclassified request. No login: the token
 * itself is the credential, generated server-side and mailed only to the
 * customer's own address - the same trust model as a password reset link,
 * and single-use for the same reason (cleared the moment it works, so it
 * can never be replayed).
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv, ourSiteUrl } = require('./_env.js');
const { sendEmail, adminAddresses } = require('./_email.js');

function page(title, body) {
  return '<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + title + ' — Kanvas One</title></head>'
    + '<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;'
    + 'margin:96px auto;padding:0 24px;color:#1d1d1f;text-align:center">'
    + '<h1 style="font-size:22px;margin-bottom:12px">' + title + '</h1>'
    + '<p style="color:#6e6e73;line-height:1.5">' + body + '</p>'
    + '</body></html>';
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send(page('Method not allowed', ''));
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('confirm-request: missing environment variables:',
      missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', ') || '(none named)');
    return res.status(500).send(page('Something went wrong', 'Please email us and we will sort it out.'));
  }

  const token = String((req.query && req.query.token) || '').trim();
  if (!token) {
    return res.status(400).send(page('Missing link', 'That link looks incomplete — copy it again from the email.'));
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const { data: reqRow, error } = await db.from('requests')
      .select('id, kind, detail, user_id')
      .eq('confirm_token', token).maybeSingle();
    if (error) throw new Error(error.message);

    if (!reqRow) {
      return res.status(404).send(page('Already handled',
        'This link has already been used, or isn’t valid. Email us if something looks wrong.'));
    }

    const { error: updErr } = await db.from('requests')
      .update({ confirm_token: null, price_confirmed_at: new Date().toISOString(), status: 'accepted' })
      .eq('id', reqRow.id);
    if (updErr) throw new Error(updErr.message);

    const { data: profile } = await db.from('profiles')
      .select('business_name').eq('id', reqRow.user_id).maybeSingle();

    const result = await sendEmail({
      to: adminAddresses(),
      subject: `Confirmed: ${(profile && profile.business_name) || 'a customer'} agreed the new price`,
      text: `They confirmed the ${reqRow.kind} — "${reqRow.detail}" — go ahead and start it.\n\n`
          + `Admin: ${ourSiteUrl()}/admin.html`
    });
    console.log('confirm-request: notify email', result);

    return res.status(200).send(page('Thanks — confirmed', 'We’ll get started on it now.'));
  } catch (err) {
    console.error('confirm-request:', err && err.message);
    return res.status(500).send(page('Something went wrong', 'Please email us and we will sort it out.'));
  }
};
