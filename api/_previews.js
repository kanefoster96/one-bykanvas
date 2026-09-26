/* Sending somebody their finished example - the admin page's Send button
 * and the MCP lead_send_preview tool both come here. Everything in the
 * email comes from the lead row; the only thing supplied is where the
 * example lives. Returns { sentAt } or { error, status }.
 *
 * The email is the offer. In order: the page itself, the web address that
 * could be theirs, what the page could become once they say yes, and the
 * way in: Starter, the page live with a contact form and click to call,
 * £25, no setup fee. Business sits beside it for £25 more.
 */
const { ourSiteUrl } = require('./_env.js');
const { PREVIEW_OFFER } = require('./_plans.js');
const { sendEmail } = require('./_email.js');
const { html: emailHtml, standardFooter, esc } = require('./_email_template.js');
const { lookup: domainLookup, candidates: domainCandidates } = require('./domains.js');

/* At most this many registry lookups when finding them an address. */
const SUGGEST_BUDGET = 6;

/* The address that goes in the email. One they asked for is re-checked;
   otherwise the closest free one to their business name is found now and
   kept on the lead, so a resend, the admin and the MCP all see the same
   address they were offered. Returns { domain, state } with state one of
   free | taken | unknown, or null when there is nothing to say. */
async function addressFor(db, lead) {
  if (lead.requested_domain) {
    let state = 'unknown';
    try { state = await domainLookup(lead.requested_domain); }
    catch (e) { console.error('previews: domain re-check failed:', e && e.message); }
    return { domain: lead.requested_domain, state };
  }

  let list = [];
  try { list = domainCandidates(lead.business).slice(0, SUGGEST_BUDGET); }
  catch (e) { return null; }
  if (!list.length) return null;

  let states = [];
  try { states = await Promise.all(list.map(domainLookup)); }
  catch (e) {
    console.error('previews: domain suggest failed:', e && e.message);
    return null;
  }
  const i = states.indexOf('free');
  if (i === -1) return null;                 /* all taken, or nothing reachable */

  const domain = list[i];
  const { error } = await db.from('leads').update({ requested_domain: domain }).eq('id', lead.id);
  if (error) console.error('previews: could not keep suggested domain:', error.message);
  return { domain, state: 'free' };
}

/* What the page could do once they join. "Could", not "will": some of it
   is in the build from the start and the rest they ask for, any time. */
const COULD = [
  'Take bookings, deposits and card payments, straight to your bank',
  'Show your services, prices and opening hours, and let you change them yourself',
  'Ask every customer for a Google review, automatically, a day after the job',
  'A page for every service you offer and every town you cover',
  'Live chat and an enquiry form that reach your phone',
  'Keep every customer’s bookings, payments and notes against their name',
  'Business email at your own address, and a business number that texts back missed calls'
];

/* Into the wizard with the plan picked, the code applied, the address
   selected and their details filled in (the lead id, which api/lead-prefill
   answers for). */
function joinHref(site, plan, domain, leadId) {
  const q = ['plan=' + plan, 'offer=' + encodeURIComponent(PREVIEW_OFFER.code)];
  if (domain) q.push('domain=' + encodeURIComponent(domain));
  if (leadId) q.push('lead=' + encodeURIComponent(leadId));
  return `${site}/get-started.html?${q.join('&')}`;
}

/* The thing to press: Starter, the page live for £25. Business beside it
   for £25 more, for the person who already knows they want bookings. Max
   is offered after they have said yes, in the wizard. */
function planCards(site, domain, leadId) {
  const live = domain ? 'Live on ' + esc(domain) + ' today.' : 'Live on your own address today.';
  return {
    title: 'Make it your site',
    intro: 'This page, designed and hosted for you, £25 a month. No setup fee. Cancel any month.',
    cards: [{
      name: 'Starter', price: '£25', tag: 'The site', featured: true,
      text: live + ' Customers find you, call you and message you.',
      items: [
        'Contact form and click to call',
        'Found on Google in your town',
        'Your web address, hosting and security included',
        'A change every month, made by me'
      ],
      ctaText: 'Make it my site — £25 a month', ctaHref: joinHref(site, 'starter', domain, leadId)
    }, {
      name: 'Business', price: '£50', tag: '+£25: get booked',
      text: 'Everything in Starter, plus the features that take the work off your phone.',
      items: [
        'Bookings, payments and live chat',
        'Reviews asked for automatically after every job',
        'Unlimited changes, made by me within 48 hours',
        'Your three features built within 14 days, or your next month is free'
      ],
      ctaText: 'Choose Business — £50 a month', ctaHref: joinHref(site, 'business', domain, leadId)
    }],
    note: '50% off your first month, on any plan. Or pay for the year: 2 months free and the Launch Boost, '
        + 'your first month spent getting you found on Google.<br>'
        + 'kanvasacademy.com and nellyandnova.co.uk run on this. Built by me, and you can message me.'
  };
}

/* What happens after the button, in three lines. Ticks: these will happen. */
const NEXT = {
  title: 'What happens when you say yes',
  ticks: true,
  items: [
    'Today: I register your web address and put this page live on it, with your contact form and click to call',
    'On Business: the three features you choose at signup, built within 14 days, or your next month is free',
    'Any time: changes are free, before and after you join'
  ]
};

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
  const address = await addressFor(db, lead);
  const claimable = address && address.state !== 'taken' ? address.domain : '';

  /* The address block. A free one is theirs to claim; one that has gone
     since they asked says so and points at choosing another. */
  let domainBlock = null;
  if (address) {
    const gone = address.state === 'taken';
    domainBlock = {
      label: gone ? 'The address you asked for' : 'Your web address',
      domain: address.domain,
      tag: address.state === 'free' ? { text: 'Available now' }
         : gone ? { text: 'Now taken', tone: 'warn' }
         : null,
      text: gone
        ? `Somebody registered it since you asked. Join and pick another at signup &mdash; there&rsquo;s always a good one, and I&rsquo;ll check it&rsquo;s free with you.`
        : `Claim it today: it&rsquo;s registered for you and included in your plan the moment you join &mdash; nothing to pay for it separately. Or choose your own at signup.`
    };
  }

  const from = !lead.handle ? 'what you sent me'
    : /^@/.test(lead.handle) ? 'your ' + esc(lead.handle)
    : 'the link you sent me';

  const sent = await sendEmail({
    to: lead.email,
    subject: `Your website is ready, ${String(lead.business).replace(/[\r\n]+/g, ' ')}`,
    html: emailHtml({
      preheader: 'Here it is - the page I designed for you, and what happens if you say yes.',
      heading: 'Your website is ready 🎁',
      lines: [
        `Here it is. I designed this for <strong>${esc(lead.business)}</strong> from ${from}, `
          + `so it should already look like you.`
      ],
      ctaText: '🎁 See your website',
      ctaHref: url,
      /* The address bar will not say their name, and an unexplained one
         looks like a mistake. Said under the button, where they are about
         to see it. */
      ctaNote: claimable
        ? `This opens on a temporary address. ${esc(claimable)} is yours when you join.`
        : 'This opens on a temporary address while it&rsquo;s an example.',
      domain: domainBlock,
      could: [
        {
          title: 'Right now it&rsquo;s a shell. Here&rsquo;s what it could do.',
          intro: 'What you&rsquo;re looking at is one page: the look and the feel. Once you say yes, I build the rest around it. Some of this goes in from the start; the rest you ask for whenever you want it, and I add it, included.',
          items: COULD
        },
        NEXT
      ],
      plans: planCards(site, claimable, lead.id),
      offerLast: true,
      offer: {
        code: PREVIEW_OFFER.code,
        href: `${site}/plans.html?offer=${encodeURIComponent(PREVIEW_OFFER.code)}`,
        text: '<strong>50% off your first month, on any plan.</strong><br>'
            + 'Applied when you join. Or pay for the year: 2 months free and the Launch Boost.',
        note: 'Nothing to copy &mdash; it is already on the bill when you pay.'
      },
      closing: 'Anything you&rsquo;d change on the page, just reply and say so. Changes are free, before and after you join. &mdash; Kane',
      footer: 'You&rsquo;re getting this because you asked me for a free example at '
            + 'kanvas.one. No account has been created and nothing has been charged.',
      footerLinks: standardFooter(site)
    }),
    text: `Here it is - the page I designed for ${lead.business}.\n\n`
        + `${url}\n\n`
        + (claimable
            ? `This opens on a temporary address. ${claimable} is yours when you join`
              + (address.state === 'free' ? ' - it is available now' : '') + `. Claim it today, `
              + `or choose your own at signup. Either way it is included in your plan.\n\n`
            : `This opens on a temporary address while it's an example.\n\n`)
        + (address && address.state === 'taken'
            ? `${address.domain} has been registered by somebody else since you asked. `
              + `Join and pick another at signup.\n\n`
            : '')
        + `Right now it's a shell: one page, the look and the feel. Once you say yes, `
        + `here's what it could do. Some goes in from the start; the rest you ask for, any time, included:\n`
        + COULD.map((t) => '- ' + t).join('\n') + '\n\n'
        + `What happens when you say yes:\n`
        + NEXT.items.map((t) => '- ' + t).join('\n') + '\n\n'
        + `Make it your site. Starter, GBP 25 a month: this page live on your own address today, `
        + `with a contact form and click to call, found on Google, a change a month made by me. `
        + `No setup fee. Cancel any month.\n`
        + `${joinHref(site, 'starter', claimable, lead.id)}\n\n`
        + `Want bookings, payments and live chat? Business is GBP 25 more, with unlimited changes `
        + `and your three features built within 14 days or your next month is free.\n`
        + `${joinHref(site, 'business', claimable, lead.id)}\n\n`
        + `kanvasacademy.com and nellyandnova.co.uk run on this. Built by me, and you can message me.\n\n`
        + `50% off your first month, on any plan, applied when you join. Or pay for the year: `
        + `2 months free and the Launch Boost, your first month spent getting you found on Google.\n`
        + `${site}/plans.html?offer=${encodeURIComponent(PREVIEW_OFFER.code)}\n\n`
        + `Anything you'd change on the page, just reply and say so. Changes are free, `
        + `before and after you join.\n\nKane\n`
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
