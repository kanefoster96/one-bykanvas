/* The One onboarding form: what a customer tells us to build their system.
 *
 *   GET   -> { answers, updatedAt, plan, business, viewer }   their saved answers
 *   POST  { answers }  -> { ok, changed }   save, and tell the other side what changed
 *
 * The admin can open any One customer's form with ?user=<id> (GET) or
 * user in the body (POST). A save by the customer emails and pushes the
 * admin; a save by the admin pushes the customer, so both hear the
 * moment the other changes something.
 *
 * Everything is optional and can be saved as often as they like. The
 * questions are the same for every trade; onboarding-trades.js holds the
 * suggestions under each one. Clubs have their own, shorter form
 * (club-setup.html, form: 'club'), with its own sections below.
 *
 * A save with quiet: true (the club form, as they type) stores the answers
 * and tells nobody. A save without it is a "send": it tells the other side
 * what changed since the last send, and keeps a copy of what was sent
 * (answers._sent) to compare the next one with. The five contact fields the account page
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
const { missingEnv, ourSiteUrl, adminEmails } = require('./_env.js');
const { sendEmail, adminAddresses } = require('./_email.js');
const { notifyAdmin, notify } = require('./_notify.js');

/* The sections, in the order the form shows them, for the email. */
const SECTIONS = [
  ['model', 'Which One'],
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

/* The club form's sections, in its order. */
const CLUB_SECTIONS = [
  ['club', 'Your club'],
  ['coaches', 'Coaches'],
  ['classes', 'Classes'],
  ['prices', 'Prices'],
  ['joining', 'Joining'],
  ['extras', 'Extras']
];

/* Profile columns the contact section mirrors. */
const MIRROR = { public_email: 'email', phone: 'phone', address: 'address', service_area: 'area', opening_hours: 'reach' };

const MAX_BYTES = 60000;

/* The answers that shape the build, in plain words. Anything on this list
   left blank or "not sure" is the admin's to decide, and the email says so
   under its own heading. Add-on sections count only for the One picked. */
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

/* What we need to copy the Academy for a club, in plain words. */
const CLUB_DECISIONS = {
  club: { name: 'club name', teach: 'what they teach', ages: 'ages', venue: 'where classes happen', email: 'email for parents', phone: 'phone for parents' },
  prices: { charge: 'how people pay', prices: 'their prices' },
  joining: { trial: 'the trial', start: 'when new members start' },
  extras: { uniform_required: 'uniform required in class', uniform_sell: 'whether they sell uniform', competitions: 'competitions', shows: 'shows with tickets', shop: 'other things they sell' }
};

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

function undecidedClub(answers) {
  const out = [];
  for (const [section, fields] of Object.entries(CLUB_DECISIONS)) {
    const sec = answers[section] || {};
    const missing = Object.entries(fields).filter(([k]) => blank(sec[k]) || sec[k] === 'Not sure').map(([, label]) => label);
    if (missing.length) out.push(`  ${section}: ${missing.join(', ')}`);
  }
  const coaches = Array.isArray(answers.coaches) ? answers.coaches : [];
  if (!coaches.length) out.push('  coaches: none added');
  coaches.forEach((c) => {
    const missing = [['email', 'email'], ['role', 'role']].filter(([k]) => blank(c[k])).map(([, label]) => label);
    if (missing.length) out.push(`  ${c.name || 'a coach'}: ${missing.join(', ')}`);
  });
  const cl = answers.classes || {};
  const list = Array.isArray(cl.list) ? cl.list : [];
  if (!list.length && blank(cl.timetable) && blank(cl.files)) out.push('  classes: no classes or timetable');
  list.forEach((c) => {
    const missing = [['day', 'day'], ['start', 'start time'], ['ages', 'ages'], ['coach', 'coach']].filter(([k]) => blank(c[k])).map(([, label]) => label);
    if (missing.length) out.push(`  ${c.name || 'a class'}: ${missing.join(', ')}`);
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

/* JSON with object keys sorted: the database (jsonb) keeps keys in its own
   order, so a plain stringify would call an unchanged section changed. */
function same(a, b) { return stable(a) === stable(b); }
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
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
    const isAdmin = !!user.email && adminEmails().includes(String(user.email).toLowerCase());

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    /* Whose form: the caller's, or, for the admin, the customer named. */
    const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})) : {};
    const asked = String((req.method === 'GET' ? (req.query || {}).user : body.user) || '').trim();
    if (asked && !isAdmin) return res.status(403).json({ error: 'That form is not yours.' });
    if (asked && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(asked)) return res.status(400).json({ error: 'That is not a customer id.' });
    const ownerId = asked || user.id;
    const viewer = asked ? 'admin' : 'owner';

    const { data: profile, error: pErr } = await db.from('profiles')
      .select('business_name, active_plan, subscription_status, max_model, public_email, phone, address, service_area, opening_hours')
      .eq('id', ownerId).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (asked && !profile) return res.status(404).json({ error: 'No customer with that id.' });

    const plan = profile && profile.active_plan;
    const { data: row, error: rErr } = await db.from('max_onboarding')
      .select('answers, updated_at').eq('user_id', ownerId).maybeSingle();
    if (rErr) throw new Error(rErr.message);

    if (req.method === 'GET') {
      const { _sent, _sent_at, ...answers } = (row && row.answers) || {};
      /* The contact section starts from what the profile already knows. */
      const contact = Object.assign({}, answers.contact || {});
      for (const [col, key] of Object.entries(MIRROR)) {
        if (!contact[key] && profile && profile[col]) contact[key] = profile[col];
      }
      /* Which One they bought, from the wizard: the form starts on it and
         need not ask. */
      const maxModel = (profile && profile.max_model) || null;
      return res.status(200).json({
        answers: Object.assign({}, answers, { contact, model: answers.model || maxModel || '' }),
        updatedAt: row ? row.updated_at : null,
        sentAt: _sent_at || null,
        unsent: _sent !== undefined && !same(_sent, answers),
        plan,
        business: (profile && profile.business_name) || '',
        viewer,
        maxModel
      });
    }

    /* ---- POST: save ---- */
    if (plan !== 'max') {
      return res.status(403).json({ error: 'The One setup form is for One customers.' });
    }
    const incoming = clean(body.answers) || {};
    if (JSON.stringify(incoming).length > MAX_BYTES) {
      return res.status(413).json({ error: 'That is more than the form can hold. Trim a section and try again.' });
    }

    /* Nothing from the browser gets to set what was sent. */
    delete incoming._sent; delete incoming._sent_at;
    const quiet = body.quiet === true;
    const stored = (row && row.answers) || {};
    const club = incoming.form === 'club';
    const sections = club ? CLUB_SECTIONS : SECTIONS;
    /* What was last sent. A row from before sends existed was saved by a
       form that told us on every save, so all of it counts as sent. */
    const { _sent: lastSent, _sent_at: lastSentAt, ...legacy } = stored;
    const sentBefore = lastSent !== undefined ? lastSent : legacy;
    const before = Object.assign({}, sentBefore);
    /* The One they bought was shown as already answered: saving it back is
       not a change worth telling anyone about. */
    if (!before.model && profile && profile.max_model && incoming.model === profile.max_model) before.model = profile.max_model;
    const changed = sections.filter(([key]) => !same(before[key] || null, incoming[key] || null)).map(([, label]) => label);

    const now = new Date().toISOString();
    const sent = quiet
      ? { _sent: sentBefore, _sent_at: lastSentAt || null }
      : { _sent: incoming, _sent_at: now };
    const { error: upErr } = await db.from('max_onboarding')
      .upsert({ user_id: ownerId, answers: Object.assign({}, incoming, sent), updated_at: now }, { onConflict: 'user_id' });
    if (upErr) throw new Error(upErr.message);

    /* Mirror the contact fields onto the profile, so the account page and
       the live site say the same thing. */
    const contact = club
      ? { email: (incoming.club || {}).email, phone: (incoming.club || {}).phone, address: (incoming.club || {}).venue }
      : (incoming.contact || {});
    const patch = { id: ownerId };
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

    if (quiet || !changed.length) return res.status(200).json({ ok: true, changed: quiet ? undefined : [] });

    /* The admin changed it: the customer hears in the app, on their phone. */
    if (viewer === 'admin') {
      await notify(db, ownerId, 'We updated your One setup', `Changed: ${changed.join(', ')}.`, club ? '/club-setup.html' : '/onboarding.html',
        { kind: 'max_setup', deepLink: { kind: 'max_setup' } });
      return res.status(200).json({ ok: true, changed });
    }

    /* Tell the admin: which sections moved, then everything, so the email
       is the record and nobody has to open the database. */
    const name = (profile && profile.business_name) || user.email || 'A customer';
    const site = ourSiteUrl();
    const decide = club ? undecidedClub(incoming) : undecided(incoming);
    const text = [
      `${name} ${club ? 'sent their club setup' : 'updated their One setup'}: ${changed.join(', ')}.`,
      '',
      'YOU DECIDE (left blank or not sure):',
      ...(decide.length ? decide : ['  nothing - every question has an answer']),
      '',
      ...sections.map(([key, label]) => `${changed.includes(label) ? '* ' : '  '}${label.toUpperCase()}\n${pretty(incoming[key])}`).join('\n\n').split('\n'),
      '',
      `Their account: ${site}/admin.html`,
      'Reply to this email to reach them.'
    ].join('\n');

    const result = await sendEmail({
      to: adminAddresses(),
      subject: `${club ? 'Club setup sent' : 'One setup updated'}: ${name} (${changed.join(', ')})`,
      text,
      replyTo: user.email
    });
    console.log('onboarding: notify email', result);

    await notifyAdmin(db, club ? 'Club setup sent' : 'One setup updated', `${name} changed: ${changed.join(', ')}.`, `${club ? '/club-setup.html' : '/onboarding.html'}?user=${ownerId}`,
      { kind: 'max_setup', deepLink: { kind: 'max_setup', user: ownerId } });

    return res.status(200).json({ ok: true, changed });
  } catch (err) {
    console.error('onboarding:', err && err.message);
    return res.status(500).json({ error: 'Could not save that. Try again in a moment.' });
  }
};
