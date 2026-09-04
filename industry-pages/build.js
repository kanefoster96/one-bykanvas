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
const CSS_V = 42;
const SCRIPT_V = 16;

const INDUSTRIES = [
  {
    slug: 'trades',
    link: 'Trades',
    title: 'Trades',
    h1: 'Websites for trades.',
    lede: 'Builders, plumbers, electricians, roofers &mdash; a site that wins you the job while you&rsquo;re out on one.',
    desc: 'Websites for builders, plumbers, electricians and other trades. Quote forms, job photo galleries and reviews — built for you, from £50 a month, no setup fees.',
    features: [
      ['Quote requests with photos', 'Customers describe the job and attach photos before you call back &mdash; so you quote once, properly.'],
      ['Galleries of finished jobs', 'Your best work, on your own site. The photos on your phone are the reason people pick you.'],
      ['Reviews where people look', 'Your Google reviews shown on the site, so the trust you&rsquo;ve earned does the selling.'],
      ['A page for every service', 'Bathrooms, rewires, flat roofs &mdash; a page per job type, so you show up when people search for it.'],
      ['The areas you cover', 'Say exactly where you work, so the calls you get are ones you can actually take.'],
      ['Deposits taken online', 'Take a deposit when the job is booked &mdash; fewer cancelled Saturdays.']
    ],
    buildNote: 'Send us the photos on your phone and a list of what you do. We write the pages, sort the web address and have you online within 10 days &mdash; no evenings lost to a website builder.',
    freeLede: 'We design a real page for your trade business before you pay anything. If you don&rsquo;t like it, you owe nothing.'
  },
  {
    slug: 'salons',
    link: 'Salons',
    title: 'Salons',
    h1: 'Websites for salons.',
    lede: 'Hair and beauty clients check you out online before they book. Give them something worth finding.',
    desc: 'Websites for hair and beauty salons. Online booking, editable price lists, gift vouchers and galleries — built for you, from £50 a month, no setup fees.',
    features: [
      ['Online booking', 'Clients book while you&rsquo;re mid-appointment, not by leaving a voicemail you have to return.'],
      ['A price list you edit', 'Change a price or add a treatment from your phone &mdash; live in seconds, no calls to a web person.'],
      ['Your work, front and centre', 'Galleries of colour, cuts and nails &mdash; the same photos winning you clients on Instagram, on a site you own.'],
      ['Gift vouchers', 'Sold online, paid upfront &mdash; revenue in December for appointments in February.'],
      ['Deposits that stop no-shows', 'A small deposit at booking, and your quiet Tuesday stops being a no-show Tuesday.'],
      ['Offers to your client list', 'Email your regulars when there&rsquo;s a cancellation slot or a seasonal offer to fill.']
    ],
    buildNote: 'Tell us your treatments and prices and send your best photos. We build the site, the booking and the price list, and you&rsquo;re online within 10 days.',
    freeLede: 'We design a real page for your salon before you pay anything. If you don&rsquo;t love it, you owe nothing.'
  },
  {
    slug: 'barbers',
    link: 'Barbers',
    title: 'Barbers',
    h1: 'Websites for barbers.',
    lede: 'Walk-ins find you on Google Maps. A site turns them into bookings before they&rsquo;ve walked anywhere.',
    desc: 'Websites for barbershops. Online booking, price boards, opening hours and photo walls — built for you, from £50 a month, no setup fees.',
    features: [
      ['Book a chair online', 'Clients pick a barber and a time. The queue outside is optional now.'],
      ['A price board you control', 'Skin fade up a pound? Change it from your phone &mdash; the site updates instantly.'],
      ['Opening hours people trust', 'Bank holidays, early closes, that week you&rsquo;re away &mdash; always right, everywhere it&rsquo;s shown.'],
      ['A photo wall of your cuts', 'The fades and beards from your Instagram, working for you on Google too.'],
      ['Found on Maps and search', 'Set up so "barber near me" finds your shop, with your hours and your reviews.'],
      ['Loyalty for regulars', 'A tenth-cut-free counter or member perks &mdash; reasons to come back to your chair.']
    ],
    buildNote: 'Send your price list, your hours and a dozen photos. We do the rest and you&rsquo;re online within 10 days &mdash; usually sooner.',
    freeLede: 'We design a real page for your shop before you pay anything. Don&rsquo;t rate it? You owe nothing.'
  },
  {
    slug: 'cafes',
    link: 'Caf&eacute;s',
    title: 'Caf&eacute;s &amp; restaurants',
    h1: 'Websites for caf&eacute;s.',
    lede: 'Caf&eacute;s and restaurants live and die by "are they open, what&rsquo;s on the menu?" Your site answers both, always.',
    desc: 'Websites for cafés and restaurants. Editable menus, opening hours, order ahead and table bookings — built for you, from £50 a month, no setup fees.',
    features: [
      ['A menu you edit', 'Change a dish or a price from behind the counter &mdash; customers see it instantly. Mark things sold out in one tap.'],
      ['Order ahead', 'Coffee and lunch orders placed and paid before they arrive &mdash; shorter queues, bigger tickets.'],
      ['Table bookings', 'Tables booked from the site, with deposits for big groups if you want them.'],
      ['Hours that are always right', 'Holiday hours changed once, correct everywhere &mdash; no more "are you open?" calls.'],
      ['Photos that sell the room', 'The food, the counter, the corner table in the window &mdash; the reasons people cross the street.'],
      ['Found by hungry people', 'Set up so "breakfast near me" finds you, on Google and in AI chats.']
    ],
    buildNote: 'Send your menu and some photos. We build the site and the editable menu, and you&rsquo;re online within 10 days &mdash; you keep the counter running.',
    freeLede: 'We design a real page for your caf&eacute; before you pay anything. Not hungry for it? You owe nothing.'
  },
  {
    slug: 'gyms',
    link: 'Gyms',
    title: 'Gyms &amp; personal trainers',
    h1: 'Websites for gyms.',
    lede: 'Gyms and personal trainers sell commitment. A site with timetables, memberships and sign-ups makes committing easy.',
    desc: 'Websites for gyms and personal trainers. Class timetables, memberships with logins, online sign-ups and programmes — built for you, from £50 a month, no setup fees.',
    features: [
      ['Class timetables you edit', 'Change the spin slot from your phone. Members always see this week&rsquo;s real timetable.'],
      ['Memberships with logins', 'Members sign up, pay and log in on your site &mdash; the setup big chains have, at your gym.'],
      ['Payments collected monthly', 'Membership money arrives on its own. You coach; the site does the collecting.'],
      ['Programmes behind a login', 'Training plans and content only your members can see &mdash; worth the membership on its own.'],
      ['Transformations that convert', 'Before-and-after galleries and member stories &mdash; the proof that sells the first session.'],
      ['New members from search', 'Set up so "gym near me" and "personal trainer near me" find you first.']
    ],
    buildNote: 'Tell us your classes, prices and how memberships work. We build the site, timetable and member logins, and you&rsquo;re online within 10 days.',
    freeLede: 'We design a real page for your gym before you pay anything. No commitment &mdash; that part comes later.'
  },
  {
    slug: 'cleaners',
    link: 'Cleaners',
    title: 'Cleaners',
    h1: 'Websites for cleaners.',
    lede: 'Cleaning is bought on trust. A proper site with reviews and clear prices wins jobs a leaflet never will.',
    desc: 'Websites for cleaning businesses. Quote forms, service areas, reviews and recurring bookings — built for you, from £50 a month, no setup fees.',
    features: [
      ['Quotes while you clean', 'A form that asks the right questions &mdash; rooms, frequency, oven or not &mdash; so quoting takes minutes, not visits.'],
      ['Trust on the page', 'Insured, DBS-checked, years trading &mdash; said clearly, where nervous first-time customers look for it.'],
      ['Reviews doing the selling', 'Your Google reviews on your own site. In this trade, they are the deciding factor.'],
      ['Regular slots, booked once', 'Weekly and fortnightly cleans set up as repeat bookings &mdash; a steady round, not one-offs.'],
      ['The areas you cover', 'Postcodes and towns listed plainly, so enquiries come from streets you actually drive to.'],
      ['Before and after galleries', 'End-of-tenancy transformations sell deep cleans better than any wording.']
    ],
    buildNote: 'Tell us your services, prices and areas. We write the pages and build the quote form, and you&rsquo;re online within 10 days.',
    freeLede: 'We design a real page for your cleaning business before you pay anything. Not spotless? You owe nothing.'
  },
  {
    slug: 'florists',
    link: 'Florists',
    title: 'Florists',
    h1: 'Websites for florists.',
    lede: 'Flowers are bought in a hurry and by occasion. Your site should catch both &mdash; and take the payment.',
    desc: 'Websites for florists. Online orders, occasion pages, delivery areas and wedding enquiries — built for you, from £50 a month, no setup fees.',
    features: [
      ['Orders paid online', 'Bouquets ordered and paid on your site &mdash; not lost to the relay sites taking a cut.'],
      ['A page per occasion', 'Birthdays, sympathy, anniversaries, Mother&rsquo;s Day &mdash; pages that show up when people search in a hurry.'],
      ['Your arrangements, not stock photos', 'Galleries of your own work &mdash; the style that makes someone choose your shop.'],
      ['Delivery areas and cut-offs', 'Where you deliver and by when &mdash; clear before checkout, so every order is one you can fulfil.'],
      ['Wedding and event enquiries', 'A proper enquiry form for the big jobs &mdash; dates, venues, budgets &mdash; straight to your inbox.'],
      ['Seasonal changes in seconds', 'Swap the collection for Valentine&rsquo;s or Christmas from your phone.']
    ],
    buildNote: 'Send photos of your arrangements and your price ranges. We build the shop pages and order flow, and you&rsquo;re online within 10 days.',
    freeLede: 'We design a real page for your florist before you pay anything. If it doesn&rsquo;t bloom, you owe nothing.'
  },
  {
    slug: 'tutors',
    link: 'Tutors',
    title: 'Tutors',
    h1: 'Websites for tutors.',
    lede: 'Parents research tutors carefully. A proper site with subjects, results and a real booking flow settles the choice.',
    desc: 'Websites for tutors and tuition centres. Subject pages, lesson bookings, online payments and testimonials — built for you, from £50 a month, no setup fees.',
    features: [
      ['A page per subject and level', 'GCSE maths, A-level physics, 11+ &mdash; each with its own page, found by the parents searching for exactly that.'],
      ['Lessons booked and paid', 'Blocks of lessons paid online upfront &mdash; no chasing bank transfers between sessions.'],
      ['Results and testimonials', 'Grades improved and parent quotes, presented properly &mdash; your track record is the product.'],
      ['Trust, stated clearly', 'DBS checked, qualifications, exam boards covered &mdash; the checklist parents run through, answered on the page.'],
      ['Your timetable, current', 'Show which slots are free this term. When you&rsquo;re full, the site takes a waiting list.'],
      ['Found by local parents', 'Set up so "maths tutor near me" finds you, on Google and in AI chats.']
    ],
    buildNote: 'Tell us your subjects, levels and rates. We write the pages and set up bookings, and you&rsquo;re online within 10 days.',
    freeLede: 'We design a real page for your tutoring before you pay anything. Full marks or you owe nothing.'
  },
  {
    slug: 'dog-groomers',
    link: 'Dog groomers',
    title: 'Dog groomers',
    h1: 'Websites for dog groomers.',
    lede: 'Owners trust you with the dog. A site with your work, your prices and easy booking earns that trust before the first visit.',
    desc: 'Websites for dog groomers and pet services. Online booking, price lists by size and breed, galleries and reminders — built for you, from £50 a month, no setup fees.',
    features: [
      ['Appointments booked online', 'Owners book a slot without playing phone tag while you&rsquo;ve got clippers in hand.'],
      ['Prices by size and breed', 'A clear price list &mdash; puppy trim to full groom, cockapoo to newfoundland &mdash; that you edit yourself.'],
      ['Before and after gallery', 'The transformations from your phone, selling your grooming better than words ever will.'],
      ['New client details upfront', 'Vaccination, temperament and coat condition asked at booking &mdash; no surprises on the table.'],
      ['Regulars kept regular', 'Six-weekly rebooking made easy, and email reminders when a groom is due.'],
      ['Found by local owners', 'Set up so "dog groomer near me" finds you, with your reviews alongside.']
    ],
    buildNote: 'Send your price list and your best befores-and-afters. We build the site and booking, and you&rsquo;re online within 10 days.',
    freeLede: 'We design a real page for your grooming business before you pay anything. If it&rsquo;s not best in show, you owe nothing.'
  },
  {
    slug: 'gardeners',
    link: 'Gardeners',
    title: 'Gardeners &amp; landscapers',
    h1: 'Websites for gardeners.',
    lede: 'Gardeners and landscapers sell what the finished job looks like. Your site is where the finished jobs live.',
    desc: 'Websites for gardeners and landscapers. Project galleries, quote forms, seasonal services and covered areas — built for you, from £50 a month, no setup fees.',
    features: [
      ['Project galleries', 'Decking, patios, full makeovers &mdash; shown start to finish. The garden sells the next garden.'],
      ['Quotes with photos attached', 'Customers send photos of the garden with the enquiry, so you price accurately before you visit.'],
      ['A page per service', 'Lawn care, hedges, landscaping, clearances &mdash; each found by the person searching for it.'],
      ['Seasonal work, promoted in season', 'Push hedge cuts in autumn and garden makeovers in spring &mdash; the site keeps up with the calendar.'],
      ['The areas you cover', 'Villages and postcodes listed, so the jobs that come in are on your patch.'],
      ['Deposits for the big jobs', 'Landscaping booked with a deposit paid online &mdash; committed customers, protected diary.']
    ],
    buildNote: 'Send job photos and a list of services. We write the pages and build the quote form, and you&rsquo;re online within 10 days.',
    freeLede: 'We design a real page for your gardening business before you pay anything. If it doesn&rsquo;t grow on you, you owe nothing.'
  }
];

/* The cross-link strip: every industry page links the other nine, and the
   homepage links all ten, so each page is reachable by crawl, not only by
   sitemap. */
function linkStrip(exceptSlug) {
  return INDUSTRIES
    .filter((b) => b.slug !== exceptSlug)
    .map((b) => `<a href="/websites-for-${b.slug}.html">${b.link}</a>`)
    .join('');
}

function card([h, p]) {
  return `    <article class="card"><div class="card-text">
      <h3>${h}</h3>
      <p>${p}</p>
    </div></article>`;
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
<link rel="icon" href="assets/favicon.svg?v=2" type="image/svg+xml">
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
    <h1 class="reveal">${b.h1}</h1>
    <p class="lede reveal">${b.lede}</p>
  </div>
</section>

<section class="section pt0">
  <div class="wrap center">
    <h2 class="reveal">What your site can do.</h2>
    <p class="lede reveal">Everything below is built for you and included in the plan &mdash; ask for it and it gets made.</p>
  </div>
  <div class="wrap grid grid-3 reveal">
${b.features.map(card).join('\n')}
  </div>
</section>

<section class="section grey">
  <div class="wrap center">
    <h2 class="reveal">How it works.</h2>
    <p class="lede reveal">${b.buildNote}</p>
  </div>
  <div class="wrap grid grid-3 reveal">
    <article class="card"><div class="card-text">
      <h3>1. Tell us about the business</h3>
      <p>Five minutes of questions &mdash; what you do, your prices, your photos. That&rsquo;s your part done.</p>
    </div></article>
    <article class="card"><div class="card-text">
      <h3>2. We build it for you</h3>
      <p>Design, writing, web address, hosting and security &mdash; all handled by a person, all in the monthly price.</p>
    </div></article>
    <article class="card"><div class="card-text">
      <h3>3. Online within 10 days</h3>
      <p>Then it stays ours to look after: unlimited changes and new features, made for you whenever you ask.</p>
    </div></article>
  </div>
</section>

<section class="section grey cta-end">
  <div class="wrap center">
    <h2 class="reveal">See yours free, first.</h2>
    <p class="lede reveal">${b.freeLede}</p>
    <div class="cta-row reveal">
      <a class="btn btn-free" href="/free.html"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4.2" rx="1"/><path d="M4.8 12.2v7.9c0 .5.4.9.9.9h12.6c.5 0 .9-.4.9-.9v-7.9"/><path d="M12 8v13"/><path d="M12 8c0-2.5-1-4.2-2.8-4.2a2.1 2.1 0 0 0 0 4.2z"/><path d="M12 8c0-2.5 1-4.2 2.8-4.2a2.1 2.1 0 0 1 0 4.2z"/></svg>Try it free</a>
      <a class="btn btn-ghost" href="/get-started.html">Get started &rsaquo;</a>
    </div>
    <p class="micro reveal">From &pound;50 a month. No setup fees. Cancel anytime. <a href="/plans.html">See all plans</a></p>
    <p class="ask reveal">Rather talk it through? <a href="mailto:hello@kanvas.one?subject=Website%20for%20my%20business">Email us</a> and a real person will answer &mdash; usually the same working day.</p>
    <nav class="ind-links reveal" aria-label="Websites for other business types">
      <span>We also build for:</span>${linkStrip(b.slug)}
    </nav>
  </div>
</section>

</main>

<footer class="foot">
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

<script src="consent.js?v=2"></script>
<script src="supabase-config.js?v=1"></script>
<script src="session.js?v=3"></script>
<script src="script.js?v=${SCRIPT_V}"></script>
<script src="admin-pill.js?v=7"></script>
</body>
</html>
`;
}

for (const b of INDUSTRIES) {
  const file = path.join(OUT, `websites-for-${b.slug}.html`);
  fs.writeFileSync(file, page(b));
  console.log('wrote', path.basename(file));
}
