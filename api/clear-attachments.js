/* Deletes a request's screenshots from storage and clears the column.
 *
 * Goes through here rather than a direct client call because the customer
 * has no UPDATE grant on requests (matching every other write to that
 * table - only the service role moves it), and because the storage delete
 * and the column clear need to happen together rather than leaving one
 * without the other.
 *
 * Only once the site is live: the whole point of a screenshot is to show
 * us something before the work happens, so it stays around for as long as
 * that could still matter.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('clear-attachments: missing environment variables:',
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
    const requestId = String(body.requestId || '');
    if (!requestId) return res.status(400).json({ error: 'Which request?' });

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: reqRow, error: reqErr } = await db.from('requests')
      .select('id, user_id, status, attachment_paths').eq('id', requestId).maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!reqRow || reqRow.user_id !== user.id) return res.status(404).json({ error: 'Request not found.' });
    if (reqRow.status !== 'done') return res.status(400).json({ error: 'This is only available once the site is live.' });

    const paths = reqRow.attachment_paths || [];
    if (paths.length) {
      const { error: rmErr } = await db.storage.from('request-attachments').remove(paths);
      if (rmErr) throw new Error(rmErr.message);
    }

    const { error: updErr } = await db.from('requests')
      .update({ attachment_paths: null }).eq('id', requestId);
    if (updErr) throw new Error(updErr.message);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('clear-attachments:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
