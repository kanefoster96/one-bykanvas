/* Creates a customer's edit/feature request, and tells us about it.
 *
 * Points are decided here from _plans.js, never trusted from the browser -
 * the same rule the requests table's own check constraint enforces, so a
 * tampered client gets the same answer twice. Going through this endpoint
 * rather than a direct client insert is what lets a new request email us;
 * a plain insert would record the row just as well but nobody would know.
 *
 * Always lands as a fresh Request (the table's own default), never
 * pre-accepted - only the admin page accepting it decides whether points
 * cover it or the card on file gets charged, and nothing is built before
 * that happens.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');
const { REQUEST_COST } = require('./_plans.js');
const { sendEmail, adminAddresses } = require('./_email.js');
const { shortfallFor } = require('./_billing.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('requests: missing environment variables:',
      missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_PUBLISHABLE_KEY']).join(', ') || '(none named)');
    return res.status(500).json({ error: 'Not configured.' });
  }

  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Please log in.' });

    const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY || SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await anon.auth.getUser(token);
    if (userError || !userData || !userData.user) {
      return res.status(401).json({ error: 'Your session has expired.' });
    }
    const user = userData.user;

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const kind = String(body.kind || '').toLowerCase();
    const detail = String(body.detail || '').trim();

    if (!Object.prototype.hasOwnProperty.call(REQUEST_COST, kind)) {
      return res.status(400).json({ error: 'Unknown request kind.' });
    }
    if (!detail || detail.length > 4000) {
      return res.status(400).json({ error: 'Tell us what you would like changed.' });
    }

    /* Only paths the caller could actually have uploaded - storage itself
       only lets a path starting with the caller's own id be written, so
       anything else here is either a mistake or someone trying to reference
       a file that is not theirs. Capped, same reason the avatar upload caps
       file size: this is a screenshot attachment, not a file store. */
    const attachmentPaths = Array.isArray(body.attachmentPaths)
      ? body.attachmentPaths.map(String).filter((p) => p.startsWith(user.id + '/')).slice(0, 6)
      : [];

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: row, error } = await db.from('requests').insert({
      user_id: user.id, kind: kind, points: REQUEST_COST[kind].points, detail: detail,
      attachment_paths: attachmentPaths.length ? attachmentPaths : null
    }).select().single();
    if (error) throw new Error(error.message);

    // For the notify email only - what accepting this would come to, not a
    // decision made here. Nothing is charged or agreed until the admin page
    // accepts it.
    const { shortfall } = await shortfallFor(db, user.id, row.id);
    const amount = shortfall * REQUEST_COST.edit.amount; // £40/point, same rate either kind

    const { data: profile } = await db.from('profiles')
      .select('business_name').eq('id', user.id).maybeSingle();
    const name = (profile && profile.business_name) || user.email || 'A customer';

    const result = await sendEmail({
      to: adminAddresses(),
      subject: `New ${kind === 'feature' ? 'feature' : 'edit'} request: ${name}`,
      text: `${name} asked for ${kind === 'feature' ? 'a new feature' : 'an edit'}:\n\n${detail}\n\n`
          + (attachmentPaths.length ? `${attachmentPaths.length} screenshot${attachmentPaths.length === 1 ? '' : 's'} attached - view in admin.\n\n` : '')
          + (shortfall > 0
              ? `Would come to £${(amount / 100).toFixed(0)} over their allowance once accepted.\n\n`
              : 'Covered by their points once accepted.\n\n')
          + `Accept it from admin: https://one-bykanvas.vercel.app/admin.html`,
      replyTo: user.email
    });
    console.log('requests: notify email', result);

    return res.status(200).json({ request: row, shortfall, amount });
  } catch (err) {
    console.error('requests:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
