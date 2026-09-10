/* Personal tokens for the MCP server, minted from the account page.
 *
 * The token is made here, shown to the customer once, and only its hash
 * is kept - the same way a password would be. Listing shows labels and
 * dates, never the token. Revoking sets revoked_at and the server refuses
 * it from then on. Everything is scoped to the signed-in user: nobody can
 * mint, see or revoke anyone else's.
 */
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { missingEnv, ourSiteUrl } = require('./_env.js');
const { TOKEN_PREFIX, sha } = require('./_mcp.js');

const MAX_TOKENS = 5;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('mcp-tokens: missing environment variables:', missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', '));
    return res.status(500).json({ error: 'Not configured.' });
  }

  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Please log in.' });
    const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY || SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await anon.auth.getUser(token);
    if (userError || !userData || !userData.user) return res.status(401).json({ error: 'Your session has expired.' });
    const user = userData.user;

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    if (body.action === 'list') {
      const { data, error } = await db.from('mcp_tokens').select('id, label, created_at, last_used_at, revoked_at')
        .eq('user_id', user.id).is('revoked_at', null).order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return res.status(200).json({ tokens: data || [] });
    }

    if (body.action === 'create') {
      const { count } = await db.from('mcp_tokens').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('revoked_at', null);
      if ((count || 0) >= MAX_TOKENS) return res.status(400).json({ error: 'That is ' + MAX_TOKENS + ' connections already. Revoke one first.' });
      const label = String(body.label || 'Claude').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Claude';
      const secret = TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
      const { data, error } = await db.from('mcp_tokens').insert({ user_id: user.id, token_hash: sha(secret), label }).select('id, label, created_at').single();
      if (error) throw new Error(error.message);
      /* The only time the token leaves the server. */
      return res.status(200).json({ token: data, secret, url: ourSiteUrl() + '/api/mcp/' + secret });
    }

    if (body.action === 'revoke') {
      const id = String(body.id || '');
      if (!id) return res.status(400).json({ error: 'Which one?' });
      const { error } = await db.from('mcp_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('mcp-tokens:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
