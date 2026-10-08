/* Opens a Stripe Checkout Session for a plan, for a customer whose
 * account is already known. Shared by checkout.js (the get-started wizard and
 * the account page, which prove who is asking first) and join.js (Starter,
 * paid before the account has a password).
 *
 * Throws a CheckoutError with a status and a message safe to show; anything
 * else that throws is a 500.
 */
const { PLANS, PREVIEW_OFFER } = require('./_plans.js');

class CheckoutError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function openCheckout({ stripe, admin, user, profile, plan, billing, offer, referralCode,
                              origin, successUrl, cancelUrl, metadata }) {
  /* ---- referral code, if they brought one -----------------------------
   *
   * Validated now, at the moment a typo can still be fixed, and stamped on
   * the buyer's profile before Stripe opens. The reward itself waits for
   * the webhook: it is granted when this subscription first goes live, so
   * an abandoned checkout earns nobody anything. First code wins - a
   * retried checkout cannot swap referrers.
   */
  const refCode = String(referralCode || '').trim().toUpperCase();
  if (refCode) {
    if (!/^[A-Z0-9-]{4,20}$/.test(refCode)) {
      throw new CheckoutError(400, "That referral code doesn't look right - check it or leave it blank.");
    }
    const { data: referrer, error: refErr } = await admin.from('profiles')
      .select('id').ilike('referral_code', refCode).maybeSingle();
    if (refErr) throw new Error(refErr.message);
    if (!referrer) {
      throw new CheckoutError(400, "That referral code doesn't look right - check it or leave it blank.");
    }
    if (referrer.id === user.id) {
      throw new CheckoutError(400, 'You cannot refer yourself - share your code with another business instead.');
    }
    if (!(profile && profile.referred_by)) {
      const { error: stampErr } = await admin.from('profiles')
        .upsert({ id: user.id, referred_by: referrer.id, referred_by_code: refCode }, { onConflict: 'id' });
      if (stampErr) throw new Error(stampErr.message);
    }
  }

  let customerId = profile && profile.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: (profile && profile.business_name) || undefined,
      metadata: { supabase_user_id: user.id }
    });
    customerId = customer.id;
    await admin.from('profiles')
      .upsert({ id: user.id, stripe_customer_id: customerId }, { onConflict: 'id' });
  }

  // ---- the session ----------------------------------------------------

  /* An offer code arriving from the browser is a claim, not a discount.
     Stripe is asked whether it is real, and only what Stripe returns is
     used - so a made-up code, an expired one, or one somebody typed into
     the URL themselves simply does not resolve, and checkout carries on at
     full price rather than failing.

     discounts and allow_promotion_codes cannot both be set. With a code
     that resolved, it is applied for them; without one, the box on the
     payment page stays available for anyone typing it by hand. */
  let discounts = null;
  /* Annual is ten months' money for twelve. WELCOME26 is "50% off the
     first invoice" - on a subscription whose one invoice is the whole
     year that halves the year, so codes are monthly-only: ignored here
     and the code box withheld on the Stripe page for annual sessions. */
  const annual = String(billing || '').toLowerCase() === 'annual'
    && Number.isFinite(PLANS[plan].yearly);
  /* Every new monthly Business or Max customer gets the first month at
     half price: the site says so, so it is applied whether or not they
     carried a code. Starter's £9.99 is the offer itself, so it never gets
     the half-price code, but a partner or referral code still applies.
     A partner or referral code they did bring wins. */
  const brought = String(offer || '').trim().toUpperCase();
  const wanted = annual ? ''
    : plan === 'starter' ? (brought === PREVIEW_OFFER.code ? '' : brought)
    : (brought || PREVIEW_OFFER.code);
  if (wanted && /^[A-Z0-9._-]{3,40}$/.test(wanted)) {
    try {
      const found = await stripe.promotionCodes.list({ code: wanted, active: true, limit: 1 });
      const promo = found && found.data && found.data[0];
      if (promo) {
        discounts = [{ promotion_code: promo.id }];
        /* A code that belongs to a partner attributes the customer to
           them - once, first partner wins - so the webhook can pay them a
           quarter of each invoice. Only a code Stripe actually applied counts:
           "payments made using their code" means the discount ran. */
        try {
          const { data: partner } = await admin.from('partners')
            .select('id').ilike('code', wanted).maybeSingle();
          if (partner && !(profile && profile.partner_id)) {
            await admin.from('profiles')
              .upsert({ id: user.id, partner_id: partner.id, partner_code: wanted }, { onConflict: 'id' });
          }
        } catch (e) {
          console.error('checkout: partner stamp failed:', e && e.message);
        }
      }
      else console.log('checkout: offer %s did not resolve', wanted);
    } catch (e) {
      /* A lookup that fails is not a reason to block a sale. */
      console.error('checkout: offer lookup failed:', e && e.message);
    }
  }

  // ---- the session -----------------------------------------------------
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'gbp',
        unit_amount: annual ? PLANS[plan].yearly : PLANS[plan].amount,
        recurring: { interval: annual ? 'year' : 'month' },
        product_data: { name: PLANS[plan].label + (annual ? ' — Annual (2 months free)' : '') }
      }
    }],
    subscription_data: { metadata: { supabase_user_id: user.id, plan } },
    metadata: Object.assign({}, metadata, { supabase_user_id: user.id, plan }),
    success_url: successUrl || `${origin}/account.html?checkout=success`,
    cancel_url: cancelUrl || `${origin}/account.html?checkout=cancelled`,
    /* No code box on Starter: £9.99 is the offer, and the box would let
       the half-price code be typed in by hand. A partner's code still
       applies, from their link (the offer, resolved above). */
    ...(discounts ? { discounts } : (annual || plan === 'starter') ? {} : { allow_promotion_codes: true })
  });

  return session;
}

module.exports = { openCheckout, CheckoutError };
