/* Stripe -> Supabase. The only thing that may set a subscription as active.
 *
 * Every request is signature-checked against STRIPE_WEBHOOK_SECRET before it
 * is trusted, which is why the raw body is needed: Vercel's JSON parsing would
 * change the bytes and break verification.
 */
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');

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
    patch.active_plan = isLive(sub.status) && sub.metadata && sub.metadata.plan
      ? sub.metadata.plan
      : null;

    const { error } = await admin.from('profiles').upsert(patch, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    console.log('webhook: %s -> %s (live: %s)', id, sub.status, isLive(sub.status));
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
