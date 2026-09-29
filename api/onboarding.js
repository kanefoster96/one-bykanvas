/* The Max onboarding form: what a customer tells us to build their system.
 *
 *   GET   -> { answers, updatedAt, plan }   their saved answers
 *   POST  { answers }  -> { ok, changed }   save, and tell the admin what changed
 *
 * Everything is optional and can be saved as often as they like. The
 * questions are the same for every trade; onboarding-trades.js holds the
 * suggestions under each one. The five contact fields the account page
 * also holds (public_email, phone, address, service_area, opening_hours)
 * are written through to the profile too, so there is one truth for them. Every save that changes anything sends the
 * admin an email naming the sections that changed, with the full answers
 * under it, and drops a notification row.
 *
 * Verified from the caller's own token; the answers are size-capped and
 * kept as strings, numbers and booleans only, so nothing odd lands in the
 * blob or the email.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv, ourSiteUrl } = require('./_env.js');
const { sendEmail, adminAddresses } = require('./_email.js');
const { notifyAdmin } = require('./_notify.js');

/* The sections, in the order the form shows them, for the email. */
const SECTIONS = [
  ['model', 'Which Max'],
  ['contact', 'How customers reach you'],
  ['services', 'What you do and what it costs'],
  ['services_generated', 'Generated images for now'],
  ['offer', 'What we advertise and what we offer on top'],
  ['customers', 'How you get customers now'],
  ['want', 'Who you want more of'],
  ['bookings', 'How a job gets booked now'],
  ['payments', 'How you get paid now'],
  ['later', 'When it is too much, and what comes round again'],
  ['online', 'What is already online'],
  ['photos', 'Photos'],
  ['trades', 'The proof that comes with the work'],
  ['trades_how', 'Urgent jobs'],
  ['clubs', 'Classes and fees'],
  ['clubs_how', 'First visits and terms'],
  ['salon', 'The team and what else you sell'],
  ['salon_how', 'No-shows, rebooking and first appointments'],
  ['extras', 'Anything else']
];

/* Profile columns the contact section mirrors. */
const MIRROR = { public_email: 'email', phone: 'phone', address: 'address', service_area: 'area', opening_hours: 'reach' };

const MAX_BYTES = 60000;

/* The answers that shape the build, in plain words. Anything on this list
   left blank or "not sure" is the admin's to decide, and the email says so
   under its own heading. Add-on sections count only for the Max picked. */
const DECISIONS = {
  contact: { area: 'areas covered', base: 'where they set off from', reach: 'when customers can reach them', customers_live: 'where their customer details live now' },
  offer: { job: 'the job to advertise', upsells: 'the upsells', addons: 'the add-on for any visit', moment: 'when they mention extra work' },
  customers: { sources: 'how they get customers now', jobs_per_week: 'jobs a week or month', job_value: 'a small job\u2019s value', big_job_value: 'a big job\u2019s value', partners: 'who sends them work' },
  want: { capacity: 'how much more work they can take', best: 'their best kind of customer', busiest: 'busiest time of year', quietest: 'quietest time of year' },
  bookings: { first: 'what happens first when someone gets in touch', how: 'where bookings live now', lead_time: 'how soon a new customer gets them', want: 'straight in or ask first' },
  payments: { methods: 'how they get paid now', upfront: 'anything taken before the work', amount: 'the deposit or callout amount', when: 'when it is taken', big_job: 'what is taken before a big job', finance: 'finance' },
  later: { now: 'what happens when a quote is too much', smaller: 'the smaller version of the big job', again: 'what comes round again', plan: 'a monthly or yearly plan' },
  online: { facebook: 'Facebook page or profile', gbp: 'Google Business Profile' },
  trades: { registrations: 'registrations and checks', insured: 'insurance', guarantee: 'the guarantee' },
  trades_how: { emergency: 'urgent jobs' },
  clubs: { classes: 'classes and ages', fees: 'fees' },
  clubs_how: { first_visit: 'how a first visit works', terms: 'term dates' },
  salon: { team: 'the team' },
  salon_how: { no_show: 'no-show policy', rebook: 'rebooking interval', before_first: 'before a first appointment' }
};
const JOB_FIELDS = { often: 'how often', price: 'price', pricing: 'how it is priced', flow: 'straight in or ask first' };

function blank(v) { return v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && !v.length); }

/* A tick list counts as answered if a tick or its "other" box is. */
function answered(sec, k) { return !blank(sec[k]) || !blank(sec[k + '_other']); }

function undecided(answers) {
  const out = [];
  const model = answers.model || '';
  for (const [section, fields] of Object.entries(DECISIONS)) {
    if (/^(trades|clubs|salon)/.test(section) && section.replace(/_how$/, '') !== model) continue;
    const sec = answers[section] || {};
    const missing = Object.entries(fields).filter(([k]) => !answered(sec, k)).map(([, label]) => label);
    if (missing.length) out.push(`  ${section}: ${missing.join(', ')}`);
  }
  const sv = answers.services || {};
  if (!sv.trade) out.push('  services: the trade');
  const jobs = Array.isArray(sv.jobs) ? sv.jobs : [];
  if (!jobs.length) out.push('  services: no jobs ticked');
  if (jobs.length > 1 && !sv.most) out.push('  services: which job they do most');
  jobs.forEach((j) => {
    const missing = Object.entries(JOB_FIELDS).filter(([k]) => blank(j[k])).map(([, label]) => label);
    if (missing.length) out.push(`  ${j.name || 'a job'}: ${missing.join(', ')}`);
  });
  return out;
}

/* Strings, numbers, booleans, and arrays/objects of those, four levels
   deep. Anything else is dropped. */
function clean(v, depth) {
  depth = depth || 0;
  if (typeof v === 'string') return v.slice(0, 4000);
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  /* Four levels: answers > services > jobs > a job's fields. */
  if (depth > 4 || v === null || v === undefined) return undefined;
  if (Array.isArray(v)) return v.slice(0, 40).map((x) => clean(x, depth + 1)).filter((x) => x !== undefined);
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).slice(0, 60)) {
      const c = clean(v[k], depth + 1);
      if (c !== undefined) out[String(k).slice(0, 40)] = c;
    }
    return out;
  }
  return undefined;
}

function pretty(v, indent) {
  indent = indent || '';
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v !== 'object') return String(v);
  if (Array.isArray(v)) {
    return v.map((x) => (typeof x === 'object' ? '\n' + pretty(x, indent + '    ') : indent + '  - ' + pretty(x))).join('\n');
  }
  return Object.keys(v).map((k) => `${indent}  ${k}: ${typeof v[k] === 'object' ? '\n' + pretty(v[k], indent + '  ') : pretty(v[k])}`).join('\n');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('onboarding: missing environment variables:',
      missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', ') || '(none named)');
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

    const { data: profile, error: pErr } = await db.from('profiles')
      .select('business_name, active_plan, subscription_status, public_email, phone, address, service_area, opening_hours')
      .eq('id', user.id).maybeSingle();
    if (pErr) throw new Error(pErr.message);

    const plan = profile && profile.active_plan;
    const { data: row, error: rErr } = await db.from('max_onboarding')
      .select('answers, updated_at').eq('user_id', user.id).maybeSingle();
    if (rErr) throw new Error(rErr.message);

    if (req.method === 'GET') {
      const answers = (row && row.answers) || {};
      /* The contact section starts from what the profile already knows. */
      const contact = Object.assign({}, answers.contact || {});
      for (const [col, key] of Object.entries(MIRROR)) {
        if (!contact[key] && profile && profile[col]) contact[key] = profile[col];
      }
      return res.status(200).json({
        answers: Object.assign({}, answers, { contact }),
        updatedAt: row ? row.updated_at : null,
        plan,
        business: (profile && profile.business_name) || ''
      });
    }

    /* ---- POST: save ---- */
    if (plan !== 'max') {
      return res.status(403).json({ error: 'The Max setup form is for Max customers.' });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const incoming = clean(body.answers) || {};
    if (JSON.stringify(incoming).length > MAX_BYTES) {
      return res.status(413).json({ error: 'That is more than the form can hold. Trim a section and try again.' });
    }

    const before = (row && row.answers) || {};
    const changed = SECTIONS.filter(([key]) => JSON.stringify(before[key] || null) !== JSON.stringify(incoming[key] || null)).map(([, label]) => label);

    const now = new Date().toISOString();
    const { error: upErr } = await db.from('max_onboarding')
      .upsert({ user_id: user.id, answers: incoming, updated_at: now }, { onConflict: 'user_id' });
    if (upErr) throw new Error(upErr.message);

    /* Mirror the contact fields onto the profile, so the account page and
       the live site say the same thing. */
    const contact = incoming.contact || {};
    const patch = { id: user.id };
    let mirrored = false;
    for (const [col, key] of Object.entries(MIRROR)) {
      if (typeof contact[key] === 'string' && contact[key].trim() && contact[key].trim() !== (profile && profile[col])) {
        patch[col] = contact[key].trim().slice(0, 500);
        mirrored = true;
      }
    }
    if (mirrored) {
      const { error: mErr } = await db.from('profiles').upsert(patch, { onConflict: 'id' });
      if (mErr) console.error('onboarding: profile mirror failed:', mErr.message);
    }

    if (!changed.length) return res.status(200).json({ ok: true, changed: [] });

    /* Tell the admin: which sections moved, then everything, so the email
       is the record and nobody has to open the database. */
    const name = (profile && profile.business_name) || user.email || 'A customer';
    const site = ourSiteUrl();
    const decide = undecided(incoming);
    const text = [
      `${name} updated their Max setup: ${changed.join(', ')}.`,
      '',
      'YOU DECIDE (left blank or not sure):',
      ...(decide.length ? decide : ['  nothing - every question has an answer']),
      '',
      ...SECTIONS.map(([key, label]) => `${changed.includes(label) ? '* ' : '  '}${label.toUpperCase()}\n${pretty(incoming[key])}`).join('\n\n').split('\n'),
      '',
      `Their account: ${site}/admin.html`,
      'Reply to this email to reach them.'
    ].join('\n');

    const result = await sendEmail({
      to: adminAddresses(),
      subject: `Max setup updated: ${name} (${changed.join(', ')})`,
      text,
      replyTo: user.email
    });
    console.log('onboarding: notify email', result);

    await notifyAdmin(db, 'Max setup updated', `${name} changed: ${changed.join(', ')}.`, '/admin.html');

    return res.status(200).json({ ok: true, changed });
  } catch (err) {
    console.error('onboarding:', err && err.message);
    return res.status(500).json({ error: 'Could not save that. Try again in a moment.' });
  }
};
