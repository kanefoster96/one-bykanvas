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
const { startHref } = require('./plan.js');

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
/* The month-in note: a month after a plan goes live, one email about the
   plan above theirs. Said once, and not at all if the month is long gone. */
const PN_AFTER = 30 * DAY;
const PN_UNTIL = 45 * DAY;
/* The free growth plan (api/plan.js): two follow-ups after the plan itself,
   anchored to when they asked. */
const G1_AFTER = 2 * DAY;
const G1_UNTIL = 6 * DAY;
const G2_AFTER = 6 * DAY;
const G2_UNTIL = 20 * DAY;

/* Informative, not a pitch: what the next plan does and why a business
   might want it, in case any of it is useful. One email, ever. */
function planNote(plan, name, site) {
  const who = name ? esc(name) : 'your business';
  if (plan === 'starter') {
    return {
      subject: 'A month in: what the site could do next',
      html: emailHtml({
        preheader: 'No ask here. Just what the next plan does, in case any of it is useful.',
        heading: 'A month in',
        lines: [
          `The site for <strong>${who}` + '</strong> has been live a month now. No ask here, just what the plan above yours does, in case any of it is useful.',
          'Business is the same site with the work that comes in from it handled by the site instead of your phone:'
        ],
        perks: [
          '<strong>Bookings.</strong> Customers pick a slot themselves, so the back-and-forth texts stop.',
          '<strong>Deposits and payments.</strong> Taken at booking, which is what cuts no-shows.',
          '<strong>Live chat.</strong> Questions answered from your phone, and kept with the customer.',
          '<strong>Reviews asked for automatically.</strong> A message after each job asking for a Google review. Reviews are what move you up the map.',
          '<strong>Priority changes.</strong> Anything you want changed, done within 48 hours.'
        ],
        ctaText: 'See what Business does',
        ctaHref: `${site}/plans.html#business`,
        ctaNote: 'It is &pound;50 a month. If you ever want it, switch from your account and your site comes with you. If not, nothing changes.',
        footer: 'You&rsquo;re getting this because your Kanvas One plan went live about a month ago. It is the only email like it.',
        footerLinks: standardFooter(site)
      }),
      text: `The site for ${name || 'your business'} has been live a month now. No ask here, just what `
          + `the plan above yours does, in case any of it is useful.\n\n`
          + `Business is the same site with the work that comes in from it handled by the site instead of your phone:\n`
          + `- Bookings: customers pick a slot themselves, so the back-and-forth texts stop.\n`
          + `- Deposits and payments: taken at booking, which is what cuts no-shows.\n`
          + `- Live chat: questions answered from your phone, and kept with the customer.\n`
          + `- Reviews asked for automatically: a message after each job asking for a Google review.\n`
          + `- Priority changes, done within 48 hours.\n\n`
          + `It is GBP 50 a month. If you ever want it, switch from your account and your site comes with you. If not, nothing changes.\n`
          + `${site}/plans.html#business\n`
    };
  }
  return {
    subject: 'A month in: getting more people to find you',
    html: emailHtml({
      preheader: 'No ask here. Just what One does, in case any of it is useful.',
      heading: 'A month in',
      lines: [
        `The site for <strong>${who}` + '</strong> has been live a month now. No ask here, just what the plan above yours does, in case any of it is useful.',
        'One is your site plus us going and getting customers for it:'
      ],
      perks: [
        '<strong>Your Facebook and Instagram ads, run for you.</strong> You set the budget and change it whenever you like. We write the offer, build the ad and the form, and send you a note each month saying what it cost and what came in.',
        '<strong>Your Google ranking worked on every month.</strong> The words on your pages, what Google and AI assistants read first, the questions customers actually type.',
        '<strong>Reviews, referrals and upsells asked for automatically</strong>, and the follow-up emails written and sent for you.',
        '<strong>Business email at your own address.</strong> Built per business type: Trades, Clubs, Salon, or yours.'
      ],
      ctaText: 'See what One does',
      ctaHref: `${site}/plans.html#max`,
      ctaNote: 'It is &pound;250 a month, no setup fee. If you ever want it, switch from your account. If not, nothing changes.',
      footer: 'You&rsquo;re getting this because your Kanvas One plan went live about a month ago. It is the only email like it.',
      footerLinks: standardFooter(site)
    }),
    text: `The site for ${name || 'your business'} has been live a month now. No ask here, just what `
        + `the plan above yours does, in case any of it is useful.\n\n`
        + `One is your site plus us going and getting customers for it:\n`
        + `- Your Facebook and Instagram ads, run for you. You set the budget and change it whenever you like.\n`
        + `- Your Google ranking worked on every month.\n`
        + `- Reviews, referrals and upsells asked for automatically, and the follow-up emails written and sent for you.\n`
        + `- Business email at your own address. Built per business type: Trades, Clubs, Salon, or yours.\n\n`
        + `It is GBP 250 a month, no setup fee. If you ever want it, switch from your account. If not, nothing changes.\n`
        + `${site}/plans.html#max\n`
  };
}

function offerBox(site) {
  return {
    code: PREVIEW_OFFER.code,
    href: `${site}/plans.html?offer=${encodeURIComponent(PREVIEW_OFFER.code)}`,
    text: '<strong>Want bookings and payments too?</strong><br>'
        + 'Tap the code for 50% off your first month of Business.',
    note: 'It comes with you &mdash; nothing to copy, and it is already '
        + 'on the bill when you pay. Works on Business and One. Starter is &pound;9.99 a month from day one.'
  };
}

/* Into the wizard with their details, address and the code already in. */
function joinHref(site, lead, plan) {
  const q = ['plan=' + plan, 'offer=' + encodeURIComponent(PREVIEW_OFFER.code), 'lead=' + encodeURIComponent(lead.id)];
  if (lead.requested_domain) q.push('domain=' + encodeURIComponent(lead.requested_domain));
  return `${site}/get-started.html?${q.join('&')}`;
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
        'And if you liked it, it can be your real site today: live on your own '
          + 'web address with a contact form and click to call, looked after for you. '
          + '<strong>&pound;9.99 a month</strong>, no setup fee, cancel any month.'
      ],
      offer: offerBox(site),
      ctaText: 'Put it live — £9.99 a month',
      ctaHref: joinHref(site, lead, 'starter'),
      footer: 'You&rsquo;re getting this because you asked for a free example at '
            + 'kanvas.one. If we don&rsquo;t hear from you, one more email follows '
            + 'and then we&rsquo;ll leave you be.',
      footerLinks: standardFooter(site)
    }),
    text: `A few days ago we sent the free example page we designed for ${lead.business}.\n\n`
        + `Be honest - did it look like you? If something is off, just reply and say so. `
        + `Changes are free, and we'd rather get it right than guess.\n\n`
        + `And if you liked it, it can be your real site today: live on your own web `
        + `address with a contact form and click to call, looked after for you. GBP 9.99 a month, `
        + `no setup fee, cancel any month.\n`
        + `${joinHref(site, lead, 'starter')}\n\n`
        + `Want bookings and payments too? 50% off your first month of Business with ${PREVIEW_OFFER.code}:\n`
        + `${site}/plans.html?offer=${PREVIEW_OFFER.code}\n`
  };
}

/* The last email: the page they saw, live, for £9.99 a month, with the year's
   bonus named for the person who was waiting for a reason. */
function lastOne(lead, site) {
  return {
    to: lead.email,
    subject: `Last one from us, ${String(lead.business).replace(/[\r\n]+/g, ' ')}`,
    html: emailHtml({
      preheader: 'The page you saw, live on your own address, for £9.99 a month.',
      heading: 'Last one from us',
      lines: [
        `The free page we made for <strong>${esc(lead.business)}</strong> is still up.`,
        '<strong>Starter, &pound;9.99 a month</strong>: the page you saw, live on your own address '
          + 'within 24 hours, with a contact form and click to call, found on Google, and changes to '
          + 'your words and photos made by us. No setup fee.',
        'Pay for the year and it&rsquo;s 2 months free plus the Launch Boost: your first month '
          + 'spent getting you found on Google.',
        'Want bookings, payments and live chat? Business is &pound;50 a month, first month half price. Either way, this is '
          + 'the last email about it, and nothing else will follow.'
      ],
      offer: offerBox(site),
      ctaText: 'Put it live — £9.99 a month',
      ctaHref: joinHref(site, lead, 'starter'),
      ctaNote: `Or <a href="${esc(joinHref(site, lead, 'business'))}" style="color:inherit;">Business, &pound;50 a month, with bookings and payments</a>.`,
      footer: 'You&rsquo;re getting this because you asked for a free example at '
            + 'kanvas.one. This is the last email about it.',
      footerLinks: standardFooter(site)
    }),
    text: `The free page we made for ${lead.business} is still up.\n\n`
        + `Starter, GBP 9.99 a month: the page you saw, live on your own address within 24 hours, with a `
        + `contact form and click to call, found on Google, and changes to your words and photos made by us. No setup fee.\n`
        + `${joinHref(site, lead, 'starter')}\n\n`
        + `Pay for the year and it's 2 months free plus the Launch Boost: your first month spent `
        + `getting you found on Google.\n\n`
        + `Want bookings, payments and live chat? Business is GBP 50 a month, first month half price.\n`
        + `${joinHref(site, lead, 'business')}\n\n`
        + `Either way, this is the last email about it, and nothing else will follow.\n`
  };
}

/* ---- free growth plan follow-ups ------------------------------------- */
/* What they run, read back off the lead's summary line, only to pick the
   right One model for the start link. */
function planType(about) {
  return /Gym or personal|Yoga|Music|Something else/.test(String(about || '')) ? 'other' : 'kids';
}

/* Day 2. One: what actually happened in our academy. Business: any questions. */
function growthOne(lead, site) {
  const biz = String(lead.business).replace(/[\r\n]+/g, ' ');
  const type = planType(lead.about);
  if (lead.plan_interest === 'max') {
    const start = startHref(site, 'max', lead.business, type, lead.id);
    return {
      to: lead.email,
      subject: `What happened in our own club, ${biz}`,
      html: emailHtml({
        preheader: '£103 of ads, 21 trial bookings and £2,400 a year in new fees, in three weeks.',
        heading: 'What happened in our own club',
        lines: [
          `When we put together the plan for <strong>${esc(lead.business)}</strong>, the numbers came from somewhere real: our own dance and cheer academy, running on this system since 2017.`,
          'The first three weeks of ads, 21 September to 10 October:'
        ],
        details: [
          { label: 'Spent on ads', value: '£103' },
          { label: 'Trial bookings', value: '21' },
          { label: 'New members', value: '4' },
          { label: 'New fees', value: '£2,400 a year' }
        ],
        perks: [
          '<strong>Nobody chased anyone.</strong> Trials booked themselves, reminders went out, and the follow-up with the link to join did the rest.',
          '<strong>Those 4 members pay £50 every month</strong>: £2,400 a year from £103 of ads, still paying back long after the ads stopped.',
          '<strong>Months 2 to 4 of your ads are on us</strong>, so the first trials cost you nothing. Month 1 is spent building it all.'
        ],
        ctaText: 'Start One — £250 a month',
        ctaHref: start,
        ctaNote: 'Rather talk it through first? Reply and we&rsquo;ll find 10 minutes.',
        footer: 'You&rsquo;re getting this because you asked for a free growth plan at kanvas.one. One more email follows, then we leave you be.',
        footerLinks: standardFooter(site)
      }),
      text: `When we put together the plan for ${lead.business}, the numbers came from our own dance and cheer academy.\n\n`
        + 'First three weeks of ads: £103 spent, 21 trial bookings, 4 new members, £2,400 a year in new fees.\n\n'
        + 'Months 2 to 4 of your ads are on us.\n\n'
        + `Start One: ${start}\n\nRather talk first? Just reply.\n`
    };
  }
  const start = startHref(site, 'business', lead.business, type, lead.id);
  return {
    to: lead.email,
    subject: `Any questions about your plan, ${biz}?`,
    html: emailHtml({
      preheader: 'Business, £50 a month: your website, bookings and payments, run for you.',
      heading: 'Any questions?',
      lines: [
        `A couple of days ago we suggested <strong>Business</strong> for <strong>${esc(lead.business)}</strong>, rather than One.`,
        'If anything wasn&rsquo;t clear, or you want to know how it would work for your classes, just reply. A real person answers, usually the same working day.',
        '<strong>Business is &pound;50 a month</strong>, no setup fee: your website looked after for you, bookings and payments online, live chat, and changes made within 48 hours.'
      ],
      ctaText: 'Start with Business — £50 a month',
      ctaHref: start,
      footer: 'You&rsquo;re getting this because you asked for a free growth plan at kanvas.one. One more email follows, then we leave you be.',
      footerLinks: standardFooter(site)
    }),
    text: `A couple of days ago we suggested Business for ${lead.business}, rather than One.\n\n`
      + 'If anything wasn’t clear, just reply. A real person answers.\n\n'
      + `Business is £50 a month, no setup fee: ${start}\n`
  };
}

/* Day 6, the last one. One: the two questions everyone asks. Business: when
   you're ready to grow, here's what One adds. */
function growthTwo(lead, site) {
  const biz = String(lead.business).replace(/[\r\n]+/g, ' ');
  const type = planType(lead.about);
  if (lead.plan_interest === 'max') {
    const start = startHref(site, 'max', lead.business, type, lead.id);
    return {
      to: lead.email,
      subject: `The two questions everyone asks, ${biz}`,
      html: emailHtml({
        preheader: 'What it really costs, and what happens if it doesn’t work.',
        heading: 'The two questions everyone asks',
        lines: [
          '<strong>&ldquo;What does it really cost?&rdquo;</strong> &pound;250 a month for everything: website, member app, trial bookings, memberships, payments and the ads run for you. Month 1 we build it, and months 2 to 4 of ads are on us. From month 5, we keep paying for your ads and each new member from them pays their first month to us, or you fund your own ad budget.',
          '<strong>&ldquo;What if it doesn&rsquo;t work?&rdquo;</strong> There&rsquo;s no contract and no minimum. Cancel any time from your account.',
          'And when your classes are full, we pause the ads. You just pay the &pound;250.',
          'This is the last email about your plan. If now isn&rsquo;t the time, no hard feelings.'
        ],
        ctaText: 'Start One — £250 a month',
        ctaHref: start,
        ctaNote: 'Or reply with anything you&rsquo;d like to ask.',
        footer: 'You&rsquo;re getting this because you asked for a free growth plan at kanvas.one. This is the last email about it.',
        footerLinks: standardFooter(site)
      }),
      text: '"What does it really cost?" £250 a month for everything. Month 1 we build it, months 2 to 4 of ads are on us. From month 5: we keep paying for your ads and each new member from them pays their first month to us, or you fund your own.\n\n'
        + '"What if it doesn’t work?" No contract, no minimum. Cancel any time.\n\n'
        + 'When you’re full, we pause the ads.\n\n'
        + `Start One: ${start}\n\nThis is the last email about your plan.\n`
    };
  }
  const start = startHref(site, 'business', lead.business, type, lead.id);
  const max = startHref(site, 'max', lead.business, type, lead.id);
  return {
    to: lead.email,
    subject: `When you're ready to grow, ${biz}`,
    html: emailHtml({
      preheader: 'Business now, One when you open a new class. Last email from us.',
      heading: 'When you\u2019re ready to grow',
      lines: [
        `Business is still what we&rsquo;d suggest for <strong>${esc(lead.business)}</strong> today. When you open a new class or want more members, One adds:`
      ],
      perks: [
        '<strong>Facebook and Instagram ads, run for you</strong>, shown to families nearby for the classes with spaces. 3 months of ads included.',
        '<strong>Trial bookings, reminders and follow-ups</strong> that turn trials into members without you chasing.',
        '<strong>A member app</strong> for bookings, passes, messages and payments.'
      ],
      ctaText: 'Start with Business — £50 a month',
      ctaHref: start,
      ctaNote: `Switch to One from your account any month. <a href="${esc(max)}" style="color:inherit;">Or start on One now.</a>`,
      footer: 'You&rsquo;re getting this because you asked for a free growth plan at kanvas.one. This is the last email about it.',
      footerLinks: standardFooter(site)
    }),
    text: `Business is still what we'd suggest for ${lead.business} today. When you open a new class, One adds ads run for you, trial bookings and follow-ups, and a member app.\n\n`
      + `Start with Business: ${start}\nOr One: ${max}\n\nThis is the last email about your plan.\n`
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
      .select('id, business, email, requested_domain, preview_sent_at, followup1_sent_at, followup2_sent_at')
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
        message = lastOne(lead, site);
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

    /* ---- free growth plans: day 2 and day 6, from when they asked ----- */
    let sentG1 = 0, sentG2 = 0;
    const { data: plans, error: gErr } = await db.from('leads')
      .select('id, business, email, about, plan_interest, created_at, followup1_sent_at, followup2_sent_at')
      .eq('source', 'growth-plan')
      .is('followup2_sent_at', null)
      .gte('created_at', new Date(now - G2_UNTIL).toISOString())
      .order('created_at', { ascending: true })
      .limit(200);
    if (gErr) console.error('followups: growth-plan query failed:', gErr.message);

    for (const lead of plans || []) {
      if (!lead.email) continue;
      if (registered.has(String(lead.email).toLowerCase())) continue;
      const age = now - new Date(lead.created_at).getTime();
      let message = null, stamp = null;
      if (!lead.followup1_sent_at && age >= G1_AFTER && age <= G1_UNTIL) {
        message = growthOne(lead, site); stamp = 'followup1_sent_at';
      } else if (lead.followup1_sent_at && age >= G2_AFTER && age <= G2_UNTIL) {
        message = growthTwo(lead, site); stamp = 'followup2_sent_at';
      }
      if (!message) continue;

      const patch = {};
      patch[stamp] = new Date().toISOString();
      const { error: stampErr } = await db.from('leads').update(patch).eq('id', lead.id);
      if (stampErr) { console.error('followups: growth stamp failed for %s:', lead.id, stampErr.message); continue; }

      const outcome = await sendEmail(message);
      console.log('followups: growth %s to %s -> %s', stamp, lead.email, outcome);
      if (outcome === 'sent') { if (stamp === 'followup1_sent_at') sentG1++; else sentG2++; }
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

    /* ---- the month-in note: one email about the plan above theirs ----- */
    let sentPn = 0;
    const { data: month, error: pnErr } = await db.from('profiles')
      .select('id, business_name, active_plan, subscribed_at, plan_note_sent_at, subscription_status')
      .in('subscription_status', ['active', 'trialing'])
      .in('active_plan', ['starter', 'business'])
      .not('subscribed_at', 'is', null)
      .is('plan_note_sent_at', null)
      .limit(100);
    if (pnErr) console.error('followups: plan-note query failed:', pnErr.message);

    for (const p of month || []) {
      const age = now - new Date(p.subscribed_at).getTime();
      if (age < PN_AFTER || age > PN_UNTIL) continue;

      const { error: pnStamp } = await db.from('profiles')
        .update({ plan_note_sent_at: new Date().toISOString() })
        .eq('id', p.id).is('plan_note_sent_at', null);
      if (pnStamp) { console.error('followups: plan-note stamp failed:', pnStamp.message); continue; }

      const { data: who } = await db.auth.admin.getUserById(p.id);
      const email = who && who.user && who.user.email;
      if (!email) continue;

      const note = planNote(p.active_plan, p.business_name, site);
      const outcome = await sendEmail({ to: email, subject: note.subject, html: note.html, text: note.text });
      console.log('followups: plan note (%s) to %s -> %s', p.active_plan, email, outcome);
      if (outcome === 'sent') sentPn++;
    }

    if (sentF1 + sentF2 + sentG1 + sentG2 + sentWb + sentPn > 0) {
      await notifyAdmin(db, 'Follow-ups sent',
        `${sentF1} "what did you think", ${sentF2} final follow-ups, ${sentG1 + sentG2} growth-plan follow-ups, ${sentWb} win-backs and ${sentPn} month-in notes went out.`);
    }

    /* ---- retention: what the privacy notice promises, kept true ------- */
    /* Visit counts go after 13 months, chat conversations (and their
       messages, by cascade) 24 months after the last message. Best effort:
       a failed sweep is logged and tried again tomorrow. */
    const views = await db.from('page_views').delete().lt('created_at', new Date(now - 13 * 30 * DAY).toISOString());
    if (views.error) console.error('followups: page_views sweep failed:', views.error.message);
    const chats = await db.from('conversations').delete().lt('last_message_at', new Date(now - 24 * 30 * DAY).toISOString());
    if (chats.error) console.error('followups: conversations sweep failed:', chats.error.message);

    return res.status(200).json({ ok: true, followup1: sentF1, followup2: sentF2, growth1: sentG1, growth2: sentG2, winback: sentWb });
  } catch (err) {
    console.error('followups:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};

module.exports.planNote = planNote;
