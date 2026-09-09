/* The customer's side of Requests: a new request, or a reply on one.
 *
 * Requests are included on every plan and cost nothing. The kind is
 * validated against _plans.js rather than trusted, and the row's points
 * value is kept only because the table's check constraint expects it; no
 * money is ever derived from it. Everything goes through here rather than
 * a direct insert because a note also moves the status, stamps whose turn
 * it is and queues the email - see _requests.js.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv, ourSiteUrl } = require('./_env.js');
const { REQUEST_COST } = require('./_plans.js');
const { cleanBody, cleanAttachments, addNote } = require('./_requests.js');
const { pointsWindowStart } = require('./_billing.js');

const STARTER_MONTHLY_CHANGES = 1;

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
       of its own: same table, same owner check, same authentication, and an
       action called a few times a month does not earn a file. (The function
       cap that once forced this arrangement is gone - this one just has no
       reason to move.)

       It goes through the server at all because the customer has no UPDATE
       grant on requests, and because the storage delete and the column clear
       have to happen together rather than leaving one without the other. */
    /* ---- the customer's own referral code, minted on first ask -------
     *
     * Server-side because the code must be unique and is the thing money
     * hangs off. Readable prefix from the business name, short unambiguous
     * suffix; the unique index arbitrates races and collisions.
     */
    if (body.action === 'getReferralCode') {
      const { data: p, error: pErr } = await db.from('profiles')
        .select('referral_code, business_name').eq('id', user.id).maybeSingle();
      if (pErr) throw new Error(pErr.message);

      let code = p && p.referral_code;
      if (!code) {
        const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
        const prefix = String((p && p.business_name) || 'ONE')
          .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'ONE';
        for (let attempt = 0; attempt < 4 && !code; attempt++) {
          let suffix = '';
          for (let i = 0; i < 4; i++) suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
          const candidate = attempt < 3 ? `${prefix}-${suffix}` : `REF-${suffix}${ALPHABET[Math.floor(Math.random() * ALPHABET.length)]}`;
          const { error: mintErr } = await db.from('profiles')
            .update({ referral_code: candidate }).eq('id', user.id).is('referral_code', null);
          if (mintErr) { console.error('requests: mint clash, retrying:', mintErr.message); continue; }
          const { data: after } = await db.from('profiles')
            .select('referral_code').eq('id', user.id).maybeSingle();
          code = after && after.referral_code;
        }
        if (!code) return res.status(500).json({ error: 'Could not make a code just now. Try again.' });
      }

      const site = ourSiteUrl();
      return res.status(200).json({
        code,
        link: `${site}/get-started.html?ref=${encodeURIComponent(code)}`
      });
    }

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

    /* ---- a reply on one of their own threads ------------------------- */
    if (body.action === 'reply') {
      const requestId = String(body.requestId || '');
      if (!requestId) return res.status(400).json({ error: 'Which request?' });
      const { data: reqRow, error: reqErr } = await db.from('requests')
        .select('*').eq('id', requestId).maybeSingle();
      if (reqErr) throw new Error(reqErr.message);
      if (!reqRow || reqRow.user_id !== user.id) {
        return res.status(404).json({ error: 'Request not found.' });
      }
      const cleaned = cleanBody(body.body);
      if (cleaned.error) return res.status(400).json({ error: cleaned.error });

      const out = await addNote(db, reqRow, {
        author: 'customer', body: cleaned.body,
        attachmentPaths: cleanAttachments(body.attachmentPaths, user.id, false)
      });
      return res.status(200).json({ ok: true, note: out.note, request: out.request });
    }

    /* ---- a new request: the header row, then its first note ------------ */
    const kind = String(body.kind || '').toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(REQUEST_COST, kind) || kind === 'info') {
      return res.status(400).json({ error: 'Unknown request kind.' });
    }
    const cleaned = cleanBody(body.body != null ? body.body : body.detail);
    if (cleaned.error) return res.status(400).json({ error: cleaned.error });

    /* The title is the catalogue pick, or the first line of what they
       wrote - short, because it is the subject of every email about it. */
    let title = String(body.title || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!title) title = cleaned.body.split('\n')[0].trim().slice(0, 80);

    const attachmentPaths = cleanAttachments(body.attachmentPaths, user.id, false);

    /* Starter: one change per billing month to what is already on the
       site. The window starts when the payment is taken - points_reset_at,
       which the webhook moves at every renewal - so it always resets to one,
       used or not. A feature ask is not a change; it is the start of a
       Business conversation, so only edits count. */
    if (kind === 'edit') {
      const { data: prof } = await db.from('profiles')
        .select('active_plan, points_reset_at, current_period_end').eq('id', user.id).maybeSingle();
      if (prof && prof.active_plan === 'starter') {
        const since = pointsWindowStart(prof).toISOString();
        const { count } = await db.from('requests')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('kind', 'edit').gte('created_at', since);
        if ((count || 0) >= STARTER_MONTHLY_CHANGES) {
          return res.status(400).json({ error: 'That\u2019s your change for this month. The next one comes with your next payment, or Business has unlimited changes.' });
        }
      }
    }

    const { data: row, error } = await db.from('requests').insert({
      user_id: user.id, kind: kind, points: REQUEST_COST[kind].points,
      title: title, detail: cleaned.body,
      attachment_paths: attachmentPaths.length ? attachmentPaths : null
    }).select().single();
    if (error) throw new Error(error.message);

    const out = await addNote(db, row, {
      author: 'customer', body: cleaned.body, attachmentPaths: attachmentPaths, first: true
    });

    return res.status(200).json({ request: out.request, count: 1 });
  } catch (err) {
    console.error('requests:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
