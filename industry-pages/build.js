/* Industry landing pages — one static page per kind of business, for search.
 *
 * Each page answers the query "website for [my trade]" with copy about that
 * trade, the features that trade actually asks for, and the free-build offer.
 * The skeleton (head, nav, footer, scripts) mirrors the hand-written pages;
 * run `node industry-pages/build.js` from the repo root to regenerate all ten
 * after editing the data below or the template. The generated files are
 * committed, so the site itself stays plain static HTML.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..');

/* Versions of the shared assets, matching every other page. When those bump
   site-wide, the sed that bumps them will catch the generated pages too —
   these values only matter for a fresh generation. */
const CSS_V = 103;
const SCRIPT_V = 33;

/* The same visual language as the homepage cards: a solid colour square with
   a simple white line icon. Keys are referenced per-feature by each industry's
   `icons` array (positional, one per feature). */
const ICONS = {
  doc: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 9h6M9 13h6M9 17h3.5"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8.5" cy="10" r="1.6"/><path d="M3 16.5l5-4.5 4 3.5 3.5-3 5.5 4.5"/>',
  star: '<path d="M12 3.4l2.5 5.4 5.9.6-4.4 4 1.2 5.8L12 16.2l-5.2 3 1.2-5.8-4.4-4 5.9-.6z"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h3"/>',
  calendar: '<rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  repeat: '<path d="M4 12a8 8 0 0 1 14-5"/><path d="M18 3v4h-4"/><path d="M20 12a8 8 0 0 1-14 5"/><path d="M6 21v-4h4"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.9-3.7 3.6-5.6 7-5.6s6.1 1.9 7 5.6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M16.3 16.3L21 21"/>',
  shield: '<path d="M12 2.5l8 3.5v6c0 5-3.6 8.6-8 10-4.4-1.4-8-5-8-10v-6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  pencil: '<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M14.5 5.5l4 4"/>',
  tag: '<path d="M12.6 3.5l7.9 7.9a2 2 0 0 1 0 2.8l-5.3 5.3a2 2 0 0 1-2.8 0L4.5 11.6V4.5h7.1z"/><circle cx="8.7" cy="8.7" r="1.4"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M3.5 7.5L12 13l8.5-5.5"/>',
  gift: '<rect x="3" y="8" width="18" height="4.2" rx="1"/><path d="M4.8 12.2v7.9c0 .5.4.9.9.9h12.6c.5 0 .9-.4.9-.9v-7.9"/><path d="M12 8v13"/><path d="M12 8c0-2.5-1-4.2-2.8-4.2a2.1 2.1 0 0 0 0 4.2z"/><path d="M12 8c0-2.5 1-4.2 2.8-4.2a2.1 2.1 0 0 1 0 4.2z"/>'
};

const ICO_COLORS = ['ico-blue', 'ico-green', 'ico-purple', 'ico-orange', 'ico-pink', 'ico-grey'];

const INDUSTRIES = require('./industries.js');
const FEATURES = require('./features.js');
const MAX = require('./max.js');
/* The 90-day promise on the Max pages: written, not yet switched on. */
const MAX_GUARANTEE = false;
const CASES = INDUSTRIES.CASES || [];

/* The cross-link strip: every industry page links the other nine, and the
   homepage links all ten, so each page is reachable by crawl, not only by
   sitemap. */
function linkStrip(exceptSlug) {
  return INDUSTRIES
    .filter((b) => b.slug !== exceptSlug)
    .map((b) => `<a href="/websites-for-${b.slug}.html">${b.link}</a>`)
    .join('');
}

function card([h, p], iconKey, color) {
  return `    <article class="card">
      <div class="ico ${color}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[iconKey]}</svg>
      </div>
      <div class="card-text">
        <h3>${h}</h3>
        <p>${p}</p>
      </div>
    </article>`;
}

const DEFAULT_STEPS = [
  ['Tell me about the business', 'What you do, your prices, your photos. Five minutes.'],
  ['I build it for you', 'Design, writing, web address, hosting and security. All in the price.'],
  ['Live the same day, features in 14', 'Live on your own address the day you join. Features within 14 days, or your next month is free.']
];
const STEP_COLORS = ['ico-blue', 'ico-purple', 'ico-green'];

function stepCards(b) {
  return (b.steps || DEFAULT_STEPS).map(([h, p], i) => `    <article class="card">
      <div class="ico ${STEP_COLORS[i]}"><span class="step-n">${i + 1}</span></div>
      <div class="card-text">
        <h3>${h}</h3>
        <p>${p}</p>
      </div>
    </article>`).join('\n');
}

/* The page's questions. */
function faqFor(b) {
  return b.faq;
}

/* A subheading with each sentence on its own line, as the hand-written
   pages have them. Only for what is shown; the structured data keeps
   the plain sentence. */
function lines(html) {
  return String(html || '').replace(/([.!?]) (?=[A-Z&])/g, '$1<span class="gap"></span>');
}

/* Entities out, for the structured data Google reads as plain text. */
function plain(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&rsquo;/g, '\u2019').replace(/&lsquo;/g, '\u2018')
    .replace(/&ldquo;/g, '\u201c').replace(/&rdquo;/g, '\u201d').replace(/&mdash;/g, '\u2014')
    .replace(/&pound;/g, '\u00a3').replace(/&amp;/g, '&').replace(/&eacute;/g, '\u00e9');
}


/* Shared between the trade pages and the feature pages. */
const NAV = `<header class="nav" id="nav">
  <div class="nav-inner">
    <a class="logo" href="/" aria-label="Kanvas One — home">one.</a>
    <button class="nav-chat" id="navChat" type="button" aria-label="Chat with us" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20.5l1.4-4.6A7.5 7.5 0 1 1 20 12.5z"/></svg></button>
    <button class="burger" id="burger" aria-label="Menu" aria-expanded="false" aria-controls="menu">
      <span></span><span></span>
    </button>
  </div>
</header>

<div class="menu" id="menu" hidden></div>
<div class="scrim" id="scrim" hidden></div>

<main id="main">

`;

function miniForm(placeholder) {
  return `<!-- The free example, on the page the ad lands on: three things, one at a
     time. Same endpoint and thank-you page as /free.html; script.js runs
     it wherever #miniFree is. -->
<section class="section pt0">
  <div class="wrap center">
    <form class="free-mini reveal" id="miniFree" novalidate>
      <p class="hero-pill"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>Try it free</p>
      <h3>See your site within 24 hours. Free.</h3>
      <p class="lede">Three things, and a real page lands in your inbox within 24 hours.<span class="gap"></span>No card.</p>

      <div class="hp" aria-hidden="true">
        <label for="mini_extra">Leave this empty</label>
        <input id="mini_extra" name="mini_extra" type="text" tabindex="-1" autocomplete="off">
      </div>

      <div class="mini-step wait" id="miniStep1">
        <label for="miniBusiness">Your business name</label>
        <input id="miniBusiness" type="text" autocomplete="organization" placeholder="${placeholder || 'e.g. Fade Room Barbers'}" enterkeyhint="next">
      </div>

      <div class="mini-step" id="miniStep2" hidden>
        <label for="miniHandle">Your business anywhere online</label>
        <input id="miniHandle" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="@yourbusiness or a link" enterkeyhint="next">
        <p class="hint">Instagram, Facebook, your current site, Trust a Trader &mdash; anywhere.</p>
      </div>

      <div class="mini-step" id="miniStep3" hidden>
        <label for="miniEmail">Where should I send it? You&rsquo;ll have it within 24 hours.</label>
        <div class="mini-row">
          <input id="miniEmail" type="email" autocomplete="email" placeholder="you@example.com" enterkeyhint="send">
          <button class="mini-go" id="miniSend" type="submit" aria-label="Send my free example">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>
          </button>
        </div>
      </div>

      <p class="note" id="miniNote" role="status" aria-live="polite"></p>
      <p class="mini-alt">Already decided? <a href="/get-started.html">Get started &rsaquo;</a></p>
    </form>
  </div>
</section>
`;
}

const FOOT = `<footer class="foot">
  <div class="wrap">
    <p class="foot-logo">one.</p>
    <p class="foot-by">by Kanvas</p>
    <nav class="foot-links" aria-label="Footer">
      <a href="/how-it-works.html">How it works</a><a href="/whats-included.html">What&rsquo;s included</a><a href="/features.html">Features</a><a href="/reviews.html">Reviews</a><a href="/plans.html">Plans</a><a href="/get-started.html">Get started</a>
    </nav>
    <nav class="foot-legal-links" aria-label="Legal">
      <a href="/terms.html">Terms</a><a href="/privacy.html">Privacy</a><a href="/cookies.html">Cookies</a><a href="/contact.html">Contact</a><button class="linkish-foot" type="button" data-consent-open hidden>Cookie settings</button>
    </nav>
    <p class="foot-legal">All prices in GBP. The price you see is the total price &mdash; we are not VAT registered, so there is no VAT to add. Your page goes live on your own address the same day you join; the features you ask for are built within 14 days of joining, or your next month is free (see terms). Your web address is included for as long as your plan is active. It is registered and renewed by us on your behalf; if you leave, we transfer it to you. Cancel anytime &mdash; no further payments are taken.</p>
    <p class="foot-copy">© <span id="year">2026</span> Kanvas One. All rights reserved.</p>
  </div>
</footer>

<script src="consent.js?v=8"></script>
<script src="supabase-config.js?v=1"></script>
<script src="session.js?v=3"></script>
<script src="script.js?v=${SCRIPT_V}"></script>
<script src="reviews.js?v=3"></script>
<script src="chat.js?v=6" data-site="9094de37-b610-41b6-98f1-2aaf8f5bd52b" data-name="Kanvas One" data-trigger="#navChat" data-full defer></script>
<script src="beacon.js?v=1" data-site="9094de37-b610-41b6-98f1-2aaf8f5bd52b" defer></script>
<script src="admin-pill.js?v=8"></script>
</body>
</html>
`;

function page(b) {
  const url = `https://kanvas.one/websites-for-${b.slug}`;
  const plainTitle = b.title.replace(/&amp;/g, '&').replace(/&eacute;/g, 'é');
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Websites for ${plainTitle} — Kanvas One</title>
<meta name="description" content="${b.desc}">
<meta name="theme-color" content="#ffffff">
<meta property="og:title" content="Websites for ${plainTitle} — Kanvas One">
<meta property="og:description" content="${b.desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Kanvas One">
<meta property="og:image" content="https://kanvas.one/assets/og-image.png">
<meta property="og:image:width" content="2400">
<meta property="og:image:height" content="1260">
<meta property="og:image:alt" content="Kanvas One — the right website for your business. A request being typed: add online payments to my site.">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${url}">
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: `Websites for ${plainTitle}`,
  serviceType: 'Website design and management',
  provider: { '@type': 'Organization', name: 'Kanvas One', url: 'https://kanvas.one/' },
  areaServed: 'GB',
  url: url,
  description: b.desc
})}
</script>
${b.faq ? `<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqFor(b).map(([q, a]) => ({ '@type': 'Question', name: plain(q), acceptedAnswer: { '@type': 'Answer', text: plain(a) } }))
})}
</script>
` : ''}<link rel="icon" href="assets/favicon-32.png?v=3" sizes="32x32" type="image/png">
<link rel="icon" href="assets/favicon-192.png?v=3" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="assets/favicon-180.png?v=3">
<link rel="stylesheet" href="styles.css?v=${CSS_V}">
</head>
<body>

<a class="skip" href="#main">Skip to content</a>

${NAV}<section class="page-hero">
  <div class="wrap center">
    <a class="hero-pill hero-pill-link reveal" href="#miniFree"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>Try it free<span class="pill-go" aria-hidden="true">&rsaquo;</span></a>
    <h1 class="reveal">${b.h1}</h1>
    <p class="lede reveal">${lines(b.lede)}</p>
${b.heroNote ? `    <p class="micro reveal hero-note">${b.heroNote}</p>
` : ''}    <p class="by-line reveal"><img class="by-photo" src="assets/kane.jpg" alt="" width="36" height="36" loading="lazy" onerror="this.remove()"><span>Designed and built by <b>Kane</b>. One person, and you can message him.</span></p>

    <!-- A request being typed, as this trade would type it. Decorative: the
         copy around it says the same things, so screen readers skip the
         animation rather than hearing it letter by letter. -->
    <div class="typebox reveal" aria-hidden="true">
      <span class="typebox-text" id="typeDemo" data-lines="${JSON.stringify(b.lines).replace(/"/g, '&quot;')}"></span>
      <span class="typebox-send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5.5 11.5 12 5l6.5 6.5"/></svg></span>
    </div>
${b.trust ? `    <ul class="assure trust reveal">${b.trust.map((t) => `<li>${t}</li>`).join('')}</ul>
    <p class="micro reveal trust-line">${b.trustLine}</p>
` : ''}  </div>
</section>

${miniForm(b.placeholder)}
<section class="section pt0">
  <div class="wrap center">
    <h2 class="reveal">What your site can do.</h2>
    <p class="lede reveal">Everything below is built for you and included in the plan &mdash; ask for it and it gets made.</p>
  </div>
  <div class="wrap grid reveal">
${b.features.map((f, i) => card(f, b.icons[i], ICO_COLORS[i % ICO_COLORS.length])).join('\n')}
  </div>
${b.also ? `  <div class="wrap center also reveal">
    <p class="also-title">${b.alsoTitle || 'Also included, if you want them'}</p>
    <div class="also-pills">${b.also.map((t) => `<span class="use-chip">${t}</span>`).join('')}</div>
    <div class="cta-row">
      <a class="btn btn-free" href="#miniFree"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>Try it free &rsaquo;</a>
    </div>
  </div>
` : ''}</section>

<section class="section grey">
  <div class="wrap center">
    <h2 class="reveal">How it works.</h2>
    <p class="lede reveal">${lines(b.buildNote)}</p>
  </div>
  <div class="wrap grid grid-3 reveal">
${stepCards(b)}
  </div>
${b.stepsLine ? `  <div class="wrap center reveal">
    <p class="micro steps-line">${b.stepsLine}</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="/get-started.html">Get started &rsaquo;</a>
    </div>
  </div>
` : ''}</section>

<section class="section grey">
  <div class="wrap center">
    <h2 class="reveal">Built by me. Working for them.</h2>
  </div>
  <div class="rail" id="rail" data-reviews="2" role="region" aria-label="Customer reviews"></div>
  <div class="rail-nav">
    <button class="rail-btn" data-dir="-1" aria-label="Previous reviews">&lsaquo;</button>
    <button class="rail-btn" data-dir="1" aria-label="Next reviews">&rsaquo;</button>
  </div>
</section>
${b.maxPitch ? `<section class="section">
  <div class="wrap center">
    <h2 class="reveal">${b.maxPitch.heading}</h2>
    <p class="lede reveal">${lines(b.maxPitch.text)}</p>
  </div>
  <div class="wrap plans three reveal">
    <article class="plan featured">
      <div class="badge">The site</div>
      <h3>Starter</h3>
      <p class="price"><span class="cur">&pound;</span>25<span class="per">/month</span></p>
      <p class="plan-note">Found on Google, called and messaged. Designed and hosted for you. No setup fee.</p>
      <a class="btn btn-primary full" href="/get-started.html?plan=starter">Choose Starter &rsaquo;</a>
    </article>
    <article class="plan">
      <div class="badge">+&pound;25: get booked</div>
      <h3>Business</h3>
      <p class="price"><span class="cur">&pound;</span>50<span class="per">/month</span></p>
      <p class="plan-note">Everything in Starter, plus:</p>
      <ul class="ticks">
        <li class="tick-hero">Bookings, payments and live chat</li>
        <li class="tick-hero">Reviews asked for automatically</li>
        <li class="tick-hero">Unlimited changes, within 48 hours</li>
      </ul>
      <a class="btn btn-ghost full" href="/get-started.html?plan=business">Choose Business &rsaquo;</a>
    </article>
    <article class="plan">
      <div class="badge">Add growth</div>
      <h3>Max</h3>
      <p class="price"><span class="cur">&pound;</span>250<span class="per">/month</span></p>
      <p class="plan-note">An end-to-end system for your kind of business, run for you:</p>
      <ul class="ticks">
        <li class="tick-hero">Your Facebook and Instagram ads, run by me. You set the budget</li>
        <li class="tick-hero">Your Google ranking worked on every month</li>
        <li class="tick-hero">Reviews, referrals and follow-up emails, automatic</li>
      </ul>
      <p class="plan-up">Ten businesses at a time. &pound;250 for the first ten.</p>
      <a class="btn btn-ghost full" href="${maxHref(b.slug)}">${maxLabel(b.slug)} &rsaquo;</a>
    </article>
  </div>
  <p class="wrap center micro reveal">50% off your first month. Or pay for the year: 2 months free and the Launch Boost.</p>
</section>
` : ''}${b.faq ? `<section class="section grey">
  <div class="wrap center">
    <h2 class="reveal">Questions.</h2>
  </div>
  <div class="wrap faq reveal">
${faqFor(b).map(([q, a]) => `    <details>
      <summary>${q}</summary>
      <div class="ans"><p>${a}</p></div>
    </details>`).join('\n')}
  </div>
</section>
` : ''}<section class="section grey cta-end">
  <div class="wrap center">
    <h2 class="reveal">See yours free, within 24 hours.</h2>
    <p class="lede reveal">${b.promise ? 'Our side of the deal, in writing.' : b.freeLede}</p>
${b.rich ? `${b.promise ? `    <div class="promise reveal">
      <p class="promise-name">${b.promise.name}</p>
      <ul class="promise-lines">${b.promise.lines.map((l) => `<li>${l}</li>`).join('')}</ul>
    </div>
` : ''}    <p class="micro reveal price-line">From &pound;25 a month. No setup fees. Cancel anytime.</p>
${(b.pricingExtra || []).map((l) => `    <p class="micro reveal">${l}</p>`).join('\n')}
    <div class="cta-row reveal">
      <a class="btn btn-free" href="#miniFree"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>See your free example page &rsaquo;</a>
    </div>
    <p class="ask reveal">${b.endLine}</p>
` : `    <div class="cta-row reveal">
      <a class="btn btn-free" href="#miniFree"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>Try it free</a>
      <a class="btn btn-ghost" href="/get-started.html">Get started &rsaquo;</a>
    </div>
    <p class="micro reveal">From &pound;25 a month. No setup fees. Cancel anytime. <a href="/plans.html">See all plans</a></p>
    <p class="ask reveal">Rather talk it through? <a href="mailto:hello@kanvas.one?subject=Website%20for%20my%20business">Email me</a> and you&rsquo;ll get an answer &mdash; usually the same working day.</p>
`}    <nav class="ind-links reveal" aria-label="Websites for other business types">
      <span>We also build for:</span>${linkStrip(b.slug)}
    </nav>
  </div>
</section>

</main>

${b.rich ? `<!-- One Try-it-free that follows a phone down the page once the hero has
     gone, and steps aside when the closing offer is on screen. -->
<div class="sticky-cta" id="stickyCta" hidden>
  <a class="btn btn-free" href="#miniFree"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>Try it free &rsaquo;</a>
</div>
` : ''}${FOOT}`;
}

for (const b of INDUSTRIES) {
  const file = path.join(OUT, `websites-for-${b.slug}.html`);
  fs.writeFileSync(file, page(b));
  console.log('wrote', path.basename(file));
}

/* ---------------------------------------------------------- feature pages */
/* One per thing an owner searches for: the pain, how it works on their
   site, what they get, the plan it lives on, the free example first. */
function featureLinks(exceptSlug) {
  return FEATURES.filter((f) => f.slug !== exceptSlug)
    .map((f) => `<a href="/${f.slug}.html">${f.short}</a>`).join('');
}

function planCard(f) {
  if (f.plan === 'max') return `    <article class="plan featured">
      <div class="badge">Add growth</div>
      <h3>Max</h3>
      <p class="price"><span class="cur">&pound;</span>250<span class="per">/month</span></p>
      <p class="plan-note">Your site, designed and built, plus me going and getting you customers every month.</p>
      <p class="plan-free">No setup fees</p>
      <a class="btn btn-primary full" href="/get-started.html?plan=max">Add growth</a>
      <ul class="ticks">
        <li>Your website, designed and built for you, live the day you join</li>
        <li>Bookings, payments and live chat. Unlimited changes</li>
        <li class="tick-hero">Your Facebook and Instagram ads, set up, run and tracked by me</li>
        <li class="tick-hero">Your first ad live within 7 days</li>
        <li class="tick-hero">Your Google ranking worked on every month</li>
        <li class="tick-hero">Reviews, referrals and follow-up emails, automatic</li>
        <li class="tick-hero">Business email at your own address</li>
      </ul>
      <p class="plan-up">Built for your kind of business: <a href="/max/trades">Trades</a>, <a href="/max/clubs">Clubs</a>, <a href="/max/salon">Salon</a>, or <a href="#" data-max-other>another</a>. Ten at a time.</p>
    </article>`;
  return `    <article class="plan featured">
      <div class="badge">+&pound;25: get booked</div>
      <h3>Business</h3>
      <p class="price"><span class="cur">&pound;</span>50<span class="per">/month</span></p>
      <p class="plan-note">Your site, designed and built for you, plus the features that take the work off your phone.</p>
      <p class="plan-free">No setup fees</p>
      <a class="btn btn-primary full" href="/get-started.html?plan=business">Choose Business</a>
      <ul class="ticks">
        <li>Live on your own address the day you join</li>
        <li class="tick-hero">Bookings, payments and live chat</li>
        <li class="tick-hero">Reviews asked for automatically</li>
        <li class="tick-hero">Unlimited changes, made by me within 48 hours</li>
        <li class="tick-hero">Your three features built within 14 days, or your next month is free</li>
      </ul>
      <p class="plan-up">Just want the site, with a contact form and click to call? <a href="/plans.html#starter">Starter is &pound;25</a>.</p>
    </article>`;
}

function featurePage(f) {
  const url = `https://kanvas.one/${f.slug}`;
  const title = `${f.search} — Kanvas One`;
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${f.desc}">
<meta name="theme-color" content="#ffffff">
<meta property="og:title" content="${plain(f.h1)}">
<meta property="og:description" content="${f.desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Kanvas One">
<meta property="og:image" content="https://kanvas.one/assets/og-image.png">
<meta property="og:image:width" content="2400">
<meta property="og:image:height" content="1260">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${url}">
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: plain(f.search),
  serviceType: 'Website design and management',
  provider: { '@type': 'Organization', name: 'Kanvas One', url: 'https://kanvas.one/' },
  areaServed: 'GB',
  url: url,
  description: f.desc
})}
</script>
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: f.faq.map(([q, a]) => ({ '@type': 'Question', name: plain(q), acceptedAnswer: { '@type': 'Answer', text: plain(a) } }))
})}
</script>
<link rel="icon" href="assets/favicon-32.png?v=3" sizes="32x32" type="image/png">
<link rel="icon" href="assets/favicon-192.png?v=3" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="assets/favicon-180.png?v=3">
<link rel="stylesheet" href="styles.css?v=${CSS_V}">
</head>
<body>

<a class="skip" href="#main">Skip to content</a>

${NAV}<section class="page-hero">
  <div class="wrap center">
    <a class="hero-pill hero-pill-link reveal" href="#miniFree"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>Try it free<span class="pill-go" aria-hidden="true">&rsaquo;</span></a>
    <h1 class="reveal">${f.h1}</h1>
    <p class="lede reveal">${lines(f.lede)}</p>
    <p class="micro reveal hero-note">Built into your own website, set up for you. ${f.plan === 'max' ? '&pound;250 a month, ten businesses at a time.' : 'From &pound;50 a month, no setup fee.'}</p>

    <div class="typebox reveal" aria-hidden="true">
      <span class="typebox-text" id="typeDemo" data-lines="${JSON.stringify(f.lines).replace(/"/g, '&quot;')}"></span>
      <span class="typebox-send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5.5 11.5 12 5l6.5 6.5"/></svg></span>
    </div>
  </div>
</section>

<!-- The pain, in the owner's words, then the free example: the page has
     said what it understands before it asks for anything. -->
<section class="section pt0">
  <div class="wrap center">
    <p class="lede reveal pain">${f.pain}</p>
  </div>
${miniForm(f.placeholder)}</section>

<section class="section pt0">
  <div class="wrap center">
    <h2 class="reveal">How it works.</h2>
  </div>
  <div class="wrap grid steps reveal">
${stepCards({ steps: f.how })}
  </div>
</section>

<section class="section grey">
  <div class="wrap center">
    <h2 class="reveal">What you get.</h2>
  </div>
  <div class="wrap">
    <aside class="boost reveal">
      <ul class="ticks">
${f.gets.map((g) => `        <li>${g}</li>`).join('\n')}
      </ul>
      <p>${f.planLine}</p>
    </aside>
  </div>
  <div class="wrap plans reveal">
${planCard(f)}
  </div>
</section>

<section class="section">
  <div class="wrap center">
    <h2 class="reveal">Questions.</h2>
  </div>
  <div class="wrap faq reveal">
${f.faq.map(([q, a]) => `    <details>
      <summary>${q}</summary>
      <div class="ans"><p>${a}</p></div>
    </details>`).join('\n')}
  </div>
</section>

<section class="section grey cta-end">
  <div class="wrap center">
    <h2 class="reveal">See yours free, within 24 hours.</h2>
    <p class="lede reveal">A real page for your business, before you decide anything.</p>
    <div class="cta-row reveal">
      <a class="btn btn-free" href="#miniFree"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>See your free example page &rsaquo;</a>
      <a class="btn btn-ghost" href="/plans.html">All the plans</a>
    </div>
    <p class="micro reveal">From &pound;25 a month. No setup fees. Cancel anytime.</p>
    <nav class="ind-links reveal" aria-label="Other features">
      <span>Also:</span>${featureLinks(f.slug)}
    </nav>
    <nav class="ind-links reveal" aria-label="Websites by business type">
      <span>Websites for:</span>${linkStrip('')}
    </nav>
  </div>
</section>

</main>

<div class="sticky-cta" id="stickyCta" hidden>
  <a class="btn btn-free" href="#miniFree"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>Try it free &rsaquo;</a>
</div>
${FOOT}`;
}

for (const f of FEATURES) {
  const file = path.join(OUT, `${f.slug}.html`);
  fs.writeFileSync(file, featurePage(f));
  console.log('wrote', path.basename(file));
}

/* ---------------------------------------------------------- Max pages */
/* Which model a trade page points at; the rest go to the picker. */
function maxHref(slug) {
  if (slug === 'trades' || slug === 'cleaners' || slug === 'gardeners') return '/max/trades';
  if (slug === 'salons' || slug === 'barbers') return '/max/salon';
  if (slug === 'gyms') return '/max/clubs';
  return '/plans.html#max';
}
function maxLabel(slug) {
  const h = maxHref(slug);
  return h === '/max/trades' ? 'See Trades Max' : h === '/max/salon' ? 'See Salon Max' : h === '/max/clubs' ? 'See Clubs Max' : 'See Max';
}

function maxPage(m) {
  const url = `https://kanvas.one/max/${m.slug}`;
  const free = `/free.html?t=${m.tag}`;
  /* Pages live in /max/, so every asset path is absolute. */
  const nav = NAV.replace(/href="\/"/g, 'href="/"');
  const form = miniForm('e.g. ' + (m.slug === 'trades' ? 'Dave the Plumber' : m.slug === 'clubs' ? 'Northside Dance' : 'Nova Nails'));
  const foot = FOOT.replace(/src="([a-z-]+\.js)/g, 'src="/$1');
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${m.name} | Kanvas One</title>
<meta name="description" content="${plain(m.promise)} ${m.desc}">
<meta name="theme-color" content="#ffffff">
<meta property="og:title" content="${m.name} — ${plain(m.promise)}">
<meta property="og:description" content="${m.desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Kanvas One">
<meta property="og:image" content="https://kanvas.one/assets/og-image.png">
<meta property="og:image:width" content="2400">
<meta property="og:image:height" content="1260">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${url}">
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: m.name,
  serviceType: 'Website, advertising and marketing system, run for the business',
  provider: { '@type': 'Organization', name: 'Kanvas One', url: 'https://kanvas.one/' },
  areaServed: 'GB',
  url: url,
  description: m.desc,
  offers: { '@type': 'Offer', price: '250', priceCurrency: 'GBP', description: 'Per month. Ad spend paid separately by the customer.' }
})}
</script>
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: m.faq.filter(([q]) => !/TODO/.test(q)).map(([q, a]) => ({ '@type': 'Question', name: plain(q), acceptedAnswer: { '@type': 'Answer', text: plain(a) } }))
})}
</script>
<link rel="icon" href="/assets/favicon-32.png?v=3" sizes="32x32" type="image/png">
<link rel="icon" href="/assets/favicon-192.png?v=3" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="/assets/favicon-180.png?v=3">
<link rel="stylesheet" href="/styles.css?v=${CSS_V}">
</head>
<body>

<a class="skip" href="#main">Skip to content</a>

${nav}<!-- 1. The promise, the price, the ask. -->
<section class="page-hero">
  <div class="wrap center">
    <!-- The product's own mark: an app-style icon with the model's tool in
         it and the green MAX pill on its corner. -->
    <div class="max-app reveal" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${m.icon}</svg>
      <span class="max-app-pill">MAX</span>
    </div>
    <p class="hero-pill reveal">${m.name}</p>
    <h1 class="reveal">${m.promise}</h1>
    <p class="lede reveal">&pound;250 a month. No setup fee. Live the same day you join.<span class="gap"></span>Ten businesses at a time.</p>
    <div class="cta-row reveal">
      <a class="btn btn-primary" href="#miniFree">See your free preview</a>
      <a class="btn btn-ghost" href="/get-started.html?plan=max">Start ${m.name} &rsaquo;</a>
    </div>
    <p class="fineprint reveal">${MAX.AD_SPEND}</p>
  </div>
</section>

<!-- 2. Who it is for. -->
<section class="section pt0">
  <div class="wrap center">
    <h2 class="reveal">Who it&rsquo;s for.</h2>
    <p class="lede reveal">${m.who}</p>
  </div>
</section>

<!-- 3. The model, in the order the customer meets it. -->
<section class="section pt0">
  <div class="wrap center">
    <h2 class="reveal">The model.</h2>
    <p class="lede reveal">Four stages. Built once for your kind of business, tested, and repeated.</p>
  </div>
  <div class="wrap stages reveal">
${m.stages.map((s, i) => `    <article class="stage">
      <span class="stage-n">${i + 1}</span>
      <h3>${s.name}</h3>
      <p class="stage-intro">${s.intro}</p>
      <ul class="ticks">
${s.items.map((t) => `        <li>${t}</li>`).join('\n')}
      </ul>
    </article>`).join('\n')}
  </div>
</section>

<!-- 4. What you do, what we do. -->
<section class="section grey">
  <div class="wrap center">
    <h2 class="reveal">What you do. What we do.</h2>
  </div>
  <div class="wrap two-col reveal">
    <div class="col">
      <h3>You</h3>
      <ul>${m.you.map((t) => `<li>${t}</li>`).join('')}</ul>
    </div>
    <div class="col">
      <h3>We</h3>
      <ul>${m.we.map((t) => `<li>${t}</li>`).join('')}</ul>
    </div>
  </div>
</section>

<!-- 5. Everything you get, against what it costs bought separately. -->
<section class="section">
  <div class="wrap center">
    <h2 class="reveal">Everything you get.</h2>
  </div>
  <div class="wrap vt-wrap reveal">
    <table class="vt">
      <thead><tr><th scope="col">What you get</th><th scope="col">What it does for you</th><th scope="col">Bought separately</th></tr></thead>
      <tbody>
${m.value.map(([a, c, d]) => `        <tr><th scope="row">${a}</th><td>${c}</td><td>${d}</td></tr>`).join('\n')}
      </tbody>
    </table>
  </div>
  <p class="wrap vt-total reveal">${m.valueTotal}</p>
</section>

<!-- 6. Why it works. -->
<section class="section pt0">
  <div class="wrap center">
    <h2 class="reveal">Why it works.</h2>
  </div>
  <div class="wrap why reveal">
${m.why.map(([lead, rest]) => `    <p><b>${lead}</b>${rest}</p>`).join('\n')}
  </div>
</section>

<!-- 7. What it costs. -->
<section class="section grey">
  <div class="wrap center">
    <h2 class="reveal">What it costs.</h2>
  </div>
  <div class="wrap cost reveal">
    <p class="price"><span class="cur">&pound;</span>250<span class="per">/month</span></p>
    <p>No setup fee. Same price whatever your business type.</p>
    <p>${MAX.AD_SPEND}</p>
    <p>An agency charges &pound;500 a month or more to run ads, before the budget. ${m.name} is &pound;250, with the website, the ranking work, the bookings and the follow-ups in it.</p>
    <p><strong>Your price is locked</strong> for as long as you stay on it. Ten businesses at a time; after the first ten, the price goes up for new customers, not for you.</p>
  </div>
</section>

<!-- 8. No risk to try it. -->
<section id="offer" class="section">
  <div class="wrap center">
    <h2 class="reveal">No risk to try it.</h2>
    <ul class="assure trust reveal"><li>Free preview in 24 hours</li><li>Live the same day you join</li><li>No setup fee</li><li>Cancel anytime</li></ul>
  </div>
${MAX_GUARANTEE ? `  <div class="wrap">
    <div class="promise reveal">
      <p class="promise-name">The 90-day promise</p>
      <ul class="promise-lines"><li>Run ${m.name} for 90 days with ads at &pound;10 a day or more.</li><li>If you have not had more enquiries than in the 90 days before, the next three months of Max are free.</li></ul>
    </div>
  </div>
` : ''}  <div class="wrap center">
${form}  </div>
</section>

<!-- 9. Questions. -->
<section class="section grey">
  <div class="wrap center">
    <h2 class="reveal">Questions.</h2>
  </div>
  <div class="wrap faq reveal">
${m.faq.map(([q, a]) => `    <details>
      <summary>${q}</summary>
      <div class="ans"><p>${a}</p></div>
    </details>`).join('\n')}
  </div>
</section>

<!-- 10. The ask. -->
<section class="section cta-end">
  <div class="wrap center">
    <h2 class="reveal">Start with the free example.</h2>
    <p class="lede reveal">A real page for your business, within 24 hours.<span class="gap"></span>No card, no catch. Then decide.</p>
    <div class="cta-row reveal">
      <a class="btn btn-free" href="#miniFree"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>See your free example page &rsaquo;</a>
      <a class="btn btn-ghost" href="/plans.html">All the plans</a>
    </div>
    <nav class="ind-links reveal" aria-label="Other Max models">
      <span>Max for:</span>${MAX.filter((x) => x.slug !== m.slug).map((x) => `<a href="/max/${x.slug}">${x.name}</a>`).join('')}<a href="#" data-max-other>Another business</a>
    </nav>
  </div>
</section>

</main>

<div class="sticky-cta" id="stickyCta" hidden>
  <a class="btn btn-free" href="#miniFree"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>Try it free &rsaquo;</a>
</div>
${foot}`;
}

fs.mkdirSync(path.join(OUT, 'max'), { recursive: true });
for (const m of MAX) {
  const file = path.join(OUT, 'max', `${m.slug}.html`);
  fs.writeFileSync(file, maxPage(m));
  console.log('wrote max/' + path.basename(file));
}
