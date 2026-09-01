/* Admin endpoint: everything the admin page can see or change goes through
 * here.
 *
 * The gate is in this file, not in the browser. The caller's Supabase token is
 * verified, the email on it is checked against the admin list, and only then is
 * the service role used. The pill in the site nav is cosmetic - it reads the
 * session the browser already has so the link appears for the right person -
 * and forging it gets you a link to a page that this endpoint refuses to feed.
 *
 * ADMIN_EMAILS (comma separated) overrides the default if it is ever more than
 * one person.
 */
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { missingEnv, ourSiteUrl } = require('./_env.js');
const { REQUEST_COST, PLANS } = require('./_plans.js');
const { sendEmail, sendBatch } = require('./_email.js');
const { html: emailHtml, standardFooter, esc } = require('./_email_template.js');
const { unsubscribeHeaders, unsubscribeUrl, optedOut } = require('./_unsubscribe.js');
const { shortfallFor } = require('./_billing.js');
const { lookup: domainLookup } = require('./domains.js');
const { notify } = require('./_notify.js');

const DEFAULT_ADMINS = ['kane@kanvas.one'];

/* The code offered when a free example goes out. It is a real promotion code
   in Stripe - checkout already accepts codes, so nothing here has to apply it;
   the customer types it and Stripe does the rest. Changing the discount means
   changing it in Stripe, not here: this is only the word we print. */
const PREVIEW_OFFER = { code: 'WELCOME26' };

function adminList() {
  const fromEnv = (process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ADMINS;
}

/* Charges the card on file off-session, for a shortfall already worked out
 * by the caller. Shared by accepting a request (the normal path - before any
 * work starts) and the legacy done-stage charge button. Throws a plain Error
 * with .httpStatus set on anything the caller should show rather than a 500 -
 * no card on file, a decline, or a payment that did not complete. */
async function chargeCardForRequest(stripe, profile, reqRow, amount) {
  if (!profile || !profile.stripe_customer_id) {
    const e = new Error('No card on file for them yet.'); e.httpStatus = 400; throw e;
  }

  const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
  let paymentMethodId = customer && customer.invoice_settings
    && customer.invoice_settings.default_payment_method;
  if (!paymentMethodId) {
    const pms = await stripe.paymentMethods.list({ customer: profile.stripe_customer_id, type: 'card' });
    paymentMethodId = pms.data[0] && pms.data[0].id;
  }
  if (!paymentMethodId) {
    const e = new Error('No card on file for them — ask them to add one from their account page.');
    e.httpStatus = 400; throw e;
  }

  let pi;
  try {
    pi = await stripe.paymentIntents.create({
      amount, currency: 'gbp',
      customer: profile.stripe_customer_id,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: (reqRow.kind === 'feature' ? 'Feature request' : 'Edit request')
        + (profile.business_name ? ' — ' + profile.business_name : ''),
      metadata: { request_id: reqRow.id, supabase_user_id: reqRow.user_id }
    });
  } catch (err) {
    if (err && err.type === 'StripeCardError') {
      const e = new Error('Card declined: ' + (err.message || 'ask them to update their card.'));
      e.httpStatus = 400; throw e;
    }
    throw err;
  }

  if (pi.status !== 'succeeded') {
    const e = new Error('Payment did not complete (status: ' + pi.status + '). '
      + 'Ask them to confirm it from their end, or update their card.');
    e.httpStatus = 400; throw e;
  }

  return pi;
}


/* Who a broadcast goes to.
 *
 * Every audience is filtered to marketing_optin first, so an opt-out cannot be
 * undone by picking a different group. "contacts" is people who signed up and
 * never bought - the ones worth telling about a plan; "customers" is anyone
 * paying, and a plan name narrows that to one tier.
 *
 * Enquiries from the public form are deliberately not here. They have no
 * account, so there is nowhere to record a preference and no way to give them
 * a working unsubscribe link - and an unsubscribe that does not work is worse
 * than not asking.
 */
function inAudience(p, audience) {
  if (!p.marketing_optin) return false;
  const paying = p.subscription_status === 'active' || p.subscription_status === 'trialing';
  if (audience === 'all') return true;
  if (audience === 'customers') return paying;
  if (audience === 'contacts') return !paying;
  return paying && p.active_plan === audience;
}

const AUDIENCES = ['all', 'customers', 'contacts'].concat(Object.keys(PLANS));

/* Tells a customer a feature on their site was added or updated - best
   effort, same reasoning as everywhere else email is sent here: the change
   itself already took effect, so a failed send delays them finding out
   rather than blocking anything. */
async function notifyFeatureEmail(db, userId, name, verb) {
  /* The one customer email that is genuinely optional - it carries an
     unsubscribe header, so it has to actually stop when someone uses it.
     Offering the choice and then ignoring it is worse than never offering. */
  if (await optedOut(db, userId)) {
    console.log('admin: feature notify skipped, customer opted out');
    return;
  }

  const { data: who } = await db.auth.admin.getUserById(userId);
  const customerEmail = who && who.user && who.user.email;
  if (!customerEmail) return;

  const site = ourSiteUrl();
  const heading = verb === 'updated' ? 'Updated on your site' : 'New on your site';
  const unsubUrl = unsubscribeUrl(userId);
  const result = await sendEmail({
    to: customerEmail,
    headers: unsubscribeHeaders(userId),
    subject: `A feature on your site was ${verb}`,
    text: `We've ${verb} a feature on your site: "${name}".\n\n`
        + `See it on your account page:\n${site}/account.html`
        + (unsubUrl ? `\n\nDon't want these? ${unsubUrl}` : ''),
    html: emailHtml({
      preheader: `${name} is ${verb} on your site.`,
      heading,
      lines: [
        verb === 'updated'
          ? `We&rsquo;ve made an improvement to something already on your site &mdash; nothing for you to do, it&rsquo;s live now.`
          : `Something new has been added to your site. It&rsquo;s live now, so have a look when you get a minute.`
      ],
      details: [
        { label: 'Feature', value: name },
        { label: 'Change', value: verb === 'updated' ? 'Updated' : 'Added' },
        { label: 'Date', value: new Date().toLocaleDateString('en-GB',
            { day: 'numeric', month: 'long', year: 'numeric' }) }
      ],
      ctaText: 'See it on your account',
      ctaHref: `${site}/account.html`,
      footer: 'You&rsquo;re getting this because your site with one, by Kanvas was changed.'
        + (unsubUrl ? ' <a href="' + unsubUrl + '" style="color:#86868b;">Turn these off</a>.' : ''),
      footerLinks: standardFooter(site)
    })
  });
  console.log('admin: feature notify email', result);
}

/* The moment a build actually finishes - the one email in this whole system
 * a customer has been waiting the longest for. */
async function notifySiteLive(db, userId, businessName, siteUrl) {
  const { data: who } = await db.auth.admin.getUserById(userId);
  const customerEmail = who && who.user && who.user.email;
  if (!customerEmail) return;

  const href = /^https?:\/\//i.test(siteUrl) ? siteUrl : 'https://' + siteUrl;
  const shown = href.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const site = ourSiteUrl();

  const result = await sendEmail({
    to: customerEmail,
    subject: 'Your site is live',
    text: `${businessName || 'Your site'} is live at ${shown}.\n\n`
        + `Have a look, and let us know if there's anything you'd like changed.\n\n`
        + `Manage your account: ${site}/account.html`,
    html: emailHtml({
      /* heading is escaped inside the shell, so the raw name goes in here -
         escaping it twice turned an ampersand into &amp;amp; on the page. */
      preheader: `${shown} is live. Have a look and tell us what you think.`,
      heading: `${businessName || 'Your site'} is live 🎉`,
      lines: [
        `It&rsquo;s built, it&rsquo;s online, and it&rsquo;s yours.`,
        `Have a look through, and let us know if there&rsquo;s anything you&rsquo;d like changed &mdash; that&rsquo;s what your monthly changes are for.`
      ],
      details: [
        { label: 'Business', value: businessName || '—' },
        { label: 'Web address', value: shown },
        { label: 'Status', value: 'Live' }
      ],
      ctaText: 'View your site',
      ctaHref: href,
      ctaNote: 'Ask for a change any time from your account.',
      footer: 'You&rsquo;re getting this because your site with one, by Kanvas has gone live.',
      footerLinks: standardFooter(site)
    })
  });
  console.log('admin: site live email', result);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('admin: missing environment variables:',
      missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
                  'SUPABASE_PUBLISHABLE_KEY']).join(', ') || '(none named)');
    return res.status(500).json({ error: 'Not configured.' });
  }

  try {
    // ---- who is asking, and are they allowed? --------------------------
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Please log in.' });

    const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY || SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await anon.auth.getUser(token);
    if (userError || !userData || !userData.user) {
      return res.status(401).json({ error: 'Your session has expired.' });
    }
    const me = userData.user;
    const email = String(me.email || '').toLowerCase();

    // A confirmed email as well as a matching one: an unconfirmed address is
    // not proof of anything.
    if (!adminList().includes(email) || !me.email_confirmed_at) {
      // Same response either way, so this cannot be used to probe for admins.
      return res.status(404).json({ error: 'Not found.' });
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || '');

    // ---- read: every customer, newest first ----------------------------
    if (action === 'list') {
      const { data: profiles, error } = await db
        .from('profiles')
        /* stripe_subscription_id has to be here: the membership panel decides
           whether there is anything to cancel from it, and without it every
           customer - paying or not - read as "no subscription" while the
           delete panel, reading subscription_status, still refused to delete
           them. A paying customer was unmanageable from both sides. */
        .select('id, business_name, contact_name, phone, business_type, active_plan, selected_plan, ' +
                'subscription_status, current_period_end, points_reset_at, site_url, site_status, requested_domain, domain_owned, ' +
                'address, service_area, opening_hours, services, site_goals, site_uses, existing_links, ' +
                'admin_notes, created_at, stripe_customer_id, stripe_subscription_id, campaign_from')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);

      // Emails live in auth.users, not on profiles - without this join the
      // admin page has no way to show or contact anyone. Best effort: a
      // profile whose auth row can't be found just shows without an email
      // rather than failing the whole list.
      const emailById = {};
      for (let page = 1; page <= 5; page++) {
        const { data: usersPage, error: usersErr } = await db.auth.admin.listUsers({ page, perPage: 200 });
        if (usersErr) { console.error('admin: listUsers failed:', usersErr.message); break; }
        const users = (usersPage && usersPage.users) || [];
        users.forEach((u) => { emailById[u.id] = { email: u.email, lastSignIn: u.last_sign_in_at }; });
        if (users.length < 200) break;
      }
      (profiles || []).forEach((p) => {
        const u = emailById[p.id];
        p.email = (u && u.email) || null;
        p.last_sign_in_at = (u && u.lastSignIn) || null;
      });

      const { data: reqs, error: reqError } = await db
        .from('requests')
        .select('id, user_id, kind, points, detail, status, created_at, billed_at, billed_amount, confirm_token, attachment_paths')
        .order('created_at', { ascending: false })
        .limit(500);
      if (reqError) throw new Error(reqError.message);

      // The bucket is private, so a plain path is useless to the browser -
      // one short-lived signed URL per screenshot, generated with the
      // service role since our own admin session has no storage access to
      // a customer's folder.
      const allPaths = (reqs || []).flatMap((r) => r.attachment_paths || []);
      let signedByPath = {};
      if (allPaths.length) {
        const { data: signedList, error: signErr } = await db.storage
          .from('request-attachments').createSignedUrls(allPaths, 3600);
        if (signErr) throw new Error(signErr.message);
        (signedList || []).forEach((s) => { if (s.signedUrl) signedByPath[s.path] = s.signedUrl; });
      }

      // confirm_token is a legacy field - nothing sets it any more, so it is
      // left out of the response rather than surfaced as anything to react to.
      const shaped = (reqs || []).map(({ confirm_token, attachment_paths, ...r }) =>
        Object.assign(r, {
          attachments: (attachment_paths || []).map((p) => signedByPath[p]).filter(Boolean)
        }));

      // Both active and retired, so a retired one can still be brought back
      // rather than needing to be typed out again.
      const { data: templates, error: tplError } = await db
        .from('templates')
        .select('id, kind, name, description, admin_notes, admin_images, active, created_at')
        .order('created_at', { ascending: false });
      if (tplError) throw new Error(tplError.message);

      /* The bucket is private and admin-only, so the browser needs signed
         URLs the same way request screenshots do. */
      const tplPaths = (templates || []).flatMap((t) => t.admin_images || []);
      let tplSigned = {};
      if (tplPaths.length) {
        const { data: signedTpl, error: tplSignErr } = await db.storage
          .from('template-assets').createSignedUrls(tplPaths, 3600);
        if (tplSignErr) throw new Error(tplSignErr.message);
        (signedTpl || []).forEach((x) => { if (x.signedUrl) tplSigned[x.path] = x.signedUrl; });
      }
      (templates || []).forEach((t) => {
        t.images = (t.admin_images || []).map((p) => ({ path: p, url: tplSigned[p] })).filter((x) => x.url);
      });

      // Logged history of monthly SEO updates for Max customers - enough
      // rows to tell whether this billing period already has one, and to
      // show the log itself on a customer's page.
      const { data: seoUpdates, error: seoError } = await db
        .from('seo_updates')
        .select('id, user_id, note, created_at')
        .order('created_at', { ascending: false })
        .limit(300);
      if (seoError) throw new Error(seoError.message);

      // Everything a customer's site can do - updated_at (not created_at) is
      // what the 30-day NEW pill is measured against, bumped by "mark as
      // updated" as well as on insert.
      const { data: siteFeatures, error: sfError } = await db
        .from('site_features')
        .select('id, user_id, name, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1000);
      if (sfError) throw new Error(sfError.message);

      return res.status(200).json({
        profiles: profiles || [], requests: shaped, templates: templates || [],
        seoUpdates: seoUpdates || [], siteFeatures: siteFeatures || []
      });
    }

    // ---- write: the site address and whether it is live ----------------
    if (action === 'setSite') {
      const userId = String(body.userId || '');
      const siteUrl = body.siteUrl == null ? null : String(body.siteUrl).trim();
      const siteStatus = String(body.siteStatus || 'building');
      if (!userId) return res.status(400).json({ error: 'Which customer?' });
      if (!['building', 'live', 'paused'].includes(siteStatus)) {
        return res.status(400).json({ error: 'Unknown site status.' });
      }
      // A site cannot be live without an address to be live at.
      if (siteStatus === 'live' && !siteUrl) {
        return res.status(400).json({ error: 'Add the address before marking it live.' });
      }

      const { data: before, error: beforeErr } = await db
        .from('profiles').select('site_status, business_name').eq('id', userId).maybeSingle();
      if (beforeErr) throw new Error(beforeErr.message);

      const { error } = await db
        .from('profiles')
        .update({ site_url: siteUrl || null, site_status: siteStatus })
        .eq('id', userId);
      if (error) throw new Error(error.message);

      // Told the moment it actually goes live, not on every save of this
      // form - re-saving an already-live address should not re-announce it.
      if (siteStatus === 'live' && before && before.site_status !== 'live') {
        await notifySiteLive(db, userId, before.business_name, siteUrl);
        await notify(db, userId, 'Your site is live', 'It\u2019s up at ' + siteUrl + '.', siteUrl);
      }

      return res.status(200).json({ ok: true });
    }

    /* ---- write: the address a Pro customer's campaigns send from ------
     *
     * Setting this is what switches email marketing on for them: the send
     * endpoint refuses until it is here. It is set from this page rather
     * than by the customer because it only works once their domain is
     * verified with the email provider - a manual job on our side - and a
     * wrong value is a deliverability problem on a domain we look after.
     */
    if (action === 'setCampaignFrom') {
      const userId = String(body.userId || '');
      const fromAddr = String(body.fromAddress || '').trim().toLowerCase();
      if (!userId) return res.status(400).json({ error: 'Which customer?' });
      if (fromAddr && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAddr)) {
        return res.status(400).json({ error: 'That does not look like an email address.' });
      }

      const { data: before, error: beforeErr } = await db.from('profiles')
        .select('campaign_from, business_name').eq('id', userId).maybeSingle();
      if (beforeErr) throw new Error(beforeErr.message);

      const { error } = await db.from('profiles')
        .update({ campaign_from: fromAddr || null }).eq('id', userId);
      if (error) throw new Error(error.message);

      // Told once, when it first goes from off to on - not on every edit.
      if (fromAddr && before && !before.campaign_from) {
        await notify(db, userId, 'Email marketing is ready',
          'Your campaigns now send from ' + fromAddr + '. Build your customer list and send your first one from your account page.',
          '/account.html');
      }

      return res.status(200).json({ ok: true });
    }

    /* ---- is this membership already set to end? -----------------------
     *
     * Asked of Stripe rather than kept in a column here. cancel_at_period_end
     * is the sort of thing that goes stale quietly - changed in the Stripe
     * dashboard, or a webhook that did not land - and a stale answer here
     * means the page offers to cancel something already cancelled. One call,
     * only when a customer is actually opened.
     */
    if (action === 'subscriptionState') {
      const userId = String(body.userId || '');
      if (!userId) return res.status(400).json({ error: 'Which customer?' });

      const { data: who, error: whoErr } = await db
        .from('profiles').select('stripe_subscription_id').eq('id', userId).maybeSingle();
      if (whoErr) throw new Error(whoErr.message);
      if (!who || !who.stripe_subscription_id) {
        return res.status(200).json({ ok: true, subscription: null });
      }

      const { STRIPE_SECRET_KEY } = process.env;
      if (!STRIPE_SECRET_KEY) return res.status(200).json({ ok: true, subscription: null });

      const stripe = new Stripe(STRIPE_SECRET_KEY);
      let sub;
      try {
        sub = await stripe.subscriptions.retrieve(who.stripe_subscription_id);
      } catch (e) {
        /* A subscription Stripe has forgotten is not an error worth blocking
           the page for - the rest of the customer's detail is still useful. */
        console.error('admin: subscription lookup failed:', e && e.message);
        return res.status(200).json({ ok: true, subscription: null });
      }

      const endsAt = sub.cancel_at || (sub.items && sub.items.data || [])
        .reduce((acc, i) => Math.max(acc, i.current_period_end || 0), 0) || null;
      return res.status(200).json({
        ok: true,
        subscription: {
          status: sub.status,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          endsAt: endsAt ? new Date(endsAt * 1000).toISOString() : null
        }
      });
    }

    /* ---- the free-example queue ----------------------------------------
     *
     * Enquiries and free examples both live in leads. They are read here
     * rather than in the main list because they are nobody's dashboard: this
     * is a work queue, opened when there is work to do.
     */
    if (action === 'listLeads') {
      const COLS = 'id, name, business, email, about, plan_interest, want_app, '
                 + 'source, handle, requested_domain, preview_url, preview_sent_at, created_at';
      /* Two reads on purpose. The recent page is capped, and once enquiries
         pass the cap the oldest rows fall off it - which must never include a
         free example still waiting to be made. Those are fetched outright. */
      const [recent, waiting] = await Promise.all([
        db.from('leads').select(COLS).order('created_at', { ascending: false }).limit(500),
        db.from('leads').select(COLS)
          .eq('source', 'free-preview').is('preview_sent_at', null)
      ]);
      if (recent.error) throw new Error(recent.error.message);
      if (waiting.error) throw new Error(waiting.error.message);
      const seen = new Set((recent.data || []).map((r) => r.id));
      const rows = (recent.data || []).concat((waiting.data || []).filter((r) => !seen.has(r.id)));
      return res.status(200).json({ leads: rows });
    }

    if (action === 'deleteLead') {
      const id = String(body.leadId || '');
      if (!id) return res.status(400).json({ error: 'Which one?' });
      const { error } = await db.from('leads').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    /* ---- sending somebody their finished example -----------------------
     *
     * Everything in the email comes from the row: their business, the address
     * they picked, the social we designed from. The only thing typed here is
     * where the example lives, because that is the only thing we did not
     * already know.
     */
    if (action === 'sendPreview') {
      const id = String(body.leadId || '');
      const url = String(body.url || '').trim();
      if (!id) return res.status(400).json({ error: 'Which one?' });
      if (!/^https:\/\/[^\s]+\.[^\s]{2,}/i.test(url)) {
        return res.status(400).json({ error: 'That needs to be a full https:// address.' });
      }

      const { data: lead, error: leadErr } = await db
        .from('leads').select('*').eq('id', id).maybeSingle();
      if (leadErr) throw new Error(leadErr.message);
      if (!lead) return res.status(404).json({ error: 'That request is gone.' });

      /* Sending twice reads as not knowing what you are doing, so it takes a
         deliberate second ask rather than a second click. */
      if (lead.preview_sent_at && !body.again) {
        return res.status(409).json({
          error: 'This one was already sent ' + new Date(lead.preview_sent_at).toDateString()
               + '. Send it again only if you meant to.'
        });
      }

      const site = ourSiteUrl();
      const facts = [{ label: 'Business', value: lead.business }];

      /* Asked again, not assumed. They picked this days ago and nothing was
         reserved, so "still available" has to be checked at the moment we say
         it - and when the registries cannot be reached, it says nothing at all
         rather than guessing in either direction. */
      let domainState = 'unknown';
      if (lead.requested_domain) {
        try {
          domainState = await domainLookup(lead.requested_domain);
        } catch (e) {
          console.error('admin: domain re-check failed:', e && e.message);
        }
        facts.push({
          label: 'Address',
          value: lead.requested_domain,
          tag: domainState === 'free'  ? { text: 'Still available' }
             : domainState === 'taken' ? { text: 'Now taken', tone: 'warn' }
             : null
        });
      }

      const perks = [
        'Nothing technical to set up. We put it live for you.',
        'No time lost. We build and look after it while you get on with the job.',
        'If anything breaks, we fix it. Included, and it never costs you a point.',
        'Your web address and hosting are in the monthly price, with nothing else to buy.'
      ];

      const sent = await sendEmail({
        to: lead.email,
        subject: `Your website is ready to look at, ${String(lead.business).replace(/[\r\n]+/g, ' ')}`,
        html: emailHtml({
          preheader: 'Here it is - the free one-page example you asked for.',
          heading: 'Your website is ready 🎁',
          lines: [
            `Here it is. We designed this for <strong>${esc(lead.business)}</strong> from `
              + `${lead.handle ? 'your ' + esc(lead.handle) : 'what you sent us'}, so it should `
              + `already look like you.`
          ].concat(domainState === 'taken'
            ? [`One thing: <strong>${esc(lead.requested_domain)}</strong> has been `
               + `registered by somebody else since you asked. Join and we&rsquo;ll find `
               + `you a good one that is free.`]
            : []),
          details: facts,
          ctaText: '🎁 See your website',
          ctaHref: url,
          /* The address bar will not say their name, and an unexplained one
             looks like a mistake. Said under the button, where they are about
             to see it. */
          ctaNote: lead.requested_domain && domainState !== 'taken'
            ? `This opens on a temporary address. ${esc(lead.requested_domain)} is yours when you join.`
            : 'This opens on a temporary address while it&rsquo;s an example.',
          offer: {
            code: PREVIEW_OFFER.code,
            href: `${site}/plans.html?offer=${encodeURIComponent(PREVIEW_OFFER.code)}`,
            text: '<strong>Want it online, properly?</strong><br>'
                + 'Tap the code for 50% off your first three months.',
            note: 'It comes with you &mdash; nothing to copy, and it is already '
                + 'on the bill when you pay. Works on any plan.'
          },
          perks: perks,
          footer: 'You&rsquo;re getting this because you asked us for a free example at '
                + 'kanvas.one. No account has been created and nothing has been charged.',
          footerLinks: standardFooter(site)
        }),
        text: `Here it is - the free example we made for ${lead.business}.\n\n`
            + `${url}\n\n`
            + (lead.requested_domain && domainState !== 'taken'
                ? `This opens on a temporary address. ${lead.requested_domain} is yours `
                  + `when you join${domainState === 'free' ? ' - it is still available' : ''}.\n\n`
                : `This opens on a temporary address while it's an example.\n\n`)
            + (domainState === 'taken'
                ? `${lead.requested_domain} has been registered by somebody else since you `
                  + `asked. Join and we'll find you a good one that is free.\n\n`
                : '')
            + `Want it online properly? 50% off your first three months with `
            + `${PREVIEW_OFFER.code}, on any plan:\n`
            + `${site}/plans.html?offer=${encodeURIComponent(PREVIEW_OFFER.code)}\n\n`
            + perks.map((t) => '- ' + t).join('\n') + '\n\n'
            + `See the plans: ${site}/plans.html\n`
      });

      /* sendEmail answers 'sent', 'skipped' or 'failed', and only the first
         may mark this done: stamping a failed send would show "Sent" in the
         queue while the customer waits for an email that never went. */
      if (sent !== 'sent') {
        console.error('admin: preview email for %s did not send: %s', id, sent);
        return res.status(502).json({
          error: 'The email did not send (' + sent + '). Nothing was marked, so you can try again.'
        });
      }

      const { error: markErr } = await db.from('leads')
        .update({ preview_url: url, preview_sent_at: new Date().toISOString() })
        .eq('id', id);
      if (markErr) throw new Error(markErr.message);

      console.log('admin: preview sent for %s', id);
      return res.status(200).json({ ok: true, sentAt: new Date().toISOString() });
    }

    /* ---- ending a membership ------------------------------------------
     *
     * At the period end, never immediately. The terms say cancel anytime with
     * no further payments, and that money already taken is not refunded - so
     * cutting someone off the moment the button is pressed would take away a
     * month they have paid for. Stripe bills nothing more and stops at the
     * renewal.
     *
     * Reversible on purpose. This is one button next to a customer's name, and
     * the cost of a mis-click should be another click, not a lost customer.
     */
    if (action === 'setCancelAtPeriodEnd') {
      const userId = String(body.userId || '');
      const cancel = Boolean(body.cancel);
      if (!userId) return res.status(400).json({ error: 'Which customer?' });

      const { STRIPE_SECRET_KEY } = process.env;
      if (!STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe is not configured.' });

      const { data: who, error: whoErr } = await db
        .from('profiles').select('stripe_subscription_id, subscription_status, business_name')
        .eq('id', userId).maybeSingle();
      if (whoErr) throw new Error(whoErr.message);
      if (!who || !who.stripe_subscription_id) {
        return res.status(400).json({ error: 'No subscription to change.' });
      }

      const stripe = new Stripe(STRIPE_SECRET_KEY);
      let sub;
      try {
        sub = await stripe.subscriptions.update(who.stripe_subscription_id,
          { cancel_at_period_end: cancel });
      } catch (e) {
        console.error('admin: cancel toggle failed:', e && e.message);
        return res.status(400).json({ error: e && e.message ? e.message : 'Stripe refused that.' });
      }

      /* Stripe is the record; the webhook mirrors it here a moment later. The
         answer carries the date so the page can say when it actually ends
         rather than waiting for that round trip. */
      const endsAt = sub.cancel_at || (sub.items && sub.items.data || [])
        .reduce((acc, i) => Math.max(acc, i.current_period_end || 0), 0) || null;
      console.log('admin: %s cancel_at_period_end=%s', userId, cancel);
      return res.status(200).json({
        ok: true,
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        endsAt: endsAt ? new Date(endsAt * 1000).toISOString() : null
      });
    }

    /* ---- deleting a contact -------------------------------------------
     *
     * Deletes the auth user; the profile, their requests and their features go
     * with it on the cascade. There is no undo, so the checks are here rather
     * than only in the browser, where a stale page could ask for something the
     * database has since changed its mind about.
     */
    if (action === 'deleteContact') {
      const userId = String(body.userId || '');
      if (!userId) return res.status(400).json({ error: 'Which contact?' });

      /* Deleting yourself would lock the only admin out of the admin page. */
      if (userId === me.id) {
        return res.status(400).json({ error: 'You cannot delete your own account here.' });
      }

      const { data: who, error: whoErr } = await db
        .from('profiles').select('subscription_status, stripe_subscription_id, business_name')
        .eq('id', userId).maybeSingle();
      if (whoErr) throw new Error(whoErr.message);

      /* A live subscription outlives the account it belonged to - Stripe does
         not know the customer is gone and keeps taking the money, with nobody
         left to email about it. End the plan first, deliberately.

         Asked of Stripe when there is a subscription to ask about, because the
         mirrored column is the one this file elsewhere refuses to trust: a
         webhook that never landed leaves it saying canceled while the billing
         runs on, and this is the one place that mistake cannot be undone. */
      let live = who && ['active', 'trialing', 'past_due', 'unpaid'].includes(who.subscription_status);
      if (who && who.stripe_subscription_id && !live) {
        const { STRIPE_SECRET_KEY } = process.env;
        if (STRIPE_SECRET_KEY) {
          try {
            const sub = await new Stripe(STRIPE_SECRET_KEY)
              .subscriptions.retrieve(who.stripe_subscription_id);
            live = ['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status);
          } catch (e) {
            /* A subscription Stripe has genuinely forgotten is not live. */
            console.log('admin: delete pre-check, Stripe lookup:', e && e.message);
          }
        }
      }
      if (live) {
        return res.status(400).json({
          error: 'This account still has a subscription. Cancel it first, or Stripe will keep billing them.'
        });
      }

      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) return res.status(400).json({ error: error.message });

      console.log('admin: deleted contact %s (%s)', userId, (who && who.business_name) || 'no name');
      return res.status(200).json({ ok: true });
    }

    // ---- write: admin's own notes about a customer - never shown to them ----
    /* ---- marketing: who would get this, and then sending it ------------ */
    if (action === 'broadcastAudience' || action === 'sendBroadcast') {
      const audience = String(body.audience || 'all');
      if (AUDIENCES.indexOf(audience) === -1) {
        return res.status(400).json({ error: 'Unknown audience.' });
      }

      const { data: people, error: peopleErr } = await db.from('profiles')
        .select('id, business_name, marketing_optin, subscription_status, active_plan');
      if (peopleErr) throw new Error(peopleErr.message);

      const chosen = (people || []).filter((p) => inAudience(p, audience));

      if (action === 'broadcastAudience') {
        const counts = {};
        AUDIENCES.forEach((a) => {
          counts[a] = (people || []).filter((p) => inAudience(p, a)).length;
        });
        return res.status(200).json({
          ok: true, counts, audience, count: chosen.length,
          optedOut: (people || []).filter((p) => !p.marketing_optin).length
        });
      }

      // ---- send ----
      const subject = String(body.subject || '').trim().slice(0, 200);
      const title = String(body.title || '').trim().slice(0, 200);
      const bodyText = String(body.body || '').trim().slice(0, 6000);
      const buttonText = String(body.buttonText || '').trim().slice(0, 60);
      const buttonUrl = String(body.buttonUrl || '').trim().slice(0, 500);
      const imageUrl = String(body.imageUrl || '').trim().slice(0, 500);

      if (!subject) return res.status(400).json({ error: 'Give it a subject line.' });
      if (!title) return res.status(400).json({ error: 'Give it a heading.' });
      if (!bodyText) return res.status(400).json({ error: 'Write something in the body.' });
      if (buttonText && !buttonUrl) return res.status(400).json({ error: 'The button needs a link.' });
      if (buttonUrl && !/^https:\/\//i.test(buttonUrl)) {
        return res.status(400).json({ error: 'The button link must start with https://' });
      }
      if (imageUrl && !/^https:\/\//i.test(imageUrl)) {
        return res.status(400).json({ error: 'The image link must start with https://' });
      }
      if (!chosen.length) return res.status(400).json({ error: 'Nobody is in that group.' });

      const who = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const emailById = new Map(
        ((who && who.data && who.data.users) || []).map((u) => [u.id, u.email])
      );

      /* Each message is built for one person, because the unsubscribe link is
         theirs alone. Written as paragraphs so a blank line in the box comes
         out as a blank line in the email. */
      const paras = bodyText.split(/\n\s*\n/).map((t) => esc(t.trim()).replace(/\n/g, '<br>'));
      const site = ourSiteUrl();

      const messages = [];
      for (const p of chosen) {
        const to = emailById.get(p.id);
        if (!to) continue;
        const unsub = unsubscribeUrl(p.id, 'marketing');

        messages.push({
          to,
          subject,
          headers: unsubscribeHeaders(p.id, 'marketing'),
          text: title + '\n\n' + bodyText
              + (buttonUrl ? '\n\n' + (buttonText || 'Find out more') + ': ' + buttonUrl : '')
              + (unsub ? '\n\nNot interested in these? ' + unsub : ''),
          html: emailHtml({
            preheader: bodyText.slice(0, 140),
            heading: title,
            lines: paras,
            image: imageUrl ? { src: imageUrl, alt: title } : null,
            ctaText: buttonText && buttonUrl ? buttonText : null,
            ctaHref: buttonText && buttonUrl ? buttonUrl : null,
            footer: 'You&rsquo;re getting this because you have an account with one, by Kanvas.'
              + (unsub ? ' <a href="' + unsub + '" style="color:#86868b;">Unsubscribe</a>.' : ''),
            footerLinks: standardFooter(site)
          })
        });
      }

      if (!messages.length) {
        return res.status(400).json({ error: 'Nobody in that group has an email address.' });
      }

      /* Preview returns the first person's copy and sends nothing. It is built
         by the same code that does the sending, so what is on screen cannot
         drift away from what would actually go out. */
      if (body.preview) {
        return res.status(200).json({
          ok: true, preview: true, html: messages[0].html,
          wouldSendTo: messages.length
        });
      }

      const result = await sendBatch(messages);
      console.log('admin: broadcast to %s - %d sent, %d failed', audience, result.sent, result.failed);

      const audit = await db.from('broadcasts').insert({
        subject, title, body: bodyText,
        image_path: imageUrl || null,
        button_text: buttonText || null, button_url: buttonUrl || null,
        audience, sent_count: result.sent, failed_count: result.failed
      });
      if (audit.error) console.error('admin: broadcast record failed:', audit.error.message);

      return res.status(200).json({ ok: true, sent: result.sent, failed: result.failed });
    }

    if (action === 'setAdminNotes') {
      const userId = String(body.userId || '');
      const notes = body.notes == null ? null : String(body.notes).trim() || null;
      if (!userId) return res.status(400).json({ error: 'Which customer?' });
      const { error } = await db.from('profiles').update({ admin_notes: notes }).eq('id', userId);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    // ---- write: add something to a customer's "features on your site"
    //      list by hand - the same list a finished feature request also
    //      lands on. Tells them about it, same as marking one updated. ----
    if (action === 'addSiteFeature') {
      const userId = String(body.userId || '');
      const name = String(body.name || '').trim().slice(0, 200);
      if (!userId) return res.status(400).json({ error: 'Which customer?' });
      if (!name) return res.status(400).json({ error: 'Name the feature.' });

      const { data, error } = await db.from('site_features')
        .insert({ user_id: userId, name }).select().single();
      if (error) throw new Error(error.message);

      await notifyFeatureEmail(db, userId, name, 'added');
      await notify(db, userId, 'New on your site', name + ' has been added to your site.', '/account.html');
      return res.status(200).json({ ok: true, feature: data });
    }

    // ---- write: refresh a feature's 30-day NEW pill without renaming it -
    //      for when something existing gets reworked, not replaced. --------
    if (action === 'markFeatureUpdated') {
      const id = String(body.featureId || '');
      if (!id) return res.status(400).json({ error: 'Which feature?' });

      const { data, error } = await db.from('site_features')
        .update({ updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      if (!data) return res.status(404).json({ error: 'Feature not found.' });

      await notifyFeatureEmail(db, data.user_id, data.name, 'updated');
      await notify(db, data.user_id, 'Updated on your site', data.name + ' has been reworked.', '/account.html');
      return res.status(200).json({ ok: true, feature: data });
    }

    // ---- write: remove one - no email, nothing to tell them about ----
    if (action === 'removeSiteFeature') {
      const id = String(body.featureId || '');
      if (!id) return res.status(400).json({ error: 'Which feature?' });
      const { error } = await db.from('site_features').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    // ---- write: log a Max customer's SEO update for this billing period ----
    if (action === 'logSeoUpdate') {
      const userId = String(body.userId || '');
      const note = String(body.note || '').trim();
      if (!userId) return res.status(400).json({ error: 'Which customer?' });
      if (!note || note.length > 2000) return res.status(400).json({ error: 'Say what was actually changed.' });
      const { data, error } = await db.from('seo_updates')
        .insert({ user_id: userId, note }).select().single();
      if (error) throw new Error(error.message);
      await notify(db, userId, 'SEO work done', note.slice(0, 200), '/account.html');
      return res.status(200).json({ ok: true, entry: data });
    }

    // ---- write: move a request along ------------------------------------
    //
    // Accepting is the one gate that matters: it is the moment points get
    // redeemed or the card on file gets charged for whatever they don't
    // cover - never automatically, always this admin choosing to (and,
    // for a shortfall, choosing how much - see chargeCardForRequest). Once
    // accepted, nothing is charged twice for the same request, and nothing
    // can skip straight from a fresh Request to in_progress or done without
    // going through this first.
    if (action === 'setRequestStatus') {
      const { STRIPE_SECRET_KEY } = process.env;
      const id = String(body.requestId || '');
      const status = String(body.status || '');
      if (!id) return res.status(400).json({ error: 'Which request?' });
      if (!['new', 'accepted', 'in_progress', 'done', 'declined'].includes(status)) {
        return res.status(400).json({ error: 'Unknown status.' });
      }

      const { data: reqRow, error: curErr } = await db.from('requests').select('*').eq('id', id).maybeSingle();
      if (curErr) throw new Error(curErr.message);
      if (!reqRow) return res.status(404).json({ error: 'Request not found.' });

      // Legacy safety net: a request still carrying an old email-confirmation
      // token (from before accepting moved to this admin action) cannot move
      // on until that is resolved. Nothing new ever sets this token any more.
      if ((status === 'in_progress' || status === 'done') && reqRow.confirm_token) {
        return res.status(400).json({ error: 'Still waiting on their price confirmation email.' });
      }
      if ((status === 'in_progress' || status === 'done') && reqRow.status === 'new') {
        return res.status(400).json({ error: 'Accept the request first.' });
      }

      let amount = 0;
      if (status === 'accepted' && reqRow.status === 'new' && !reqRow.billed_at) {
        const { profile, shortfall } = await shortfallFor(db, reqRow.user_id, id);
        const computed = shortfall * REQUEST_COST.edit.amount; // £40/point, same rate either kind
        // The admin can override the computed amount - a discount on a request
        // that turned out easier than its points suggest, say. Never asked of
        // the customer; this admin decides it before the charge goes through.
        if (body.amount != null && !Number.isFinite(Number(body.amount))) {
          return res.status(400).json({ error: 'That amount is not a number.' });
        }
        amount = body.amount == null ? computed : Math.max(0, Math.round(Number(body.amount)));

        if (amount > 0) {
          if (!STRIPE_SECRET_KEY) {
            console.error('admin: missing environment variables:', missingEnv(['STRIPE_SECRET_KEY']).join(', '));
            return res.status(500).json({ error: 'Payments are not configured yet.' });
          }
          const stripe = new Stripe(STRIPE_SECRET_KEY);
          let pi;
          try {
            pi = await chargeCardForRequest(stripe, profile, reqRow, amount);
          } catch (err) {
            if (err.httpStatus) return res.status(err.httpStatus).json({ error: err.message });
            throw err;
          }

          const { error: billErr } = await db.from('requests').update({
            billed_at: new Date().toISOString(), billed_amount: amount, stripe_payment_intent_id: pi.id
          }).eq('id', id);
          if (billErr) throw new Error(billErr.message);
        }
      }

      const { error } = await db.from('requests').update({ status: status }).eq('id', id);
      if (error) throw new Error(error.message);

      /* Tell them in the app the moment their request moves. The wording is
         the customer's view of each status, not our internal names. */
      if (status !== reqRow.status) {
        const what = String(reqRow.detail || '').slice(0, 80);
        const TELL = {
          accepted:    ['Request accepted', 'We\u2019ve accepted \u201c' + what + '\u201d \u2014 it\u2019s in the queue.'],
          in_progress: ['Being worked on', '\u201c' + what + '\u201d is being built now.'],
          done:        ['Request done', '\u201c' + what + '\u201d is live on your site.'],
          declined:    ['Request declined', 'We couldn\u2019t take on \u201c' + what + '\u201d \u2014 message us and we\u2019ll explain.']
        };
        if (TELL[status]) await notify(db, reqRow.user_id, TELL[status][0], TELL[status][1], '/account.html');
      }

      // Turned live just now - a finished feature becomes something their
      // site has, added to the same list a feature can also be added to by
      // hand, and told about the same way. Edits don't get one: nothing new
      // to list.
      if (status === 'done' && reqRow.status !== 'done' && reqRow.kind === 'feature') {
        const { error: featErr } = await db.from('site_features')
          .insert({ user_id: reqRow.user_id, name: String(reqRow.detail).slice(0, 200) });
        if (featErr) throw new Error(featErr.message);
        await notifyFeatureEmail(db, reqRow.user_id, reqRow.detail, 'added');
      }

      return res.status(200).json({ ok: true, amount });
    }

    // ---- write: change edit <-> feature. Any price question that raises
    //      is decided fresh the next time this is moved to in_progress,
    //      not asked here. ------------------------------------------------
    if (action === 'reclassifyRequest') {
      const id = String(body.requestId || '');
      const kind = String(body.kind || '').toLowerCase();
      if (!id) return res.status(400).json({ error: 'Which request?' });
      if (!Object.prototype.hasOwnProperty.call(REQUEST_COST, kind)) {
        return res.status(400).json({ error: 'Unknown kind.' });
      }

      const { data: reqRow, error: reqErr } = await db.from('requests').select('*').eq('id', id).maybeSingle();
      if (reqErr) throw new Error(reqErr.message);
      if (!reqRow) return res.status(404).json({ error: 'Request not found.' });
      if (reqRow.status === 'done' || reqRow.status === 'declined') {
        return res.status(400).json({ error: 'Too late to reclassify a finished request.' });
      }
      if (reqRow.billed_at) return res.status(400).json({ error: 'Already charged — cannot reclassify.' });
      /* A business-details job is free by definition - turning it into a
         paid edit or feature would bill someone for a change they made
         themselves. The admin page hides the button; this refuses it. */
      if (reqRow.kind === 'info') {
        return res.status(400).json({ error: 'A business details change is free — it cannot become an edit or feature.' });
      }
      if (reqRow.kind === kind) return res.status(200).json({ ok: true, shortfall: 0 });

      const patch = { kind, points: REQUEST_COST[kind].points };
      // Already accepted or under way and turned out to be the other kind:
      // pull it back to Request rather than let it continue, or start,
      // against a price nobody has agreed - or paid - to yet. Accepting it
      // again is what works out the new shortfall, fresh.
      if (reqRow.status === 'accepted' || reqRow.status === 'in_progress') patch.status = 'new';

      const { error: kindErr } = await db.from('requests').update(patch).eq('id', id);
      if (kindErr) throw new Error(kindErr.message);

      const { shortfall } = await shortfallFor(db, reqRow.user_id, id);
      return res.status(200).json({ ok: true, shortfall, amount: shortfall * REQUEST_COST.edit.amount });
    }

    // ---- write: save a finished request as a reusable template ----------
    if (action === 'saveTemplate') {
      const kind = String(body.kind || '').toLowerCase();
      const name = String(body.name || '').trim();
      const description = body.description == null ? null : String(body.description).trim() || null;
      if (!Object.prototype.hasOwnProperty.call(REQUEST_COST, kind)) {
        return res.status(400).json({ error: 'Unknown kind.' });
      }
      if (!name) return res.status(400).json({ error: 'Give the template a name.' });

      const adminNotes = body.adminNotes == null ? null : String(body.adminNotes).trim() || null;
      const { data, error } = await db.from('templates')
        .insert({ kind, name, description, admin_notes: adminNotes }).select().single();
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true, template: Object.assign(data, { images: [] }) });
    }

    /* ---- write: edit a saved template -----------------------------------
     *
     * Only the fields actually sent are touched, so saving the customer-facing
     * half from one form cannot wipe the build notes written in another. */
    if (action === 'updateTemplate') {
      const id = String(body.templateId || '');
      if (!id) return res.status(400).json({ error: 'Which template?' });

      const patch = {};
      if (body.name != null) {
        const n = String(body.name).trim().slice(0, 120);
        if (!n) return res.status(400).json({ error: 'Give the template a name.' });
        patch.name = n;
      }
      if (body.description != null) patch.description = String(body.description).trim().slice(0, 4000) || null;
      if (body.adminNotes != null) patch.admin_notes = String(body.adminNotes).trim().slice(0, 8000) || null;
      if (Array.isArray(body.adminImages)) {
        patch.admin_images = body.adminImages.map(String).filter(Boolean).slice(0, 12);
        if (!patch.admin_images.length) patch.admin_images = null;
      }
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to change.' });

      const { data, error } = await db.from('templates')
        .update(patch).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      if (!data) return res.status(404).json({ error: 'Template not found.' });

      let images = [];
      if ((data.admin_images || []).length) {
        const { data: sg } = await db.storage
          .from('template-assets').createSignedUrls(data.admin_images, 3600);
        images = (sg || []).filter((x) => x.signedUrl).map((x) => ({ path: x.path, url: x.signedUrl }));
      }
      return res.status(200).json({ ok: true, template: Object.assign(data, { images }) });
    }

    // ---- write: retire or restore a template -----------------------------
    if (action === 'setTemplateActive') {
      const id = String(body.templateId || '');
      const active = Boolean(body.active);
      if (!id) return res.status(400).json({ error: 'Which template?' });
      const { error } = await db.from('templates').update({ active }).eq('id', id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    // ---- write: charge the card on file for a request the points did not
    //      cover. Normally settled the moment it is accepted (above) - this
    //      stays as a fallback for anything that reached done without being
    //      charged. Never twice - billed_at is the guard. ----
    if (action === 'chargeRequest') {
      const { STRIPE_SECRET_KEY } = process.env;
      if (!STRIPE_SECRET_KEY) {
        console.error('admin: missing environment variables:', missingEnv(['STRIPE_SECRET_KEY']).join(', '));
        return res.status(500).json({ error: 'Payments are not configured yet.' });
      }

      const requestId = String(body.requestId || '');
      if (!requestId) return res.status(400).json({ error: 'Which request?' });

      const { data: reqRow, error: reqErr } = await db
        .from('requests').select('*').eq('id', requestId).maybeSingle();
      if (reqErr) throw new Error(reqErr.message);
      if (!reqRow) return res.status(404).json({ error: 'Request not found.' });
      if (reqRow.status !== 'done') return res.status(400).json({ error: 'Mark it done before charging for it.' });
      if (reqRow.billed_at) return res.status(400).json({ error: 'Already charged.' });

      const { profile, shortfall } = await shortfallFor(db, reqRow.user_id, reqRow.id);
      if (shortfall <= 0) {
        return res.status(400).json({ error: 'This request is covered by their points — nothing to charge.' });
      }

      const amount = shortfall * REQUEST_COST.edit.amount; // £40/point, same rate either kind
      const stripe = new Stripe(STRIPE_SECRET_KEY);

      let pi;
      try {
        pi = await chargeCardForRequest(stripe, profile, reqRow, amount);
      } catch (err) {
        if (err.httpStatus) return res.status(err.httpStatus).json({ error: err.message });
        throw err;
      }

      const { error: updErr } = await db.from('requests').update({
        billed_at: new Date().toISOString(),
        billed_amount: amount,
        stripe_payment_intent_id: pi.id
      }).eq('id', requestId);
      if (updErr) throw new Error(updErr.message);

      return res.status(200).json({ ok: true, amount: amount });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('admin:', err && err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
};
