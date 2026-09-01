/* A Pro customer's marketing blast - its own function.
 *
 * This lived inside api/requests.js as an action while the Hobby plan capped
 * deployments at twelve functions. On Pro it gets its own route, and with it
 * its own time budget (vercel.json gives this one five minutes) - a long
 * send to a big list no longer has to fit inside the ten seconds a request
 * insert needs. The old action still answers at /api/requests for anyone on
 * a cached page. All the actual work stays in _campaign.js.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');
const { sendCampaign } = require('./_campaign.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('campaign: missing environment variables:',
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

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const out = await sendCampaign(db, userData.user, body);
    return res.status(out.status).json(out.body);
  } catch (err) {
    console.error('campaign:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
