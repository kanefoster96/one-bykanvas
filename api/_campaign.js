/* A Pro customer's own marketing blast.
 *
 * They write a subject, a message, maybe an image and a link; we send it to
 * everyone on their audience list, from an address at their own domain. Their
 * domain has to be verified with the email provider first, which is a manual
 * job - so the gate is profiles.campaign_from: until the admin sets it, this
 * refuses politely, and setting it is the act of switching the feature on.
 *
 * Every message carries its own unsubscribe link, signed over the audience
 * row id. That is not optional: it is what UK marketing rules require, and it
 * is what keeps the sending domains - which we also look after - off spam
 * lists.
 */
const { sendBatch } = require('./_email.js');
const { tokenFor, unsubscribeHeaders } = require('./_unsubscribe.js');
const { notifyAdmin } = require('./_notify.js');
const { ourSiteUrl } = require('./_env.js');

/* Sized for the Pro plan's five-minute function budget (vercel.json), with
   Resend's batches paced at two a second by _email.js. The cap is about one
   send staying one function call - a genuinely bigger list is a conversation,
   not a bigger loop. */
const MAX_RECIPIENTS = 5000;
const GAP_MINUTES = 15;        // between sends: double-clicks, not a quota

const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif";

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* Their words, not a template's: paragraphs split on blank lines, single
   newlines kept as breaks. Everything escaped - this lands in strangers'
   inboxes under their name and ours. */
function paragraphs(message) {
  return String(message).trim().split(/\n{2,}/).map((p) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1d1d1f;">${esc(p).replace(/\n/g, '<br>')}</p>`
  ).join('');
}

function campaignHtml({ businessName, message, imageUrl, linkUrl, linkText, unsubUrl }) {
  return `<!doctype html>
<html lang="en-GB">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f5f5f7;font-family:${FONT};">
  <div style="max-width:520px;margin:0 auto;padding:36px 16px;">
    <div style="background:#fff;border-radius:20px;overflow:hidden;">
      ${imageUrl ? `<img src="${esc(imageUrl)}" alt="" style="display:block;width:100%;height:auto;">` : ''}
      <div style="padding:30px 30px 26px;">
        <p style="margin:0 0 18px;font-size:14px;font-weight:600;letter-spacing:.01em;color:#86868b;">${esc(businessName)}</p>
        ${paragraphs(message)}
        ${linkUrl ? `<a href="${esc(linkUrl)}" style="display:inline-block;margin-top:6px;padding:13px 26px;border-radius:980px;background:#1d1d1f;color:#fff;font-size:15px;font-weight:600;text-decoration:none;">${esc(linkText || 'Take a look')}</a>` : ''}
      </div>
    </div>
    <p style="text-align:center;margin:20px 0 0;font-size:12.5px;line-height:1.6;color:#86868b;">
      You&rsquo;re getting this because you gave ${esc(businessName)} your email address.<br>
      <a href="${esc(unsubUrl)}" style="color:#86868b;">Unsubscribe</a>
      &nbsp;&middot;&nbsp; Sent by ${esc(businessName)}
    </p>
  </div>
</body>
</html>`;
}

/* Returns { status, body } for the route to relay - it never throws for a
   caller mistake, only for genuine server trouble. */
async function sendCampaign(db, user, body) {
  const bad = (msg) => ({ status: 400, body: { error: msg } });

  // ---- who is sending, and are they allowed to ------------------------
  const { data: p, error: pErr } = await db.from('profiles')
    .select('business_name, public_email, active_plan, subscription_status, campaign_from, site_url')
    .eq('id', user.id).maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!p) return { status: 403, body: { error: 'No account found.' } };

  if (p.active_plan !== 'pro' && p.active_plan !== 'max') {
    return { status: 403, body: { error: 'Email marketing comes with Pro and Max.' } };
  }
  if (p.subscription_status !== 'active' && p.subscription_status !== 'trialing') {
    return { status: 403, body: { error: 'Your plan is not active right now.' } };
  }
  if (!p.campaign_from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.campaign_from)) {
    return { status: 409, body: { error: 'Your sending address is still being set up. It usually takes a day or two - we’ll let you know.' } };
  }

  // ---- what they wrote ------------------------------------------------
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();
  const linkUrl = String(body.linkUrl || '').trim();
  const linkText = String(body.linkText || '').trim().slice(0, 40);
  const imageUrl = String(body.imageUrl || '').trim();

  if (!subject || subject.length > 120) return bad('Give it a subject (up to 120 characters).');
  if (!message || message.length > 2500) return bad('Write the message (up to 2,500 characters).');
  if (linkUrl && !/^https?:\/\/[^\s]+$/i.test(linkUrl)) return bad('The link needs to be a full address, like https://…');
  if (linkUrl.length > 300) return bad('That link is too long.');

  /* Only an image they uploaded themselves: their own folder in our public
     campaign bucket. Anything else could make their email carry someone
     else's content from an address we vouch for. */
  if (imageUrl) {
    const prefix = `${process.env.SUPABASE_URL}/storage/v1/object/public/campaign-images/${user.id}/`;
    if (!imageUrl.startsWith(prefix)) return bad('That image is not one of yours - upload it again.');
  }

  // ---- not twice in a row ---------------------------------------------
  const { data: last, error: lastErr } = await db.from('campaigns')
    .select('sent_at').eq('user_id', user.id)
    .order('sent_at', { ascending: false }).limit(1);
  if (lastErr) throw new Error(lastErr.message);
  if (last && last.length && Date.now() - new Date(last[0].sent_at).getTime() < GAP_MINUTES * 60000) {
    return bad('Your last send was a moment ago - give it ' + GAP_MINUTES + ' minutes between sends.');
  }

  // ---- who it goes to -------------------------------------------------
  const { data: aud, error: audErr } = await db.from('audience')
    .select('id, email, name')
    .eq('user_id', user.id).is('unsubscribed_at', null)
    .limit(MAX_RECIPIENTS + 1);
  if (audErr) throw new Error(audErr.message);
  if (!aud || !aud.length) return bad('Add some customers to your list first.');
  if (aud.length > MAX_RECIPIENTS) {
    return bad('Lists over ' + MAX_RECIPIENTS + ' need a word with us first - email us and we’ll run it for you.');
  }

  const businessName = (p.business_name || 'Your business').replace(/[<>"]/g, '').slice(0, 80);
  const from = `${businessName} <${p.campaign_from}>`;
  const replyTo = p.public_email || user.email;

  /* The row goes in before the send: it is the anchor the gap check reads,
     so two clicks a second apart cannot both get past it. If nothing at all
     goes out, it is removed again so a retry is not locked out. */
  const { data: row, error: insErr } = await db.from('campaigns').insert({
    user_id: user.id, subject, body: message,
    image_url: imageUrl || null, link_url: linkUrl || null,
    link_text: linkUrl ? (linkText || null) : null
  }).select().single();
  if (insErr) throw new Error(insErr.message);
  const campaign = Array.isArray(row) ? row[0] : row;

  const site = ourSiteUrl();
  const messages = aud.map((r) => {
    const token = tokenFor(r.id, 'list');
    const unsubUrl = `${site}/api/unsubscribe?u=${encodeURIComponent(token || '')}`;
    return {
      to: r.email,
      from, replyTo, subject,
      text: message + '\n\n'
          + (linkUrl ? linkUrl + '\n\n' : '')
          + `You're getting this because you gave ${businessName} your email address.\n`
          + `Unsubscribe: ${unsubUrl}`,
      html: campaignHtml({ businessName, message, imageUrl, linkUrl, linkText, unsubUrl }),
      headers: unsubscribeHeaders(r.id, 'list')
    };
  });

  const result = await sendBatch(messages);

  if (!result.sent) {
    await db.from('campaigns').delete().eq('id', campaign.id);
    return { status: 502, body: { error: 'We could not send that just now. Nothing went out - try again shortly.' } };
  }

  const { error: countErr } = await db.from('campaigns')
    .update({ recipient_count: result.sent }).eq('id', campaign.id);
  if (countErr) console.error('campaign: count update failed:', countErr.message);

  await notifyAdmin(db, 'Campaign sent',
    businessName + ' emailed ' + result.sent + ' customer' + (result.sent === 1 ? '' : 's')
    + ': “' + subject.slice(0, 80) + '”');

  return { status: 200, body: { ok: true, sent: result.sent, failed: result.failed } };
}

module.exports = { sendCampaign };
