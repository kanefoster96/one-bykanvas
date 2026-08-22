/* Stripe -> Supabase. The only thing that may set a subscription as active.
 *
 * Every request is signature-checked against STRIPE_WEBHOOK_SECRET before it
 * is trusted, which is why the raw body is needed: Vercel's JSON parsing would
 * change the bytes and break verification.
 */
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

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
    console.error('webhook: missing environment variables');
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

  async function writeSubscription(sub) {
    const id = await profileIdFor(sub);
    if (!id) {
      console.error('webhook: no profile for customer', sub.customer);
      return;
    }
    const periodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

    const patch = {
      id,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      current_period_end: periodEnd
    };
    if (sub.metadata && sub.metadata.plan) patch.selected_plan = sub.metadata.plan;

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
