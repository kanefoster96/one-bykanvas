/* Sending somebody their finished example - the admin page's Send button
 * and the MCP lead_send_preview tool both come here. Everything in the
 * email comes from the lead row; the only thing supplied is where the
 * example lives. Returns { sentAt } or { error, status }. */
const { ourSiteUrl } = require('./_env.js');
const { PREVIEW_OFFER } = require('./_plans.js');
const { sendEmail } = require('./_email.js');
const { html: emailHtml, standardFooter, esc } = require('./_email_template.js');
const { lookup: domainLookup } = require('./domains.js');

async function sendLeadPreview(db, id, url, opts) {
  const again = !!(opts && opts.again);
  const fail = (status, error) => ({ status, error });
  if (!/^https:\/\/[^\s]+\.[^\s]{2,}/i.test(url)) {
    return fail(400, 'That needs to be a full https:// address.');
  }

  const { data: lead, error: leadErr } = await db
    .from('leads').select('*').eq('id', id).maybeSingle();
  if (leadErr) throw new Error(leadErr.message);
  if (!lead) return fail(404, 'That request is gone.');

  /* Sending twice reads as not knowing what you are doing, so it takes a
     deliberate second ask rather than a second click. */
  if (lead.preview_sent_at && !again) {
    return fail(409, 'This one was already sent ' + new Date(lead.preview_sent_at).toDateString()
           + '. Send it again only if you meant to.');
  }

  const site = ourSiteUrl();
  const facts = [{ label: 'Business', value: lead.business }];

  /* Asked again, not assumed. They picked this days ago and nothing was
     reserved, so "still available" has to be checked at the moment we say
     it - and when the registries cannot be reached, it says nothing at all
     rather than guessing in either direction. */
  let domainState = 'unknown';
  if (lead.requested_domain) {
    try {
      domainState = await domainLookup(lead.requested_domain);
    } catch (e) {
      console.error('admin: domain re-check failed:', e && e.message);
    }
    facts.push({
      label: 'Address',
      value: lead.requested_domain,
      tag: domainState === 'free'  ? { text: 'Still available' }
         : domainState === 'taken' ? { text: 'Now taken', tone: 'warn' }
         : null
    });
  }

  const perks = [
    'Nothing technical to set up. We put it live for you.',
    'No time lost. We build and look after it while you get on with the job.',
    'If anything breaks, we fix it. Included, and it never costs you a point.',
    'Your web address and hosting are in the monthly price, with nothing else to buy.'
  ];

  const sent = await sendEmail({
    to: lead.email,
    subject: `Your website is ready to look at, ${String(lead.business).replace(/[\r\n]+/g, ' ')}`,
    html: emailHtml({
      preheader: 'Here it is - the free one-page example you asked for.',
      heading: 'Your website is ready 🎁',
      lines: [
        `Here it is. We designed this for <strong>${esc(lead.business)}</strong> from `
          + `${lead.handle ? 'your ' + esc(lead.handle) : 'what you sent us'}, so it should `
          + `already look like you.`
      ].concat(domainState === 'taken'
        ? [`One thing: <strong>${esc(lead.requested_domain)}</strong> has been `
           + `registered by somebody else since you asked. Join and we&rsquo;ll find `
           + `you a good one that is free.`]
        : []),
      details: facts,
      ctaText: '🎁 See your website',
      ctaHref: url,
      /* The address bar will not say their name, and an unexplained one
         looks like a mistake. Said under the button, where they are about
         to see it. */
      ctaNote: lead.requested_domain && domainState !== 'taken'
        ? `This opens on a temporary address. ${esc(lead.requested_domain)} is yours when you join.`
        : 'This opens on a temporary address while it&rsquo;s an example.',
      offer: {
        code: PREVIEW_OFFER.code,
        href: `${site}/plans.html?offer=${encodeURIComponent(PREVIEW_OFFER.code)}`,
        text: '<strong>Want it online, properly?</strong><br>'
            + 'Tap the code for 50% off your first month.',
        note: 'It comes with you &mdash; nothing to copy, and it is already '
            + 'on the bill when you pay. Works on any plan.'
      },
      perks: perks,
      footer: 'You&rsquo;re getting this because you asked us for a free example at '
            + 'kanvas.one. No account has been created and nothing has been charged.',
      footerLinks: standardFooter(site)
    }),
    text: `Here it is - the free example we made for ${lead.business}.\n\n`
        + `${url}\n\n`
        + (lead.requested_domain && domainState !== 'taken'
            ? `This opens on a temporary address. ${lead.requested_domain} is yours `
              + `when you join${domainState === 'free' ? ' - it is still available' : ''}.\n\n`
            : `This opens on a temporary address while it's an example.\n\n`)
        + (domainState === 'taken'
            ? `${lead.requested_domain} has been registered by somebody else since you `
              + `asked. Join and we'll find you a good one that is free.\n\n`
            : '')
        + `Want it online properly? 50% off your first month with `
        + `${PREVIEW_OFFER.code}, on any plan:\n`
        + `${site}/plans.html?offer=${encodeURIComponent(PREVIEW_OFFER.code)}\n\n`
        + perks.map((t) => '- ' + t).join('\n') + '\n\n'
        + `See the plans: ${site}/plans.html\n`
  });

  /* sendEmail answers 'sent', 'skipped' or 'failed', and only the first
     may mark this done: stamping a failed send would show "Sent" in the
     queue while the customer waits for an email that never went. */
  if (sent !== 'sent') {
    console.error('admin: preview email for %s did not send: %s', id, sent);
    return fail(502, 'The email did not send (' + sent + '). Nothing was marked, so you can try again.');
  }

  const sentAt = new Date().toISOString();
  const { error: markErr } = await db.from('leads')
    .update({ preview_url: url, preview_sent_at: sentAt })
    .eq('id', id);
  if (markErr) throw new Error(markErr.message);

  console.log('admin: preview sent for %s', id);
  return { sentAt };
}

module.exports = { sendLeadPreview };
