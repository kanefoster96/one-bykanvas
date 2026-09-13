/* A contact form on a site, posting here.
 *
 *   fetch('https://kanvas.one/api/enquiry', { method: 'POST', body: JSON.stringify({ site, name, email, phone, message, page }) })
 *
 * Stored, pushed to the owner's phone, emailed to the owner, and answered
 * to the sender straight away: "we've got it, we'll call or email you back
 * shortly". Public and cross-origin like the beacon; a honeypot field
 * (`website`) catches the bots that fill in everything.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');
const { event } = require('./_notify.js');
const { sendEmail } = require('./_email.js');
const { html: emailHtml, esc } = require('./_email_template.js');
const { cleanName, cleanEmail, cleanPhone } = require('./_chat.js');

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
    const { data: site } = await db.from('sites').select('id, owner_id, name, url').eq('id', siteId).maybeSingle();
    if (!site) return res.status(404).json({ error: 'This form is not set up yet.' });
    const { data: prof } = await db.from('profiles').select('business_name').eq('id', site.owner_id).maybeSingle();
    const business = site.name || (prof && prof.business_name) || 'us';
    const owner = await db.auth.admin.getUserById(site.owner_id).then((r) => (r.data && r.data.user && r.data.user.email) || null).catch(() => null);

    const { data: row, error } = await db.from('enquiries').insert({ site_id: site.id, name, email, phone, message, page: String(b.page || '').slice(0, 300) || null }).select('id').single();
    if (error) throw new Error(error.message);

    await event(db, site.id, 'person', { name: name || email || phone, email, phone, source: 'enquiry from your site', record: 'enquiry', id: row.id });

    const who = [name, email, phone].filter(Boolean).join(' · ');
    if (owner) {
      await sendEmail({
        to: owner, subject: 'New enquiry: ' + (name || email || phone), replyTo: email || undefined,
        text: who + '\n\n' + message + (b.page ? '\n\nFrom ' + b.page : '') + '\n\nReply to this email to answer them.',
        html: emailHtml({ preheader: message.slice(0, 90), heading: 'New enquiry from your site', lines: ['<b>' + esc(who) + '</b>', esc(message).replace(/\n/g, '<br>')], footer: 'Reply to this email to answer them. They have already been told you will be in touch shortly.' })
      });
    }
    let replied = 'skipped';
    if (email) {
      replied = await sendEmail({
        to: email, subject: 'Thanks, ' + business + ' will be in touch shortly', replyTo: owner || undefined,
        text: 'Hi' + (name ? ' ' + name.split(' ')[0] : '') + ',\n\nThanks for your message. We’ve got it and will call or email you back shortly.\n\n' + business,
        html: emailHtml({ preheader: 'We’ve got your message.', heading: 'Thanks, we’ve got your message', lines: ['Hi' + (name ? ' ' + esc(name.split(' ')[0]) : '') + ',', 'Thanks for getting in touch. We’ve got your message and will call or email you back shortly.', '<b>' + esc(business) + '</b>'], footer: 'You sent this from ' + esc(business) + '’s website. Reply to this email if you want to add anything.' }),
        headers: { 'Auto-Submitted': 'auto-replied' }
      });
      if (replied === 'sent') await db.from('enquiries').update({ replied_at: new Date().toISOString() }).eq('id', row.id);
    }
    return res.status(200).json({ ok: true, replied: replied === 'sent' });
  } catch (err) {
    console.error('enquiry:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
