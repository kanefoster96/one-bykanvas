/* Catches an enquiry from the public form on the marketing site.
 *
 * The only endpoint here that anyone can call without a session - the form
 * sits on a public page and the person filling it in has no account yet, by
 * definition. So everything is validated and length-capped here rather than
 * trusted, and the service role is used purely because there is no session
 * to scope an insert to.
 *
 * The email to us is best effort, same as everywhere else: the lead is
 * already saved by the time it is attempted, so a mail problem costs a
 * notification, not the enquiry.
 */
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { missingEnv, ourSiteUrl } = require('./_env.js');
const { sendEmail, adminAddresses } = require('./_email.js');
const { html: emailHtml, esc, standardFooter } = require('./_email_template.js');
const { notifyAdmin } = require('./_notify.js');
const { candidates: domainCandidates, lookup: domainLookup } = require('./domains.js');
const { sendMetaEvent } = require('./_meta.js');

const PLAN_INTEREST = ['business', 'starter', 'max', 'unsure'];

/* The web address a free example is offered with: the closest free one to
   the business name, asked of the registry now so the admin, the pill on
   the example and the ready email all carry the same address from the
   start. Never guessed: nothing reachable or everything taken means no
   address, and the ready email tries again then. */
const SUGGEST_BUDGET = 6;
async function suggestDomain(business) {
  try {
    const list = domainCandidates(business).slice(0, SUGGEST_BUDGET);
    if (!list.length) return '';
    const states = await Promise.all(list.map(domainLookup));
    const i = states.indexOf('free');
    return i === -1 ? '' : list[i];
  } catch (e) {
    console.error('lead: domain suggest failed:', e && e.message);
    return '';
  }
}

/* Deliberately loose - a real address this rejects is worse than a fake one
   it lets through, since the fake one just sits in a list we ignore. */
function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function clean(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

/* For anything that ends up in an email subject line: a line break in a
   subject is how header injection starts, and no business name needs one. */
function oneLine(s) {
  return String(s).replace(/[\r\n]+/g, ' ').trim();
}

/* Where to find them online: an @handle, a pasted link, or a bare
   "instagram.com/x" or "www.checkatrade.com/...". Tidied so that it can be
   tapped from the admin and the emails rather than copied out: a handle
   gets its @ back (habit drops it), anything shaped like a web address gets
   https:// in front, and everything else is kept as typed. */
function tidyLink(raw) {
  const s = String(raw == null ? '' : raw).trim().replace(/\s+/g, ' ');
  if (!s) return '';
  if (/^@/.test(s)) return '@' + s.replace(/^@+/, '');
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(s)) return 'https://' + s;
  if (/^[\w.]+$/.test(s)) return '@' + s;
  return s;
}

/* What a dropped submission is told. It has to match a real success exactly,
   id and all, or the difference is itself the signal: a bot that can tell it
   was caught comes back having learned which field to leave alone. The id is
   random and refers to nothing, which is the point - nothing was stored. */
function dropped() {
  return { ok: true, id: crypto.randomUUID() };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('lead: missing environment variables:',
      missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', ') || '(none named)');
    return res.status(500).json({ error: 'Not configured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    const name = clean(body.name, 200);
    const business = clean(body.business, 200);
    const email = clean(body.email, 320);
    const about = clean(body.about, 4000);
    const planRaw = String(body.plan || '').toLowerCase();
    const plan_interest = PLAN_INTEREST.includes(planRaw) ? planRaw : null;

    /* The free-example form posts here too. Same table, same notification, one
       inbox - what separates them is source, which is checked against a list
       rather than trusted, so a crafted post cannot invent a category. */
    const SOURCES = ['enquiry', 'free-preview'];
    const sourceRaw = String(body.source || 'enquiry');
    const source = SOURCES.includes(sourceRaw) ? sourceRaw : 'enquiry';
    const free = source === 'free-preview';

    const handle = tidyLink(clean(body.handle, 200));
    let requested_domain = clean(body.domain, 253).toLowerCase();
    /* Where they came from: the ad's tags and the landing page, as the
       browser kept them from the first page of the visit. */
    const campaign = clean(body.campaign, 200);

    if (!name || !business) return res.status(400).json({ error: 'Tell us your name and business.' });
    if (!looksLikeEmail(email)) return res.status(400).json({ error: 'That email does not look right.' });

    /* Bot filters. Both answer 200 with the same shape a real submission gets:
       a bot told it failed comes back and tries again, whereas one told it
       succeeded moves on. Nothing is written and nobody is emailed.

       website is a honeypot - a field positioned off-screen that a person
       never sees and a form-filling crawler cannot resist, doubly so for the
       link-spam kind, which is most of them.

       elapsed is how long the form was on screen. It comes from the browser so
       it is forgeable, and it is only here to catch the crude ones; the
       threshold is deliberately low, because a real person using autofill can
       be quick and turning one of them away costs far more than letting a bot
       through. */
    if (clean(body.website, 200)) {
      console.log('lead: honeypot filled, dropped');
      return res.status(200).json(dropped());
    }
    const elapsed = Number(body.elapsed);
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 2000) {
      console.log('lead: submitted in %sms, dropped', elapsed);
      return res.status(200).json(dropped());
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    /* A free example with no address chosen gets one found for it, before
       the row is written, so everything downstream sees it. A few seconds
       of registry lookups, in the one request that is already waiting on
       two emails. */
    if (free && !requested_domain) requested_domain = await suggestDomain(business);

    const { data: row, error } = await db.from('leads').insert({
      name, business, email, about: about || null,
      plan_interest, want_app: Boolean(body.wantApp),
      source, handle: handle || null, requested_domain: requested_domain || null,
      campaign: campaign || null
    }).select().single();
    if (error) throw new Error(error.message);

    const site = ourSiteUrl();

    /* Meta hears about the lead from here whether or not cookies were
       accepted; the thanks page fires the same event id, and Meta dedupes. */
    if (free) {
      const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      sendMetaEvent({
        name: 'Lead', eventId: row.id, email,
        url: `${site}/thanks.html`,
        ip: fwd || undefined, userAgent: req.headers['user-agent'] || undefined,
        custom: { content_category: 'free-preview', campaign: campaign || undefined }
      }).catch(() => {});
    }

    /* Two different jobs arrive here, so they read differently in an inbox: an
       enquiry is a conversation to start, a free example is a piece of work to
       do. The subject line says which before it is opened. */
    const result = await sendEmail({
      to: adminAddresses(),
      subject: oneLine(free ? `Free example wanted: ${business}` : `New enquiry: ${business}`),
      text: free
        ? `${name} at ${business} wants a free example.\n\n`
          + `Email:   ${email}\n`
          + `Find them: ${handle || 'not given'}\n`
          + `Address: ${requested_domain || 'none free for that name'}\n`
          + `From:    ${campaign || 'no campaign tags'}\n\n`
          + `Anything they added:\n${about || '-'}\n\n`
          + `Nothing is registered - the address above is the one they will be offered.\n\n`
          + `Admin: ${site}/admin.html`
        : `${name} at ${business} got in touch.\n\n`
          + `Email:     ${email}\n`
          + `Interested in: ${plan_interest || 'not said'}\n\n`
          + `What they said:\n${about || '-'}\n\n`
          + `Admin: ${site}/admin.html`,
      replyTo: email
    });
    console.log('lead: notify email', result);

    await notifyAdmin(db,
      free ? 'Free example wanted' : 'New enquiry',
      business + (free
        ? (requested_domain ? ' \u2014 ' + requested_domain : '')
        : (plan_interest ? ' \u2014 interested in ' + plan_interest : '')));

    /* And a word back to them, for a free example only. An enquiry gets a
       reply from a person, which is better than an automated one; a free
       example is a job going in a queue, so silence here reads as the form
       not having worked.

       It confirms the request and says what joining would get them. Those two
       jobs belong in one email rather than two, because the second would be
       marketing arriving unasked, and this one they have just asked for. */
    if (free) {
      /* This endpoint is open and this branch emails whatever address was
         typed in, which is everything a mail-bomber needs. The lead is kept
         either way; only the automatic reply is rationed - after a few in a
         day to one address, the rest go quiet. A real person asking twice
         still gets an answer, because we do, by hand. */
      let allowed = true;
      try {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await db.from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('email', email)
          .gte('created_at', dayAgo);
        if (Number.isFinite(count) && count > 3) {
          allowed = false;
          console.log('lead: %s already has %s leads today, confirmation not sent', email, count);
        }
      } catch (e) {
        /* Counting going wrong is no reason to hold a real person's email. */
        console.error('lead: rate check failed:', e && e.message);
      }

      if (allowed) {
      /* No price and no plans here: they have not seen their page yet, and
         a number before the reason is a number they decide on. */
      const facts = [{ label: 'Business', value: business }];
      if (handle) facts.push({ label: 'Designing from', value: handle });

      const theirs = await sendEmail({
        to: email,
        subject: 'Your free page is on its way - within 24 hours',
        html: emailHtml({
          preheader: 'We have your details. Your free page lands in this inbox within 24 hours.',
          heading: 'I’m on it 👍',
          lines: [
            `Thanks &mdash; I&rsquo;ve got your details and I&rsquo;m designing a page for `
              + `<strong>${esc(business)}</strong>. It&rsquo;ll land in this inbox within 24 hours.`,
            'Designed by hand, for you. Nothing for you to do in the meantime.',
            'When it lands: like it, and it can be live on your own address the same day. '
              + 'Anything off, just reply &mdash; changes are free. Not for you? No hard feelings.'
          ],
          details: facts,
          footer: 'You&rsquo;re getting this because you asked for a free example at '
                + 'kanvas.one. No account has been created and nothing has been charged.',
          footerLinks: standardFooter(site)
        }),
        text: `Thanks - I've got your details and I'm designing a page for ${business}.\n\n`
            + `It'll land in this inbox within 24 hours. Designed by hand, for you. `
            + `Nothing for you to do in the meantime.\n\n`
            + `When it lands: like it, and it can be live on your own address the same day. `
            + `Anything off, just reply - changes are free. Not for you? No hard feelings.\n`
      });
      console.log('lead: confirmation email', theirs);
      }
    }

    return res.status(200).json({ ok: true, id: row.id });
  } catch (err) {
    console.error('lead:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
