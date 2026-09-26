/* What a free-example lead already told us, for the wizard to fill in.
 *
 * The ready email and the card on the example link into get-started with
 * ?lead=<id>. This answers with the business name, email, link and the
 * address they were offered, so the first screen is a check-your-details
 * rather than a form asking again for what they typed a day ago.
 *
 * The id is the lead row's UUID: random, unguessable, and only ever sent
 * to the address that asked for the example. Nothing here is returned that
 * the person did not type in themselves, and only free-example leads
 * answer - an enquiry never carried a "join" link.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('lead-prefill: missing environment variables:',
      missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', ') || '(none named)');
    return res.status(500).json({ error: 'Not configured.' });
  }

  const id = String((req.query && req.query.id) || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ error: 'Not a lead.' });
  }

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: lead, error } = await db.from('leads')
      .select('name, business, email, handle, requested_domain, source')
      .eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead || lead.source !== 'free-preview') return res.status(404).json({ error: 'Not a lead.' });

    return res.status(200).json({
      /* The mini form has no name field and sends the business as the name,
         so a name that is just the business again is not a person's name. */
      name: lead.name && lead.name !== lead.business ? lead.name : '',
      business: lead.business || '',
      email: lead.email || '',
      handle: lead.handle || '',
      domain: lead.requested_domain || ''
    });
  } catch (err) {
    console.error('lead-prefill:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};
