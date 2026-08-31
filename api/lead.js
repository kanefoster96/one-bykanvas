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

const PLAN_INTEREST = ['business', 'pro', 'max', 'unsure'];

/* Deliberately loose - a real address this rejects is worse than a fake one
   it lets through, since the fake one just sits in a list we ignore. */
function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function clean(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
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

    const handle = clean(body.handle, 200);
    const requested_domain = clean(body.domain, 253).toLowerCase();

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

    const { data: row, error } = await db.from('leads').insert({
      name, business, email, about: about || null,
      plan_interest, want_app: Boolean(body.wantApp),
      source, handle: handle || null, requested_domain: requested_domain || null
    }).select().single();
    if (error) throw new Error(error.message);

    const site = ourSiteUrl();

    /* Two different jobs arrive here, so they read differently in an inbox: an
       enquiry is a conversation to start, a free example is a piece of work to
       do. The subject line says which before it is opened. */
    const result = await sendEmail({
      to: adminAddresses(),
      subject: free ? `Free example wanted: ${business}` : `New enquiry: ${business}`,
      text: free
        ? `${name} at ${business} wants a free example.\n\n`
          + `Email:   ${email}\n`
          + `Social:  ${handle || 'not given'}\n`
          + `Address: ${requested_domain || 'not picked'}\n\n`
          + `Anything they added:\n${about || '-'}\n\n`
          + `Nothing is registered - the address above is only what they chose.\n\n`
          + `Admin: ${site}/admin.html`
        : `${name} at ${business} got in touch.\n\n`
          + `Email:     ${email}\n`
          + `Interested in: ${plan_interest || 'not said'}\n`
          + `Wants an app: ${body.wantApp ? 'yes' : 'no'}\n\n`
          + `What they said:\n${about || '-'}\n\n`
          + `Admin: ${site}/admin.html`,
      replyTo: email
    });
    console.log('lead: notify email', result);

    /* And a word back to them, for a free example only. An enquiry gets a
       reply from a person, which is better than an automated one; a free
       example is a job going in a queue, so silence here reads as the form
       not having worked.

       It confirms the request and says what joining would get them. Those two
       jobs belong in one email rather than two, because the second would be
       marketing arriving unasked, and this one they have just asked for. */
    if (free) {
      const perks = [
        'Nothing technical to set up. You send us your details, we do the rest.',
        'No time lost. We build it while you get on with the job.',
        'If anything breaks, we fix it. Included, and it never costs you a point.',
        'Your web address and hosting are in the monthly price, with nothing else to buy.'
      ];

      const facts = [{ label: 'Business', value: business }];
      if (handle) facts.push({ label: 'Social', value: handle });
      if (requested_domain) facts.push({ label: 'Address', value: requested_domain });

      const theirs = await sendEmail({
        to: email,
        subject: 'Your free example is on its way',
        html: emailHtml({
          preheader: 'We have your details. Your free one-page example is being made.',
          heading: 'We’re on it 👍',
          lines: [
            `Thanks &mdash; we&rsquo;ve got your details and we&rsquo;re designing a page for `
              + `<strong>${esc(business)}</strong>. It&rsquo;ll land in this inbox when it&rsquo;s ready.`,
            'We make these by hand, one at a time, so at busy moments it can take a '
              + 'little longer. Nothing for you to do in the meantime.'
          ],
          details: facts,
          perks: perks,
          ctaText: 'See the plans',
          ctaHref: `${site}/plans.html`,
          ctaNote: 'From £50 a month. Cancel with a month’s notice.',
          footer: 'You&rsquo;re getting this because you asked for a free example at '
                + 'kanvas.one. No account has been created and nothing has been charged.',
          footerLinks: standardFooter(site)
        }),
        text: `Thanks - we've got your details and we're designing a page for ${business}.\n\n`
            + `It'll land in this inbox when it's ready. We make these by hand, one at a `
            + `time, so at busy moments it can take a little longer.\n\n`
            + `What joining gets you:\n`
            + perks.map((t) => '- ' + t.replace(/<[^>]+>/g, '')).join('\n') + '\n\n'
            + `See the plans: ${site}/plans.html\n`
            + `From GBP 50 a month. Cancel with a month's notice.\n`
      });
      console.log('lead: confirmation email', theirs);
    }

    return res.status(200).json({ ok: true, id: row.id });
  } catch (err) {
    console.error('lead:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
