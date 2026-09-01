/* Creates a customer's edit/feature request, and tells us about it.
 *
 * Requests are included on every plan and cost nothing - what the plan buys
 * is queue position, and the admin page orders the queue by plan. The kind
 * is validated against _plans.js rather than trusted, and the row's points
 * value is kept only because the table's check constraint expects it; no
 * money is ever derived from it any more. Going through this endpoint
 * rather than a direct client insert is what lets a new request email us;
 * a plain insert would record the row just as well but nobody would know.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv, ourSiteUrl } = require('./_env.js');
const { REQUEST_COST } = require('./_plans.js');
const { sendEmail, adminAddresses } = require('./_email.js');
const { notifyAdmin } = require('./_notify.js');

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

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    /* Deleting a request's screenshots lives here rather than in an endpoint
       of its own. It is the same table, the same owner check and the same
       authentication, and Vercel's plan allows a fixed number of functions -
       spending one on a single action nobody calls twice a month is what
       stopped a deploy going out.

       It goes through the server at all because the customer has no UPDATE
       grant on requests, and because the storage delete and the column clear
       have to happen together rather than leaving one without the other. */
    if (body.action === 'clearAttachments') {
      const requestId = String(body.requestId || '');
      if (!requestId) return res.status(400).json({ error: 'Which request?' });

      const { data: reqRow, error: reqErr } = await db.from('requests')
        .select('id, user_id, status, attachment_paths').eq('id', requestId).maybeSingle();
      if (reqErr) throw new Error(reqErr.message);
      if (!reqRow || reqRow.user_id !== user.id) {
        return res.status(404).json({ error: 'Request not found.' });
      }
      /* Only once the site is live: the point of a screenshot is to show us
         something before the work happens, so it stays for as long as that
         could still matter. */
      if (reqRow.status !== 'done') {
        return res.status(400).json({ error: 'This is only available once the site is live.' });
      }

      const paths = reqRow.attachment_paths || [];
      if (paths.length) {
        const { error: rmErr } = await db.storage.from('request-attachments').remove(paths);
        if (rmErr) throw new Error(rmErr.message);
      }
      const { error: updErr } = await db.from('requests')
        .update({ attachment_paths: null }).eq('id', requestId);
      if (updErr) throw new Error(updErr.message);

      return res.status(200).json({ ok: true });
    }

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

    const { data: row, error } = await db.from('requests').insert({
      user_id: user.id, kind: kind, points: REQUEST_COST[kind].points, detail: detail,
      attachment_paths: attachmentPaths.length ? attachmentPaths : null
    }).select().single();
    if (error) throw new Error(error.message);

    const { data: profile } = await db.from('profiles')
      .select('business_name, active_plan').eq('id', user.id).maybeSingle();
    const name = (profile && profile.business_name) || user.email || 'A customer';
    const QUEUE = { business: 'in turn', pro: 'PRIORITY', max: 'TOP PRIORITY' };
    const place = QUEUE[profile && profile.active_plan] || 'in turn';

    const result = await sendEmail({
      to: adminAddresses(),
      subject: `New ${kind === 'feature' ? 'feature' : 'edit'} request: ${name}`,
      text: `${name} asked for ${kind === 'feature' ? 'a new feature' : 'an edit'} (${place}):\n\n${detail}\n\n`
          + (attachmentPaths.length ? `${attachmentPaths.length} screenshot${attachmentPaths.length === 1 ? '' : 's'} attached - view in admin.\n\n` : '')
          + `Included in their plan - the queue in admin is already in priority order.\n\n`
          + `Admin: ${ourSiteUrl()}/admin.html`,
      replyTo: user.email
    });
    console.log('requests: notify email', result);

    await notifyAdmin(db, 'New ' + (kind === 'feature' ? 'feature' : 'edit') + ' request',
      name + ' (' + place.toLowerCase() + '): ' + detail.slice(0, 140));

    return res.status(200).json({ request: row });
  } catch (err) {
    console.error('requests:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
