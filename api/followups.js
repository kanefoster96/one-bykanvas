/* Follow-ups for free-example leads, anchored to the moment the example was
 * actually sent (leads.preview_sent_at) - not to when they filled the form.
 *
 * Vercel Cron calls this once a day (vercel.json). Two emails, ever:
 *
 *   day 3   "What did you think?"  - asks for an honest reaction (changes
 *           are free), restates the offer.
 *   day 10  "Before we tidy up"    - example pages don't stay online
 *           forever; last email, says so, offer one final time.
 *
 * Each send is stamped on the lead row (followup1_sent_at / followup2_sent_at
 * - migration 0026), so a rerun never double-sends. A lead who has already
 * joined (their email has an account) is skipped, and so is anything stale:
 * when this first deploys, examples sent long ago don't suddenly get chased.
 * Deleting a lead in admin stops its follow-ups - the row is the schedule.
 *
 * Guarded by CRON_SECRET: Vercel sends it as a bearer token automatically
 * once the environment variable exists, and nothing runs without it.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv, ourSiteUrl } = require('./_env.js');
const { PREVIEW_OFFER } = require('./_plans.js');
const { sendEmail } = require('./_email.js');
const { html: emailHtml, esc, standardFooter } = require('./_email_template.js');
const { notifyAdmin } = require('./_notify.js');

const DAY = 24 * 60 * 60 * 1000;
/* Send windows: due after the floor, skipped for good after the ceiling.
   The ceilings are what keep the first deploy (and any cron outage) from
   chasing months-old leads. */
const F1_AFTER = 3 * DAY;
const F1_UNTIL = 9 * DAY;
const F2_AFTER = 10 * DAY;
const F2_UNTIL = 30 * DAY;
/* Win-back: one email, a month after a plan ends, while the six-month
   restart window (terms §8.4) is still comfortably open. */
const WB_AFTER = 30 * DAY;
const WB_UNTIL = 60 * DAY;

function offerBox(site) {
  return {
    code: PREVIEW_OFFER.code,
    href: `${site}/plans.html?offer=${encodeURIComponent(PREVIEW_OFFER.code)}`,
    text: '<strong>Ready to put it live?</strong><br>'
        + 'Tap the code for 50% off your first three months.',
    note: 'It comes with you &mdash; nothing to copy, and it is already '
        + 'on the bill when you pay. Works on any plan.'
  };
}

function whatDidYouThink(lead, site) {
  return {
    to: lead.email,
    subject: `What did you think, ${String(lead.business).replace(/[\r\n]+/g, ' ')}?`,
    html: emailHtml({
      preheader: 'Be honest - did the example look like you?',
      heading: 'What did you think?',
      lines: [
        `A few days ago we sent the free example page we designed for `
          + `<strong>${esc(lead.business)}</strong>.`,
        'Be honest &mdash; did it look like you? If something is off, just reply '
          + 'and say so. Changes are free, and we&rsquo;d rather get it right than guess.',
        'And if you liked it, it can be your real site this week: live on your own '
          + 'web address, looked after for you, from &pound;50 a month with no setup fees.'
      ],
      offer: offerBox(site),
      ctaText: 'Make it my real site',
      ctaHref: `${site}/get-started.html`,
      footer: 'You&rsquo;re getting this because you asked for a free example at '
            + 'kanvas.one. If we don&rsquo;t hear from you, one more email follows '
            + 'and then we&rsquo;ll leave you be.',
      footerLinks: standardFooter(site)
    }),
    text: `A few days ago we sent the free example page we designed for ${lead.business}.\n\n`
        + `Be honest - did it look like you? If something is off, just reply and say so. `
        + `Changes are free, and we'd rather get it right than guess.\n\n`
        + `And if you liked it, it can be your real site this week: live on your own web `
        + `address, looked after for you, from GBP 50 a month with no setup fees.\n\n`
        + `50% off your first three months with ${PREVIEW_OFFER.code}, on any plan:\n`
        + `${site}/plans.html?offer=${PREVIEW_OFFER.code}\n\n`
        + `Get started: ${site}/get-started.html\n`
  };
}

function beforeWeTidyUp(lead, site) {
  return {
    to: lead.email,
    subject: `Last one - shall we keep your example, ${String(lead.business).replace(/[\r\n]+/g, ' ')}?`,
    html: emailHtml({
      preheader: 'Example pages don’t stay online forever - this is the last email about yours.',
      heading: 'Before we tidy up&hellip;',
      lines: [
        `The free example we made for <strong>${esc(lead.business)}</strong> is still up `
          + `&mdash; but example pages don&rsquo;t stay online forever. We clear them out `
          + `to make room for new ones.`,
        'If you want it to become your real site, now&rsquo;s the moment: join and we '
          + 'put it live on your own web address, usually within days, and keep building '
          + 'on it from there. Anything you&rsquo;d change, we change &mdash; that&rsquo;s '
          + 'included.',
        'Not for you? No hard feelings &mdash; this is the last email about it, and '
          + 'nothing else will follow.'
      ],
      offer: offerBox(site),
      ctaText: 'Keep my site',
      ctaHref: `${site}/get-started.html`,
      footer: 'You&rsquo;re getting this because you asked for a free example at '
            + 'kanvas.one. This is the last email about it.',
      footerLinks: standardFooter(site)
    }),
    text: `The free example we made for ${lead.business} is still up - but example pages `
        + `don't stay online forever. We clear them out to make room for new ones.\n\n`
        + `If you want it to become your real site, now's the moment: join and we put it `
        + `live on your own web address, usually within days, and keep building on it from `
        + `there. Anything you'd change, we change - that's included.\n\n`
        + `50% off your first three months with ${PREVIEW_OFFER.code}, on any plan:\n`
        + `${site}/plans.html?offer=${PREVIEW_OFFER.code}\n\n`
        + `Get started: ${site}/get-started.html\n\n`
        + `Not for you? No hard feelings - this is the last email about it, and nothing `
        + `else will follow.\n`
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!CRON_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('followups: missing environment variables:',
      missingEnv(['CRON_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', ') || '(none named)');
    return res.status(500).json({ error: 'Not configured.' });
  }
  if ((req.headers.authorization || '') !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Who is this?' });
  }

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const site = ourSiteUrl();
    const now = Date.now();

    const { data: leads, error } = await db.from('leads')
      .select('id, business, email, preview_sent_at, followup1_sent_at, followup2_sent_at')
      .eq('source', 'free-preview')
      .not('preview_sent_at', 'is', null)
      .is('followup2_sent_at', null)
      .order('preview_sent_at', { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);

    /* Already a customer? Then the sequence is over - the welcome email took
       it from here. Matched by email against auth users; at this scale one
       page covers everyone. */
    const registered = new Set();
    try {
      const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      ((users && users.users) || []).forEach((u) => {
        if (u.email) registered.add(u.email.toLowerCase());
      });
    } catch (e) {
      console.error('followups: user list failed, converting-lead check skipped:', e && e.message);
    }

    let sentF1 = 0, sentF2 = 0;
    for (const lead of leads || []) {
      if (!lead.email) continue;
      if (registered.has(String(lead.email).toLowerCase())) continue;

      const age = now - new Date(lead.preview_sent_at).getTime();
      let message = null, stamp = null;

      if (!lead.followup1_sent_at && age >= F1_AFTER && age <= F1_UNTIL) {
        message = whatDidYouThink(lead, site);
        stamp = 'followup1_sent_at';
      } else if (lead.followup1_sent_at && age >= F2_AFTER && age <= F2_UNTIL) {
        message = beforeWeTidyUp(lead, site);
        stamp = 'followup2_sent_at';
      }
      if (!message) continue;

      /* Stamp first, then send: a crash between the two loses one email,
         the other order can send the same person the same email daily. */
      const patch = {};
      patch[stamp] = new Date().toISOString();
      const { error: stampErr } = await db.from('leads').update(patch).eq('id', lead.id);
      if (stampErr) {
        console.error('followups: stamp failed for %s:', lead.id, stampErr.message);
        continue;
      }

      const outcome = await sendEmail(message);
      console.log('followups: %s to %s -> %s', stamp, lead.email, outcome);
      if (outcome === 'sent') {
        if (stamp === 'followup1_sent_at') sentF1++;
        else sentF2++;
      }
    }

    /* ---- win-back: cancelled customers, one nudge ever ---------------- */
    let sentWb = 0;
    const { data: gone, error: wbErr } = await db.from('profiles')
      .select('id, business_name, canceled_at, winback_sent_at, subscription_status')
      .eq('subscription_status', 'canceled')
      .not('canceled_at', 'is', null)
      .is('winback_sent_at', null)
      .limit(100);
    if (wbErr) console.error('followups: winback query failed:', wbErr.message);

    for (const p of gone || []) {
      const age = now - new Date(p.canceled_at).getTime();
      if (age < WB_AFTER || age > WB_UNTIL) continue;

      const { error: wbStamp } = await db.from('profiles')
        .update({ winback_sent_at: new Date().toISOString() })
        .eq('id', p.id).is('winback_sent_at', null);
      if (wbStamp) { console.error('followups: winback stamp failed:', wbStamp.message); continue; }

      const { data: who } = await db.auth.admin.getUserById(p.id);
      const email = who && who.user && who.user.email;
      if (!email) continue;

      const name = p.business_name || 'your business';
      const outcome = await sendEmail({
        to: email,
        subject: 'Your site is exactly as you left it',
        text: `When you left, we kept everything: the site we built for ${name}, `
            + `your features, your content. It all restarts exactly where it stopped - `
            + `usually back online within days.

`
            + `Restart from your account: ${site}/account.html

`
            + `We hold a build for six months after a plan ends, then it is deleted `
            + `for good. This is the only nudge we'll send - if now isn't the time, `
            + `no hard feelings.
`,
        html: emailHtml({
          preheader: 'Everything is kept - restart where you left off.',
          heading: 'Your site is waiting',
          lines: [
            `When you left, we kept everything: the site we built for <strong>${esc(name)}</strong>, `
              + `your features, your content. Restart and it picks up exactly where it stopped `
              + `&mdash; usually back online within days.`,
            'We hold a build for six months after a plan ends, then it is deleted for good.',
            'This is the only nudge we&rsquo;ll send &mdash; if now isn&rsquo;t the time, no hard feelings.'
          ],
          ctaText: 'Restart my site',
          ctaHref: `${site}/account.html`,
          footer: 'You&rsquo;re getting this because your Kanvas One plan ended about a month ago. No more emails follow.',
          footerLinks: standardFooter(site)
        })
      });
      console.log('followups: winback to %s -> %s', email, outcome);
      if (outcome === 'sent') sentWb++;
    }

    if (sentF1 + sentF2 + sentWb > 0) {
      await notifyAdmin(db, 'Follow-ups sent',
        `${sentF1} "what did you think", ${sentF2} final follow-ups, and ${sentWb} win-backs went out.`);
    }

    return res.status(200).json({ ok: true, followup1: sentF1, followup2: sentF2, winback: sentWb });
  } catch (err) {
    console.error('followups:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};
