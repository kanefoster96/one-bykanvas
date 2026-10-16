/* A contact form on a site, posting here.
 *
 *   fetch('https://kanvas.one/api/enquiry', { method: 'POST', body: JSON.stringify({ site, name, email, phone, message, page }) })
 *
 * Stored (the app's Messages tab reads it back), pushed to the owner's
 * phone, and emailed to the owner only, from our address with the reply-to
 * set to the customer, so hitting Reply answers them from the owner's own
 * mailbox. One email per enquiry; nothing automatic goes to the customer.
 * Public and cross-origin like the beacon; a honeypot field (`website`)
 * catches the bots that fill in everything.
 */
const { createClient } = require('@supabase/supabase-js');
const { limitIp, tooMany } = require('./_rate.js');
const { missingEnv, ourSiteUrl } = require('./_env.js');
const { event } = require('./_notify.js');
const { sendEmail } = require('./_email.js');
const { html: emailHtml, esc } = require('./_email_template.js');
const { cleanName, cleanEmail, cleanPhone } = require('./_chat.js');
const { sendMetaEvent, adContext } = require('./_meta.js');

/* Kanvas One's own site: its demo requests (clubs.html) are leads from our
   ads, so Meta hears of them. Every other site's enquiries are theirs. */
const OUR_SITE = '9094de37-b610-41b6-98f1-2aaf8f5bd52b';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}
function parse(body) {
  if (body && typeof body === 'object') return body;
  try { return JSON.parse(String(body || '')); } catch (e) { return null; }
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); return res.status(405).json({ error: 'Method not allowed' }); }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('enquiry: missing environment variables:', missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', '));
    return res.status(500).json({ error: 'Not available right now.' });
  }
  try {
    const b = parse(req.body);
    if (!b) return res.status(400).json({ error: 'Bad request.' });
    // The honeypot: a real person never sees this field, a bot fills it.
    if (b.website) return res.status(200).json({ ok: true });
    const siteId = String(b.site || '').toLowerCase();
    if (!UUID.test(siteId)) return res.status(400).json({ error: 'This form is not set up yet.' });
    const message = String(b.message || '').replace(/\r\n?/g, '\n').trim().slice(0, 4000);
    const email = cleanEmail(b.email), phone = cleanPhone(b.phone), name = cleanName(b.name);
    if (message.length < 2) return res.status(400).json({ error: 'Write a message first.' });
    if (!email && !phone) return res.status(400).json({ error: 'Leave an email or a number so we can get back to you.' });

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    // Each one emails and pushes the site owner: 8 an hour from one address is plenty for a person.
    if (await limitIp(db, req, 'enquiry', 8, 3600)) return tooMany(res);
    const { data: site } = await db.from('sites').select('id, owner_id, name, url').eq('id', siteId).maybeSingle();
    if (!site) return res.status(404).json({ error: 'This form is not set up yet.' });
    const owner = await db.auth.admin.getUserById(site.owner_id).then((r) => (r.data && r.data.user && r.data.user.email) || null).catch(() => null);

    const { data: row, error } = await db.from('enquiries').insert({ site_id: site.id, name, email, phone, message, page: String(b.page || '').slice(0, 300) || null }).select('id').single();
    if (error) throw new Error(error.message);

    await event(db, site.id, 'enquiry', { name: name || email || phone, email, phone, text: message, record: 'enquiry', id: row.id });

    const metaId = String(b.metaEventId || '');
    if (site.id === OUR_SITE && /^[A-Za-z0-9_-]{8,80}$/.test(metaId)) {
      await sendMetaEvent(Object.assign(adContext(req, b), {
        name: 'Lead', eventId: metaId, email: email || undefined, phone: phone || undefined,
        url: ourSiteUrl() + String(b.page || '/clubs').slice(0, 100),
        custom: { content_name: 'clubs demo', content_category: 'max' }
      })).catch(() => {});
    }

    const who = [name, email, phone].filter(Boolean).join(' · ');
    if (owner) {
      await sendEmail({
        to: owner, subject: 'New enquiry on your website: ' + (name || email || phone), replyTo: email || undefined,
        text: who + '\n\n' + message + (b.page ? '\n\nFrom ' + b.page : '') + '\n\n' + (email ? 'Reply to this email and it goes straight to them.' : 'They left a number, not an email: give them a call.') + '\nIt is also in your Kanvas One app.',
        html: emailHtml({ preheader: message.slice(0, 90), heading: 'New enquiry on your website', lines: ['<b>' + esc(who) + '</b>', esc(message).replace(/\n/g, '<br>')], footer: (email ? 'Reply to this email and it goes straight to them.' : 'They left a number, not an email: give them a call.') + ' It is also in your Kanvas One app.' })
      });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('enquiry:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
