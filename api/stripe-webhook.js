/* Stripe -> Supabase. The only thing that may set a subscription as active.
 *
 * Every request is signature-checked against STRIPE_WEBHOOK_SECRET before it
 * is trusted, which is why the raw body is needed: Vercel's JSON parsing would
 * change the bytes and break verification.
 */
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { missingEnv, ourSiteUrl } = require('./_env.js');
const { sendEmail, adminAddresses } = require('./_email.js');
const { html: emailHtml, esc, standardFooter } = require('./_email_template.js');
const { PLANS } = require('./_plans.js');

const PLAN_NAME = { business: 'Business', pro: 'Pro', max: 'Max' }; // must match admin.js/account.js

// Keep Vercel from parsing the body so the signature can be verified.
module.exports.config = { api: { bodyParser: false } };

function rawBody(req) {
  // Already buffered by the platform in some runtimes.
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body));

  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* An invoice's subscription. Newer API versions moved it from invoice.subscription
   to invoice.parent.subscription_details.subscription, and the account can be
   pinned to either, so both shapes are read rather than assumed. */
function subscriptionIdOf(invoice) {
  const direct = invoice && invoice.subscription;
  if (typeof direct === 'string') return direct;
  if (direct && direct.id) return direct.id;
  const nested = invoice && invoice.parent && invoice.parent.subscription_details
    && invoice.parent.subscription_details.subscription;
  if (typeof nested === 'string') return nested;
  if (nested && nested.id) return nested.id;
  return null;
}

/* Which Stripe statuses mean "this customer is paying us". */
function isLive(status) {
  return status === 'active' || status === 'trialing';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method not allowed');
  }

  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('webhook: missing environment variables:',
      missingEnv(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SUPABASE_URL',
                  'SUPABASE_SERVICE_ROLE_KEY']).join(', ') || '(none named)');
    return res.status(500).end('Not configured');
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  let event;

  try {
    const body = await rawBody(req);
    event = stripe.webhooks.constructEvent(body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // Unsigned or tampered — never act on it.
    console.error('webhook signature rejected:', err && err.message);
    return res.status(400).end(`Webhook Error: ${err && err.message}`);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  /* Finds the profile for a Stripe subscription. Prefers the id we stamped on,
     and falls back to the customer id we stored at checkout. */
  async function profileIdFor(sub) {
    const stamped = sub.metadata && sub.metadata.supabase_user_id;
    if (stamped) return stamped;
    const { data } = await admin
      .from('profiles').select('id').eq('stripe_customer_id', sub.customer).maybeSingle();
    return data ? data.id : null;
  }

  /* When the current billing period ends.
   *
   * Stripe moved this. Up to the Basil release it sat on the subscription as
   * current_period_end; from there on it lives on each subscription item, and a
   * subscription serialised by a newer API version has no such field at the top
   * level. The endpoint's API version decides which shape arrives, and that is
   * chosen in the dashboard rather than here, so both are read: whichever is
   * present wins, and with items the latest one does.
   *
   * Getting this wrong is quiet rather than loud. The column would simply be
   * null, the account page would stop showing a renewal date, and monthly points
   * would reset on the first of the month instead of on the billing date.
   */
  function periodEndOf(sub) {
    let unix = sub.current_period_end || null;

    const items = (sub.items && sub.items.data) || [];
    for (const item of items) {
      if (item && item.current_period_end && item.current_period_end > (unix || 0)) {
        unix = item.current_period_end;
      }
    }
    if (!unix) return null;

    const when = new Date(unix * 1000);
    return isNaN(when) ? null : when.toISOString();
  }

  async function writeSubscription(sub) {
    const id = await profileIdFor(sub);
    if (!id) {
      console.error('webhook: no profile for customer', sub.customer);
      return;
    }
    const periodEnd = periodEndOf(sub);

    /* Was this subscription already live before this event? Stripe sends
       checkout.session.completed and customer.subscription.created for the same
       signup, and an updated event for every later change, so without this the
       same customer would be announced several times over. */
    const { data: before } = await admin
      .from('profiles').select('subscription_status, active_plan').eq('id', id).maybeSingle();
    const wasLive = Boolean(before && isLive(before.subscription_status));
    /* Separately: had the cancellation already been sent? Checked against
       "was it already canceled", not "was it already live" - by the time
       Smart Retries finally give up, the status has usually already moved
       through past_due first, so wasLive alone would miss this transition
       entirely and never fire the email at all. */
    const alreadyCanceled = Boolean(before && before.subscription_status === 'canceled');

    const patch = {
      id,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      current_period_end: periodEnd
    };
    if (sub.metadata && sub.metadata.plan) patch.selected_plan = sub.metadata.plan;

    /* active_plan is what the account page rations points from. selected_plan
       cannot do that job: the customer can write it, so anyone could grant
       themselves Max. This column is only ever written here, and it is cleared
       the moment the subscription stops being live. */
    let entitled = (sub.metadata && sub.metadata.plan) || null;

    /* A downgrade is agreed now and paid for later: api/change-plan.js has
       already put the cheaper price on the subscription, but the customer has
       paid for this month at the old rate and keeps it until that month is up.
       plan_effective_at is when the new plan starts counting. Once it passes,
       the renewal's own event comes through here and the lower plan applies
       with nothing further to do. */
    const startsAt = Number(sub.metadata && sub.metadata.plan_effective_at);
    if (entitled && startsAt && startsAt * 1000 > Date.now() && before && before.active_plan) {
      entitled = before.active_plan;
    }

    patch.active_plan = isLive(sub.status) ? entitled : null;

    const { error } = await admin.from('profiles').upsert(patch, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    console.log('webhook: %s -> %s (live: %s)', id, sub.status, isLive(sub.status));

    /* Tell us a customer has arrived, and tell them too. Deliberately after
       the write and outside its error path: the subscription is already
       recorded, and a mail problem must not fail the event and have Stripe
       retry it. */
    if (isLive(sub.status) && !wasLive) {
      await announceNewCustomer(id, patch);
      await welcomeCustomer(id, patch);
    }
    if (sub.status === 'canceled' && !alreadyCanceled) await announceCancellation(id);
  }

  /* The first thing a customer sees once their card is actually charged -
     what plan, where to go, and that the build is starting. */
  async function welcomeCustomer(id, patch) {
    const { data: p } = await admin
      .from('profiles').select('business_name').eq('id', id).maybeSingle();
    const { data: who } = await admin.auth.admin.getUserById(id);
    const email = who && who.user && who.user.email;
    if (!email) return;

    const planName = PLAN_NAME[patch.active_plan] || 'your';
    const plan = PLANS[patch.active_plan];
    const points = plan ? plan.points : null;
    const site = ourSiteUrl();
    const who2 = p && p.business_name ? ', ' + p.business_name : '';
    const started = new Date().toLocaleDateString('en-GB',
      { day: 'numeric', month: 'long', year: 'numeric' });

    /* The three things someone actually wants confirmed after paying: which
       plan they are on, what it gets them each month, and from when. */
    const facts = [{ label: 'Plan', value: `one — ${planName}` }];
    if (plan) {
      facts.push({
        label: 'Monthly',
        value: `£${(plan.amount / 100).toFixed(0)}`
      });
      facts.push({
        label: 'Changes included',
        value: `${points} point${points === 1 ? '' : 's'} a month`
      });
    }
    facts.push({ label: 'Started', value: started });

    const result = await sendEmail({
      to: email,
      subject: "You're all set — welcome to one",
      text: `Welcome to one${who2} 👋\n\n`
          + `Your ${planName} plan is now active - thanks for signing up.\n\n`
          + (plan
              ? `Plan:             one - ${planName}\n`
                + `Monthly:          £${(plan.amount / 100).toFixed(0)}\n`
                + `Changes included: ${points} point${points === 1 ? '' : 's'} a month\n`
                + `Started:          ${started}\n\n`
              : '')
          + `We'll be in touch as we start building your site. In the meantime, you can see `
          + `everything from your account - your plan, your requests, and your site once it's live.\n\n`
          + `Your account: ${site}/account.html`,
      html: emailHtml({
        preheader: `Your ${planName} plan is active. Here's what happens next.`,
        heading: `Welcome to one${who2} 👋`,
        lines: [
          `Your <strong>${esc(planName)}</strong> plan is now active &mdash; thanks for signing up.`,
          `We&rsquo;ll be in touch shortly as we start building your site. Everything lives in your account from here: your plan, the changes you ask for, and your site once it&rsquo;s live.`
        ],
        details: facts,
        ctaText: 'Go to your account',
        ctaHref: `${site}/account.html`,
        ctaNote: 'Nothing else to do for now &mdash; we&rsquo;ll come to you.',
        footer: 'You&rsquo;re getting this because you started a plan with one, by Kanvas.',
        footerLinks: standardFooter(site)
      })
    });
    console.log('webhook: welcome email', result);
  }

  /* The subscription is already gone by the time this fires - both sides
     need telling: the customer, since their site and domain are now at
     risk, and us, since cancelling a domain is still a manual job. */
  async function announceCancellation(id) {
    const { data: p } = await admin
      .from('profiles')
      .select('business_name, site_url, requested_domain, domain_owned')
      .eq('id', id)
      .maybeSingle();
    const { data: who } = await admin.auth.admin.getUserById(id);
    const email = who && who.user && who.user.email;
    const name = (p && p.business_name) || 'A customer';
    const site = ourSiteUrl();

    if (email) {
      const result = await sendEmail({
        to: email,
        subject: 'Your plan has ended',
        text: `We weren't able to take payment after several attempts, so your one plan has now ended.\n\n`
            + `Your site and domain may be affected - please get in touch as soon as you can if you'd `
            + `like to keep them, or reactivate your plan any time from your account:\n${site}/account.html`,
        html: emailHtml({
          preheader: 'Your site and web address are at risk — here’s how to put it back.',
          heading: 'Your plan has ended.',
          lines: [
            'We weren’t able to take payment after several attempts, so your plan has now ended.',
            'Reactivating puts everything back as it was &mdash; your site, your web address and the changes you have left this month.'
          ],
          details: [
            { label: 'Business', value: name },
            { label: 'Site', value: (p && p.site_url) || 'not live yet' },
            { label: 'Web address', value: (p && p.requested_domain) || '—' },
            { label: 'Status', value: 'Ended' }
          ],
          ctaText: 'Reactivate your plan',
          ctaHref: `${site}/account.html`,
          callout: {
            text: 'Your site and web address are at risk while the plan is inactive. '
                + 'If you would like to keep them, please get in touch as soon as you can.'
          },
          footer: 'You&rsquo;re getting this because your plan with one, by Kanvas has ended.',
          footerLinks: standardFooter(site)
        })
      });
      console.log('webhook: cancellation email', result);
    }

    const domainLine = (p && (p.site_url || p.requested_domain)) || 'no domain on file';
    const adminResult = await sendEmail({
      to: adminAddresses(),
      subject: `${name}'s plan ended - check their domain`,
      text: `${name}'s subscription ended after failed payment retries.\n\n`
          + `Domain: ${domainLine}\n\n`
          + `If you don't hear from them, you may need to cancel or release it, and take their site down.\n\n`
          + `Admin: ${site}/admin.html`
    });
    console.log('webhook: cancellation admin email', adminResult);
  }

  /* Only the first failed attempt in a billing cycle - Smart Retries tries
     again automatically over the days that follow, and a fresh email for
     every one of those attempts would be noise, not news. */
  async function announcePaymentFailed(invoice) {
    if (invoice.attempt_count && invoice.attempt_count > 1) return;

    const customerId = typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer && invoice.customer.id);
    if (!customerId) return;
    const { data: p } = await admin
      .from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle();
    if (!p) return;

    const { data: who } = await admin.auth.admin.getUserById(p.id);
    const email = who && who.user && who.user.email;
    if (!email) return;

    const site = ourSiteUrl();

    /* Stripe reports the outstanding amount in the smallest currency unit,
       and the retry window is the 7 days Smart Retries is configured for. */
    const due = typeof invoice.amount_due === 'number' ? invoice.amount_due : null;
    const amountDue = due == null
      ? '—'
      : new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: (invoice.currency || 'gbp').toUpperCase(),
          minimumFractionDigits: due % 100 === 0 ? 0 : 2
        }).format(due / 100);
    const retryUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

    const result = await sendEmail({
      to: email,
      subject: "We couldn't take payment for your plan",
      text: `We tried to charge the card on file for your one plan and it didn't go through.\n\n`
          + `Amount due:     ${amountDue}\n`
          + `Retrying until: ${retryUntil}\n\n`
          + `We'll automatically retry over the next 7 days - to make sure it goes through, you can `
          + `update your card any time from your account:\n${site}/account.html\n\n`
          + `If payment still hasn't gone through after 7 days your plan will end, and your site `
          + `and web address will be at risk.`,
      html: emailHtml({
        preheader: 'We’ll retry over the next 7 days — updating your card fixes it straight away.',
        heading: 'We couldn’t take payment.',
        lines: [
          'We tried to charge the card on file for your plan and it didn’t go through. It happens &mdash; usually an expired card or a bank check.',
          'We’ll retry automatically over the next 7 days. Updating your card sorts it immediately.'
        ],
        details: [
          { label: 'Amount due', value: amountDue },
          { label: 'Next retry', value: 'Within 3 days' },
          { label: 'Retrying until', value: retryUntil }
        ],
        ctaText: 'Update payment details',
        ctaHref: `${site}/account.html`,
        callout: {
          text: 'If payment still hasn’t gone through after 7 days your plan will end, '
              + 'and your site and web address will be at risk.'
        },
        footer: 'You&rsquo;re getting this because a payment for your one plan was declined.',
        footerLinks: standardFooter(site)
      })
    });
    console.log('webhook: payment failed email', result);
  }

  /* Everything worth knowing to start the build, in one message. Without this
     a payment lands in the database and nothing says so. */
  async function announceNewCustomer(id, patch) {
    const { data: p } = await admin
      .from('profiles')
      .select('business_name, contact_name, phone, business_type, requested_domain, domain_owned, site_goals')
      .eq('id', id)
      .maybeSingle();

    const { data: who } = await admin.auth.admin.getUserById(id);
    const email = (who && who.user && who.user.email) || 'unknown';
    const name = (p && p.business_name) || 'A new customer';

    const domainLine = p && p.requested_domain
      ? `${p.requested_domain}${p.domain_owned ? ' (they already own it - move it across)' : ' (to register)'}`
      : 'none chosen yet';

    const lines = [
      `${name} is on ${patch.active_plan || 'a plan'}.`,
      '',
      `Contact:   ${(p && p.contact_name) || '-'} <${email}>`,
      `Phone:     ${(p && p.phone) || '-'}`,
      `Trade:     ${(p && p.business_type) || '-'}`,
      `Address:   ${domainLine}`,
      '',
      'What they want the site to do:',
      (p && p.site_goals) || '-',
      '',
      `Admin: ${ourSiteUrl()}/admin.html`
    ];

    const result = await sendEmail({
      to: adminAddresses(),
      subject: `New ${patch.active_plan || ''} customer: ${name}`.replace(/\s+/g, ' ').trim(),
      text: lines.join('\n'),
      replyTo: email !== 'unknown' ? email : undefined
    });
    console.log('webhook: new customer email', result);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          if (!sub.metadata || !sub.metadata.supabase_user_id) {
            sub.metadata = Object.assign({}, sub.metadata, {
              supabase_user_id: session.client_reference_id || ''
            });
          }
          await writeSubscription(sub);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await writeSubscription(event.data.object);
        break;

      /* Every renewal produces a paid invoice, and re-reading the subscription
         from it is what makes a scheduled downgrade actually take effect: the
         plan is held until plan_effective_at passes, so something has to look
         again once it has. customer.subscription.updated usually fires at a
         renewal too, but "usually" is not good enough to hang a customer's
         allowance on, and writeSubscription is idempotent so arriving twice
         costs nothing. */
      case 'invoice.paid': {
        const subId = subscriptionIdOf(event.data.object);
        if (subId) await writeSubscription(await stripe.subscriptions.retrieve(subId));
        break;
      }

      case 'invoice.payment_failed':
        await announcePaymentFailed(event.data.object);
        break;

      default:
        // Everything else is ignored on purpose.
        break;
    }
  } catch (err) {
    // 500 makes Stripe retry, which is what we want for a transient failure.
    console.error('webhook handling failed:', err && err.message);
    return res.status(500).end('Handler error');
  }

  return res.status(200).json({ received: true });
};
