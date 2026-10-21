/* The free growth plan: three numbers from the homepage, a plan back.
 *
 * Public, like api/lead.js - the person asking has no account yet - so
 * everything is validated and capped here, and the service role is used
 * only because there is no session to scope the insert to.
 *
 * The sums live in growth-model.js, shared with the page, so the plan on
 * screen and the plan in the email are the same plan. What is decided here:
 * which plan we recommend (One when the business can take £3,000 a month or
 * more when full, Business otherwise), and that is never said as a rule.
 *
 * The lead lands in leads with source 'growth-plan' and plan_interest set to
 * the recommendation; api/followups.js takes it from there (day 2 and day 6,
 * stopped by joining).
 */
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { limitIp, tooMany } = require('./_rate.js');
const { missingEnv, ourSiteUrl } = require('./_env.js');
const { sendEmail, adminAddresses } = require('./_email.js');
const { html: emailHtml, esc, standardFooter } = require('./_email_template.js');
const { notifyAdmin } = require('./_notify.js');
const growth = require('../growth-model.js');

const TYPES = {
  kids: 'Kids’ club', dance: 'Dance or cheer school', gymnastics: 'Gymnastics',
  martial: 'Martial arts', swim: 'Swim school', sport: 'Football or sport',
  gym: 'Gym or personal training', yoga: 'Yoga or Pilates', music: 'Music or tutoring',
  other: 'Something else'
};

function clean(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}
function oneLine(s) { return String(s).replace(/[\r\n]+/g, ' ').trim(); }
function looksLikeEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s); }
const money = growth.money;

/* Into get-started with the plan chosen and their name already typed. */
function startHref(site, which, business, type, leadId) {
  const q = ['plan=' + which];
  if (which === 'max') q.push('max=' + growth.maxModel(type));
  q.push('business=' + encodeURIComponent(business));
  /* Their details from the free check, filled in at sign-up. */
  if (leadId) q.push('lead=' + encodeURIComponent(leadId));
  return `${site}/get-started.html?${q.join('&')}`;
}

/* The steps of the plan, as sentences. Shared by the One email; the page
   draws its own from the same numbers. */
function maxSteps(p) {
  if (p.mode === 'fill') {
    return [
      '<strong>Weeks 1 to 8: we build it.</strong> Your website and timetable ready in 7 to 14 days, then your members moved across and your app sent to Apple and Google as soon as your developer accounts are ready (their review takes 1 to 4 weeks). Until then, every app feature works on your website. Once your website and app are both live, usually 4 to 8 weeks after you join, your ads start.',
      `<strong>Then 3 months of ads, on us.</strong> Ads go live for the classes with spaces. In our own academy, &pound;${growth.AVG.adBudget} a month of ads brought around ${p.trials} trial bookings and ${p.perMonth} new members a month.`,
      `<strong>At that pace</strong>, your ${p.spaces} spaces would fill in about ${p.months} month${p.months === 1 ? '' : 's'}.`,
      `<strong>${p.cover} new member${p.cover === 1 ? '' : 's'}</strong> at ${money(p.fee)} cover the &pound;250, and your first 3 months of ads are on us.`,
      '<strong>Every trial</strong> gets reminders and a follow-up with the link to join, and members pay monthly by card, automatically.'
    ];
  }
  return [
    '<strong>Weeks 1 to 8: we build it.</strong> Your website and timetable ready in 7 to 14 days, then your members moved across and your app sent to Apple and Google as soon as your developer accounts are ready (their review takes 1 to 4 weeks). Until then, every app feature works on your website.',
    '<strong>Payments run themselves.</strong> Monthly memberships taken by card, failed payments chased for you.',
    '<strong>Trials, reminders and follow-ups</strong> sent for you, every time, so nobody slips through.',
    '<strong>A real person to message</strong> for any change, and a monthly report on how it is going.',
    '<strong>Ads on standby.</strong> You are nearly full, so we would not run them yet. Open a new class or a space comes up, and we switch them on.'
  ];
}

function maxEmail(site, lead, p, type) {
  const start = startHref(site, 'max', lead.business, type, lead.id);
  const details = [
    { label: 'Members now', value: String(p.members) },
    { label: 'Room for', value: String(p.capacity) },
    { label: 'Spaces empty', value: String(p.spaces) },
    { label: 'Fee a month', value: money(p.fee) },
    { label: 'When full', value: money(p.total) + ' a month' }
  ];
  const steps = maxSteps(p);
  return {
    to: lead.email,
    subject: oneLine(`Your growth plan, ${lead.business}`),
    html: emailHtml({
      preheader: 'How we would run it for you, built on what happened in our own academy.',
      heading: 'Your growth plan',
      lines: [
        `Here is how we would run it for <strong>${esc(lead.business)}</strong>, built on what happened in our own kids&rsquo; club.`,
        p.mode === 'fill'
          ? `You have <strong>${p.spaces} spaces</strong> to fill, worth <strong>${money(p.gapYear)} a year</strong>. This is how we would fill them.`
          : 'You are already nearly full, so this plan is about running it all for you, with the ads ready for when you grow.'
      ],
      details,
      perks: steps,
      ctaText: 'Start One — £250 a month',
      ctaHref: start,
      ctaNote: '3 months of ads included, worth &pound;300. 10 trials in those 3 months, or your next 3 months free. No contract: cancel any time. '
        + 'Rather talk first? Just reply and we&rsquo;ll find 10 minutes.',
      footer: 'You&rsquo;re getting this because you asked for a free growth plan at kanvas.one. The figures are what happened in our own academy, not a promise: what ads bring depends on your type of club and your local area. Two short follow-ups come after this, then we leave you be.',
      footerLinks: standardFooter(site)
    }),
    text: `Your growth plan, ${lead.business}\n\n`
      + `Members now: ${p.members}\nRoom for: ${p.capacity}\nSpaces empty: ${p.spaces}\nFee a month: ${money(p.fee)}\nWhen full: ${money(p.total)} a month\n\n`
      + steps.map((s) => '- ' + s.replace(/<[^>]+>/g, '').replace(/&pound;/g, '£').replace(/&rsquo;/g, '’')).join('\n')
      + `\n\nStart One, £250 a month: ${start}\n\n`
      + '3 months of ads included, worth £300. 10 trials in those 3 months, or your next 3 months free. No contract: cancel any time.\n'
      + 'Rather talk first? Just reply.\n'
  };
}

function businessEmail(site, lead, p, type) {
  const start = startHref(site, 'business', lead.business, type, lead.id);
  const max = startHref(site, 'max', lead.business, type, lead.id);
  const why = p.mode === 'run'
    ? 'you&rsquo;re already nearly full, so paying for ads you don&rsquo;t need isn&rsquo;t worth it'
    : 'at the size you are now, we&rsquo;d rather you didn&rsquo;t pay for more than you need';
  const perks = [
    '<strong>Your website</strong>, built and looked after for you, on your own address.',
    '<strong>Bookings online.</strong> People pick a class or a slot themselves.',
    '<strong>Payments taken when they book</strong>, so the chasing stops.',
    '<strong>Live chat</strong> from your phone, and reviews asked for automatically.',
    '<strong>Changes made for you</strong> within 48 hours.'
  ];
  return {
    to: lead.email,
    subject: oneLine(`Your plan, ${lead.business}`),
    html: emailHtml({
      preheader: 'We don’t think you need One yet. Here’s what we’d do instead.',
      heading: 'We don\u2019t think you need One yet',
      lines: [
        `Thanks for telling us about <strong>${esc(lead.business)}</strong>. Honestly, ${why}.`,
        'We&rsquo;d start you on <strong>Business, &pound;50 a month</strong>: &pound;200 a month less than One, with your website, bookings and payments run for you.'
      ],
      perks,
      ctaText: 'Start with Business — £50 a month',
      ctaHref: start,
      ctaNote: `When you open a new class or want the ads running, One is there. <a href="${esc(max)}" style="color:inherit;">Prefer One now?</a> Or just reply with any questions.`,
      footer: 'You&rsquo;re getting this because you asked for a free growth plan at kanvas.one. Two short follow-ups come after this, then we leave you be.',
      footerLinks: standardFooter(site)
    }),
    text: `Your plan, ${lead.business}\n\n`
      + `Thanks for telling us about ${lead.business}. Honestly, ${why.replace(/&rsquo;/g, '’')}.\n\n`
      + 'We’d start you on Business, £50 a month: £200 a month less than One, with your website, bookings and payments run for you.\n\n'
      + `Start with Business: ${start}\n\nPrefer One now? ${max}\n`
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('plan: missing environment variables:',
      missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', ') || '(none named)');
    return res.status(500).json({ error: 'Not configured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const name = clean(body.name, 200);
    const business = clean(body.business, 200);
    const email = clean(body.email, 320).toLowerCase();
    const phone = clean(body.phone, 40);
    const town = clean(body.town, 120);
    const type = Object.prototype.hasOwnProperty.call(TYPES, body.type) ? body.type : 'other';
    const campaign = clean(body.campaign, 200);

    if (!name || !business) return res.status(400).json({ error: 'Tell us your name and business.' });
    if (!looksLikeEmail(email)) return res.status(400).json({ error: 'That email does not look right.' });

    const p = growth.plan({ members: body.members, capacity: body.capacity, spaces: body.spaces, fee: body.fee });

    /* Bots: the same answer a real plan gets, and nothing stored or sent. */
    if (clean(body.website, 200)) return res.status(200).json({ ok: true, id: crypto.randomUUID(), plan: p });
    const elapsed = Number(body.elapsed);
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 2000) {
      return res.status(200).json({ ok: true, id: crypto.randomUUID(), plan: p });
    }

    const rec = p.recommend === 'max' ? 'One' : 'Business';
    const about = [
      `Free growth plan: ${TYPES[type]}${town ? ' in ' + town : ''}.`,
      `${p.members} members now, room for ${p.capacity} (${p.spaces} spaces empty), ${money(p.fee)} a month each.`,
      `${money(p.total)} a month when full (${money(p.now)} now). We recommended ${rec}`
        + (p.mode === 'run' ? ', nearly full.' : `, about ${p.months} months to fill.`),
      phone ? `Phone: ${phone}` : ''
    ].filter(Boolean).join('\n');

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    if (await limitIp(db, req, 'plan', 10, 3600)) return tooMany(res);
    const { data: row, error } = await db.from('leads').insert({
      name, business, email, about,
      plan_interest: p.recommend, source: 'growth-plan',
      campaign: campaign || null
    }).select('id, business, email').single();
    if (error) throw new Error(error.message);

    const site = ourSiteUrl();
    /* This endpoint is open and emails whatever address is typed in, so the
       plan email is rationed like lead.js's: after a few in a day to one
       address the rest go quiet. The lead is kept either way. */
    let allowed = true;
    try {
      const { count } = await db.from('leads')
        .select('id', { count: 'exact', head: true })
        .ilike('email', email.replace(/[%_\\]/g, '\\$&'))
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      if (Number.isFinite(count) && count > 3) allowed = false;
    } catch (e) { console.error('plan: rate check failed:', e && e.message); }

    /* Theirs first: it is the thing they asked for. Ours is best effort. */
    const mine = p.recommend === 'max' ? maxEmail(site, row, p, type) : businessEmail(site, row, p, type);
    const sent = allowed ? await sendEmail(mine) : 'rationed';
    console.log('plan: %s plan to %s -> %s', p.recommend, email, sent);

    await sendEmail({
      to: adminAddresses(),
      subject: oneLine(`Free plan: ${business} (${rec})`),
      text: `${name} at ${business} asked for a free growth plan.\n\n${about}\n\nEmail: ${email}\n`
        + (campaign ? `From: ${campaign}\n` : '') + `\n${site}/admin.html\n`,
      replyTo: email
    }).catch(() => {});
    await notifyAdmin(db, `Free plan: ${business}`, `${rec} recommended. ${money(p.total)} a month when full.`, '/admin.html');

    return res.status(200).json({ ok: true, id: row.id, plan: p });
  } catch (err) {
    console.error('plan:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again in a moment.' });
  }
};

module.exports.startHref = startHref;
