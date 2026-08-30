/* Tells us a customer has changed their business details.
 *
 * The save itself happens straight from the browser - profiles has per-column
 * grants and RLS scoping every write to the owner's own row, so this endpoint
 * deliberately writes nothing. It exists only so the change does not sit in a
 * table nobody looks at: a business name, contact email or opening hours
 * changing usually means their live site needs the same change, and that is a
 * job for us rather than something they can do themselves.
 *
 * Verified from the caller's own token - it reads back their profile with the
 * service role rather than trusting anything in the request body, so the email
 * always describes what was actually saved.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');
const { sendEmail, adminAddresses } = require('./_email.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('business-updated: missing environment variables:',
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

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: p, error } = await db.from('profiles')
      .select('business_name, public_email, phone, address, service_area, opening_hours, '
            + 'services, site_goals, existing_links, site_url, site_status')
      .eq('id', user.id).maybeSingle();
    if (error) throw new Error(error.message);

    const name = (p && p.business_name) || user.email || 'A customer';
    const site = process.env.SITE_URL || 'https://one-bykanvas.vercel.app';

    /* Raise it in the same queue as edits and features, so there is one place
       to look for work. Zero points, so it never touches their allowance and
       accepting it can never charge anything.

       Saving twice does not stack up two jobs: an info request still open is
       rewritten rather than duplicated, since the only thing that matters is
       what their details say now. */
    const summary = 'Business details updated — check the live site matches: '
      + [
          p && p.business_name,
          p && p.public_email,
          p && p.phone,
          p && p.address || (p && p.service_area),
          p && p.opening_hours
        ].filter(Boolean).join(' · ').slice(0, 3000);

    const { data: openInfo, error: openErr } = await db.from('requests')
      .select('id')
      .eq('user_id', user.id).eq('kind', 'info')
      .not('status', 'in', '("done","declined")')
      .limit(1);
    if (openErr) throw new Error(openErr.message);

    if (openInfo && openInfo.length) {
      const { error: upErr } = await db.from('requests')
        .update({ detail: summary, created_at: new Date().toISOString() })
        .eq('id', openInfo[0].id);
      if (upErr) throw new Error(upErr.message);
    } else {
      const { error: insErr } = await db.from('requests')
        .insert({ user_id: user.id, kind: 'info', points: 0, detail: summary });
      if (insErr) throw new Error(insErr.message);
    }

    const lines = [
      `${name} updated their business details.`,
      '',
      `Business:      ${(p && p.business_name) || '-'}`,
      `Contact email: ${(p && p.public_email) || '-'}`,
      `Phone:         ${(p && p.phone) || '-'}`,
      `Address:       ${(p && p.address) || '-'}`,
      `Area covered:  ${(p && p.service_area) || '-'}`,
      '',
      'Opening hours:',
      (p && p.opening_hours) || '-',
      '',
      'Menu / services:',
      (p && p.services) || '-',
      '',
      `Their site: ${(p && p.site_url) || 'not live yet'}`,
      '',
      'This is in your queue as a free job - accept it and mark it live once',
      'the site matches. Nothing is charged for it.',
      `Admin: ${site}/admin.html`
    ];

    const result = await sendEmail({
      to: adminAddresses(),
      subject: `Business details updated: ${name}`,
      text: lines.join('\n'),
      replyTo: user.email
    });
    console.log('business-updated: notify email', result);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('business-updated:', err && err.message);
    return res.status(500).json({ error: 'Saved, but we could not notify anyone.' });
  }
};
