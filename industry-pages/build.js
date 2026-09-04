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
const CSS_V = 47;
const SCRIPT_V = 18;

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

const INDUSTRIES = [
  {
    slug: 'trades',
    icons: ['doc','photo','star','layers','pin','card'],
    lines: ["add a quote form with photos","show off my finished jobs","take deposits online","add my Google reviews","list the areas I cover"],
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
    icons: ['calendar','tag','photo','gift','card','mail'],
    lines: ["add online booking","update my price list","sell gift vouchers","take deposits for appointments","email my clients an offer"],
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
    icons: ['calendar','tag','clock','photo','search','repeat'],
    lines: ["let clients book a chair","update my price board","change my opening hours","show my latest cuts","add a loyalty card"],
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
    icons: ['pencil','card','calendar','clock','photo','search'],
    lines: ["build a live food menu","add order ahead","take table bookings","update my opening hours","add this week's specials"],
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
    icons: ['calendar','person','card','layers','photo','search'],
    lines: ["add a class timetable","set up memberships","add a members area","take payments monthly","show member results"],
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
    icons: ['doc','shield','star','repeat','pin','photo'],
    lines: ["add a quote form","show my before and afters","set up weekly bookings","list the areas I cover","add my reviews"],
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
    icons: ['card','layers','photo','pin','mail','pencil'],
    lines: ["sell bouquets online","add a Mother's Day page","show my arrangements","take wedding enquiries","set my delivery areas"],
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
    icons: ['layers','card','star','shield','calendar','search'],
    lines: ["add a page for GCSE maths","take lesson payments online","show my results","add a waiting list","update my timetable"],
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
    slug: 'photographers',
    icons: ['photo','calendar','card','person','tag','search'],
    lines: ["add my wedding gallery","take booking deposits","add client logins","update my packages","add an enquiry form"],
    link: 'Photographers',
    title: 'Photographers',
    h1: 'Websites for photographers.',
    lede: 'Your portfolio is your pitch. A site that shows it beautifully &mdash; and books the shoot while they&rsquo;re impressed.',
    desc: 'Websites for photographers. Portfolio galleries, enquiry forms, client galleries and booking deposits — built for you, from £50 a month, no setup fees.',
    features: [
      ['Galleries that do your work justice', 'Weddings, portraits, products &mdash; fast-loading galleries where the photos do the talking.'],
      ['Enquiries with the date attached', 'The form asks the date, venue and what they&rsquo;re after &mdash; so you reply already knowing if you&rsquo;re free.'],
      ['Deposits that hold the date', 'A booking fee paid online when they book &mdash; the date is yours and theirs, in writing.'],
      ['Client galleries behind a login', 'Deliver each shoot in a private gallery your client logs in to view, download and share.'],
      ['Packages you edit yourself', 'Your packages and prices laid out clearly &mdash; change them from your phone between seasons.'],
      ['Found for what you shoot', 'A page per genre, so "wedding photographer near me" finds the wedding work, not the whole archive.']
    ],
    buildNote: 'Send us your best shots and your packages. We build the galleries and the enquiry flow, and you&rsquo;re online within 10 days.',
    freeLede: 'We design a real page around your photos before you pay anything. If it&rsquo;s not picture perfect, you owe nothing.'
  },
  {
    slug: 'gardeners',
    icons: ['photo','doc','layers','calendar','pin','card'],
    lines: ["show my landscaping projects","add a quote form with photos","promote autumn hedge cuts","list the areas I cover","take deposits online"],
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
    <a class="hero-pill hero-pill-link reveal" href="/free.html"><svg class="gift" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.gift}</svg>Try it free<span class="pill-go" aria-hidden="true">&rsaquo;</span></a>
    <h1 class="reveal">${b.h1}</h1>
    <p class="lede reveal">${b.lede}</p>

    <!-- A request being typed, as this trade would type it. Decorative: the
         copy around it says the same things, so screen readers skip the
         animation rather than hearing it letter by letter. -->
    <div class="typebox reveal" aria-hidden="true">
      <span class="typebox-text" id="typeDemo" data-lines="${JSON.stringify(b.lines).replace(/"/g, '&quot;')}"></span>
      <span class="typebox-send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5.5 11.5 12 5l6.5 6.5"/></svg></span>
    </div>
  </div>
</section>

<section class="section pt0">
  <div class="wrap center">
    <h2 class="reveal">What your site can do.</h2>
    <p class="lede reveal">Everything below is built for you and included in the plan &mdash; ask for it and it gets made.</p>
  </div>
  <div class="wrap grid reveal">
${b.features.map((f, i) => card(f, b.icons[i], ICO_COLORS[i % ICO_COLORS.length])).join('\n')}
  </div>
</section>

<section class="section grey">
  <div class="wrap center">
    <h2 class="reveal">How it works.</h2>
    <p class="lede reveal">${b.buildNote}</p>
  </div>
  <div class="wrap grid grid-3 reveal">
    <article class="card">
      <div class="ico ico-blue"><span class="step-n">1</span></div>
      <div class="card-text">
        <h3>Tell us about the business</h3>
        <p>Five minutes of questions &mdash; what you do, your prices, your photos. That&rsquo;s your part done.</p>
      </div>
    </article>
    <article class="card">
      <div class="ico ico-purple"><span class="step-n">2</span></div>
      <div class="card-text">
        <h3>We build it for you</h3>
        <p>Design, writing, web address, hosting and security &mdash; all handled by a person, all in the monthly price.</p>
      </div>
    </article>
    <article class="card">
      <div class="ico ico-green"><span class="step-n">3</span></div>
      <div class="card-text">
        <h3>Online within 10 days</h3>
        <p>Then it stays ours to look after: unlimited changes and new features, made for you whenever you ask.</p>
      </div>
    </article>
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
