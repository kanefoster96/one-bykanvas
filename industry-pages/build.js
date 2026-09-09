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
const CSS_V = 70;
const SCRIPT_V = 27;

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
  ['Tell us about the business', 'Five minutes of questions &mdash; what you do, your prices, your photos. That&rsquo;s your part done.'],
  ['We build it for you', 'Design, writing, web address, hosting and security &mdash; all handled by a person, all in the monthly price.'],
  ['Online within 10 days', 'Then it stays ours to look after: unlimited changes and new features, made for you whenever you ask.']
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

/* Entities out, for the structured data Google reads as plain text. */
function plain(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&rsquo;/g, '\u2019').replace(/&lsquo;/g, '\u2018')
    .replace(/&ldquo;/g, '\u201c').replace(/&rdquo;/g, '\u201d').replace(/&mdash;/g, '\u2014')
    .replace(/&pound;/g, '\u00a3').replace(/&amp;/g, '&').replace(/&eacute;/g, '\u00e9');
}

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
  mainEntity: b.faq.map(([q, a]) => ({ '@type': 'Question', name: plain(q), acceptedAnswer: { '@type': 'Answer', text: plain(a) } }))
})}
</script>
` : ''}<link rel="icon" href="assets/favicon.svg?v=2" type="image/svg+xml">
<link rel="stylesheet" href="styles.css?v=${CSS_V}">
</head>
<body>

<a class="skip" href="#main">Skip to content</a>

<header class="nav" id="nav">
  <div class="nav-inner">
    <a class="logo" href="/" aria-label="Kanvas One — home">one.</a>
    <button class="burger" id="burger" aria-label="Menu" aria-expanded="false" aria-controls="menu">
      <span></span><span></span>
    </button>
  </div>
</header>

<div class="menu" id="menu" hidden></div>
<div class="scrim" id="scrim" hidden></div>

<main id="main">

<section class="page-hero">
  <div class="wrap center">
    <a class="hero-pill hero-pill-link reveal" href="/free.html"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>Try it free<span class="pill-go" aria-hidden="true">&rsaquo;</span></a>
    <h1 class="reveal">${b.h1}</h1>
    <p class="lede reveal">${b.lede}</p>
${b.heroNote ? `    <p class="micro reveal hero-note">${b.heroNote}</p>
` : ''}
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
      <a class="btn btn-free" href="/free.html"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>Try it free &rsaquo;</a>
    </div>
  </div>
` : ''}</section>

<section class="section grey">
  <div class="wrap center">
    <h2 class="reveal">How it works.</h2>
    <p class="lede reveal">${b.buildNote}</p>
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

${b.maxPitch ? `<section class="section">
  <div class="wrap center">
    <h2 class="reveal">${b.maxPitch.heading}</h2>
    <p class="lede reveal">${b.maxPitch.text}</p>
  </div>
  <div class="wrap plans reveal">
    <article class="plan">
      <div class="badge">Most popular</div>
      <h3>Business</h3>
      <p class="price"><span class="cur">&pound;</span>50<span class="per">/month</span></p>
      <p class="plan-note">Everything above, with local SEO built in at launch.</p>
      <a class="btn btn-primary full" href="/get-started.html">Get started &rsaquo;</a>
    </article>
    <article class="plan featured">
      <div class="badge">Optional</div>
      <h3>Max</h3>
      <p class="price"><span class="cur">&pound;</span>250<span class="per">/month</span></p>
      <p class="plan-note">Everything in Business, plus we work on your Google ranking every month &mdash; new service and area pages, refreshed content, and a short monthly note on what changed. Add or drop it any time.</p>
      <a class="btn btn-ghost full" href="/plans.html#max">Learn more about Max &rsaquo;</a>
    </article>
  </div>
</section>
` : ''}${b.faq ? `<section class="section grey">
  <div class="wrap center">
    <h2 class="reveal">Questions.</h2>
  </div>
  <div class="wrap faq reveal">
${b.faq.map(([q, a]) => `    <details>
      <summary>${q}</summary>
      <div class="ans"><p>${a}</p></div>
    </details>`).join('\n')}
  </div>
</section>
` : ''}<section class="section grey cta-end">
  <div class="wrap center">
    <h2 class="reveal">See yours free, first.</h2>
    <p class="lede reveal">${b.promise ? 'No pressure and no contract. Here&rsquo;s our side of the deal, in writing.' : b.freeLede}</p>
${b.rich ? `${b.promise ? `    <div class="promise reveal">
      <p class="promise-name">${b.promise.name}</p>
      <ul class="promise-lines">${b.promise.lines.map((l) => `<li>${l}</li>`).join('')}</ul>
    </div>
` : ''}    <p class="micro reveal price-line">From &pound;25 a month. No setup fees. Cancel anytime.</p>
${(b.pricingExtra || []).map((l) => `    <p class="micro reveal">${l}</p>`).join('\n')}
    <div class="cta-row reveal">
      <a class="btn btn-free" href="/free.html"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>See your free example page &rsaquo;</a>
    </div>
    <p class="ask reveal">${b.endLine}</p>
` : `    <div class="cta-row reveal">
      <a class="btn btn-free" href="/free.html"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>Try it free</a>
      <a class="btn btn-ghost" href="/get-started.html">Get started &rsaquo;</a>
    </div>
    <p class="micro reveal">From &pound;25 a month. No setup fees. Cancel anytime. <a href="/plans.html">See all plans</a></p>
    <p class="ask reveal">Rather talk it through? <a href="mailto:hello@kanvas.one?subject=Website%20for%20my%20business">Email us</a> and a real person will answer &mdash; usually the same working day.</p>
`}    <nav class="ind-links reveal" aria-label="Websites for other business types">
      <span>We also build for:</span>${linkStrip(b.slug)}
    </nav>
  </div>
</section>

</main>

${b.rich ? `<!-- One Try-it-free that follows a phone down the page once the hero has
     gone, and steps aside when the closing offer is on screen. -->
<div class="sticky-cta" id="stickyCta" hidden>
  <a class="btn btn-free" href="/free.html"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>Try it free &rsaquo;</a>
</div>
` : ''}<footer class="foot">
  <div class="wrap">
    <p class="foot-logo">one.</p>
    <p class="foot-by">by Kanvas</p>
    <nav class="foot-links" aria-label="Footer">
      <a href="/how-it-works.html">How it works</a><a href="/whats-included.html">What&rsquo;s included</a><a href="/features.html">Features</a><a href="/reviews.html">Reviews</a><a href="/plans.html">Plans</a><a href="/get-started.html">Get started</a>
    </nav>
    <nav class="foot-legal-links" aria-label="Legal">
      <a href="/terms.html">Terms</a><a href="/privacy.html">Privacy</a><a href="/cookies.html">Cookies</a><a href="/contact.html">Contact</a><button class="linkish-foot" type="button" data-consent-open hidden>Cookie settings</button>
    </nav>
    <p class="foot-legal">All prices in GBP. The price you see is the total price &mdash; we are not VAT registered, so there is no VAT to add. Website build begins once your completed form is received; the 10-day estimate is measured from that date and depends on how many changes are requested. Your web address is included for as long as your plan is active. It is registered and renewed by us on your behalf; if you leave, we transfer it to you. Cancel anytime &mdash; no further payments are taken.</p>
    <p class="foot-copy">© <span id="year">2026</span> Kanvas One. All rights reserved.</p>
  </div>
</footer>

<script src="consent.js?v=3"></script>
<script src="supabase-config.js?v=1"></script>
<script src="session.js?v=3"></script>
<script src="script.js?v=${SCRIPT_V}"></script>
<script src="admin-pill.js?v=8"></script>
</body>
</html>
`;
}

for (const b of INDUSTRIES) {
  const file = path.join(OUT, `websites-for-${b.slug}.html`);
  fs.writeFileSync(file, page(b));
  console.log('wrote', path.basename(file));
}
