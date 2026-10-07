/* Local landing pages: one per area we advertise in, for the searches a
 * business owner types when they want a new site ("web design Newcastle",
 * "website designer Northumberland"). Same template as the trade pages,
 * with the offer in the title, a plain comparison with a local agency,
 * the towns we cover, and questions answered the way an AI answer would
 * quote them. Each page is written for its own area, not a copy with the
 * town swapped.
 */
'use strict';

const STARTER_ICONS = ['layers', 'search', 'mail', 'photo', 'person', 'pencil'];
const STARTER_TRUST = ['Free design first', '&pound;12.50 first month', 'Web address included', 'Cancel anytime'];

function features(t) {
  return [
    ['A live website, built for you', t.live],
    ['Found on Google and AI search', t.google + ' Your Google listing linked, so you show on the map too.'],
    ['Enquiries that come straight to you', 'A contact or quote form that lands in your inbox, and a button to ring you from any page.'],
    ['Your work, shown off properly', 'Photos, prices, reviews and opening hours, laid out so a customer decides in seconds.'],
    ['Click to call, WhatsApp and Instagram', 'One tap from any page to ring you, message you, or see your latest work.'],
    ['Edits whenever you need them', 'New prices, new photos, new dates. Send as many as you like from your phone and we make them for you.']
  ];
}

const STEPS = [
  ['Send us your business', 'Your name and a link to you anywhere online: Facebook, Instagram, an old site.'],
  ['We design it, free, within 24 hours', 'A real page for your business in your inbox. Nothing to pay to see it.'],
  ['&pound;12.50 and you&rsquo;re online tomorrow', 'Love it? Join for &pound;12.50 and it&rsquo;s live on your own web address. Then &pound;25 a month, cancel any month.']
];

const PROMISE = {
  name: 'The See It First Promise',
  lines: [
    'We design a real page for your business within 24 hours, free, before you join. Don&rsquo;t love it? You owe nothing.',
    'Live on your own address the same day you join.',
    'Cancel anytime. Your site comes down, your domain stays yours, and there is no exit fee.'
  ]
};

/* The comparison a business owner is really making. Agency figures are
   the typical range for a small business site, said as typical. */
function compare(area) {
  const rows = [
    ['See your site before you pay', 'Rarely. A deposit first, a design weeks later', 'Yes. Free, in your inbox within 24 hours'],
    ['Paid up front', 'Often &pound;1,000 to &pound;3,000 or more', '&pound;12.50'],
    ['Each month', 'Hosting, the web address and changes often billed on top', '&pound;25. Web address, hosting, security and support included'],
    ['Time to go live', 'Usually weeks', 'Online tomorrow'],
    ['Changes', 'Usually charged by the hour', 'As many edits as you need, made by us. Within 48 hours on Business'],
    ['If you leave', 'Often a 12-month contract', 'Cancel any month. Your web address is transferred to you free']
  ];
  return `<section class="section">
  <div class="wrap center">
    <h2 class="reveal">${area} web design, compared.</h2>
    <p class="lede reveal">What a small business site usually costs from a local agency, and what it costs with us.</p>
  </div>
  <div class="wrap cmp-wrap reveal">
    <table class="cmp cmp-2">
      <caption class="sr-only">A typical local web design agency compared with Kanvas One</caption>
      <thead>
        <tr><td></td><th scope="col">A typical agency</th><th scope="col" class="cmp-hot">Kanvas One<span>from &pound;25 a month</span></th></tr>
      </thead>
      <tbody>
${rows.map(([k, a, b]) => `        <tr><th scope="row">${k}</th><td>${a}</td><td class="cmp-hot">${b}</td></tr>`).join('\n')}
      </tbody>
    </table>
  </div>
</section>
`;
}

function areas(title, intro, towns, other) {
  return `<section class="section grey">
  <div class="wrap center">
    <h2 class="reveal">${title}</h2>
    <p class="lede reveal">${intro}</p>
    <div class="also-pills reveal">${towns.map((t) => `<span class="use-chip">${t}</span>`).join('')}</div>
    <p class="micro reveal area-other">${other}</p>
  </div>
</section>
`;
}

const LOCAL_FAQ_END = [
  ['Can I see my website before I pay?', 'Yes. Send us your business name and a link to you anywhere online, and we design a real page and email it to you within 24 hours. No card. If you don&rsquo;t love it, you owe nothing.'],
  ['I already have a website. Can you do better?', 'Send us the link and we&rsquo;ll design a new one free, so you can compare. If you switch and want to keep your web address, we move it over for you.'],
  ['Can I add bookings or payments later?', 'Yes. Move to Business, &pound;50 a month, any month, and we add online bookings, payments, live chat and priority changes within 48 hours.'],
  ['What happens if I cancel?', 'No exit fee and no contract. Your site goes offline and your web address is transferred to you free.']
];

module.exports = [
  {
    slug: 'newcastle',
    file: 'web-design-newcastle',
    rich: true,
    icons: STARTER_ICONS,
    docTitle: 'Web Design Newcastle: Free Design, Websites from £25 a Month | Kanvas One',
    ogTitle: 'Web design in Newcastle: see your website free, then from £25 a month',
    serviceName: 'Website design for small businesses in Newcastle upon Tyne',
    areaServed: [
      { '@type': 'City', name: 'Newcastle upon Tyne' },
      { '@type': 'AdministrativeArea', name: 'North Tyneside' },
      { '@type': 'City', name: 'Gateshead' },
      { '@type': 'AdministrativeArea', name: 'Northumberland' }
    ],
    lines: ['make me a website for my business', 'get me found on Google in Newcastle', 'put my prices online', 'add a quote form', 'add my Google reviews'],
    link: 'Newcastle',
    title: 'Newcastle',
    h1: 'Web design in Newcastle, without the agency bill.',
    lede: 'See your new website free within 24 hours, before you pay a penny. Love it? It&rsquo;s online tomorrow for &pound;12.50, then &pound;25 a month with your web address, hosting and changes included.',
    heroNote: 'Small business websites for Newcastle, North Tyneside, Gateshead and Northumberland. No card to see your design.',
    trust: STARTER_TRUST,
    trustLine: 'Send us your Facebook, Instagram or old site. We do the rest.',
    desc: 'Web design in Newcastle for small businesses. See your new website free within 24 hours, then it’s online tomorrow for £12.50 and £25 a month, web address, hosting and changes included. No agency fees, cancel any month.',
    placeholder: 'e.g. Jesmond Joinery',
    features: features({
      live: 'A proper site for your business, designed, written and put online by us. You don&rsquo;t touch a thing.',
      google: 'Written around what people in Newcastle actually search: &ldquo;electrician Heaton&rdquo;, &ldquo;cake maker Gosforth&rdquo;, &ldquo;nails Whitley Bay&rdquo;.'
    }),
    extra: compare('Newcastle') + areas(
      'Across Newcastle and North Tyneside.',
      'We work with businesses all over Tyneside, from Gosforth to the coast. Everything is done online, so you get your site without a single meeting.',
      ['Newcastle city centre', 'Gosforth', 'Jesmond', 'Heaton', 'Fenham', 'Byker', 'Kenton', 'Walker', 'Benton', 'Gateshead', 'North Shields', 'Tynemouth', 'Whitley Bay', 'Wallsend', 'Killingworth', 'Longbenton', 'Forest Hall', 'Cullercoats'],
      'Further north? See <a href="/web-design-northumberland">web design in Northumberland</a>. Anywhere else in the UK, we build for you the same way.'
    ),
    buildNote: 'Send us your business name and a link to you online. We design the site and you see it within 24 hours.',
    steps: STEPS,
    stepsLine: 'Business, &pound;50 a month, adds bookings, payments, live chat and priority changes within 48 hours, any month.',
    maxPitch: { heading: 'Want us to go and get you customers?', text: 'Starter gets you a proper site and found on Google. Max runs your ads and works on your Google ranking every month, for businesses that want to grow fast.' },
    promise: PROMISE,
    pricingExtra: ['&pound;25 a month is under &pound;6 a week, no VAT. Most agencies charge that for hosting alone.'],
    faq: [
      ['How much does a website cost in Newcastle?', 'From a local agency, a small business website typically costs &pound;1,000 to &pound;3,000 or more up front, with hosting and changes often charged on top. With Kanvas One you see your design free, pay &pound;12.50 to go live, then &pound;25 a month with your web address, hosting, security, support and unlimited edits included. No VAT.'],
      ['How quickly can my website be live?', 'You see your design within 24 hours. Once you join, it&rsquo;s live on your own web address the same day, so most businesses are online the day after they first message us.'],
      ['Is the web address included?', 'Yes. We register your web address (yourbusiness.co.uk or similar) and renew it for as long as you&rsquo;re with us. If you already own one, we use that instead.'],
      ['Will my site show up on Google in Newcastle?', 'Every site is written around what customers in your area search for, set up for Google and AI search, and linked to your Google listing. No honest company can promise you the top spot. Max, &pound;250 a month, works on your ranking every month.'],
      ['Are you local?', 'Yes. We&rsquo;re a North East team working with businesses across Newcastle, North Tyneside and Northumberland, including a dance school in North Tyneside and a dog trainer in Newcastle. Everything is done online, and you can message us any time.']
    ].concat(LOCAL_FAQ_END),
    endLine: 'Got a question? Email <a href="mailto:hello@kanvas.one?subject=Website%20for%20my%20Newcastle%20business">hello@kanvas.one</a> and we reply.',
    linksLabel: 'Websites for:'
  },
  {
    slug: 'northumberland',
    file: 'web-design-northumberland',
    rich: true,
    icons: STARTER_ICONS,
    docTitle: 'Web Design Northumberland: Free Design, From £25 a Month | Kanvas One',
    ogTitle: 'Web design in Northumberland: see your website free, then from £25 a month',
    serviceName: 'Website design for small businesses in Northumberland',
    areaServed: [
      { '@type': 'AdministrativeArea', name: 'Northumberland' },
      { '@type': 'City', name: 'Cramlington' },
      { '@type': 'City', name: 'Morpeth' },
      { '@type': 'City', name: 'Blyth' },
      { '@type': 'City', name: 'Hexham' },
      { '@type': 'City', name: 'Alnwick' },
      { '@type': 'City', name: 'Ashington' }
    ],
    lines: ['make me a website for my business', 'show up when people search in Morpeth', 'add the towns I cover', 'add my Facebook reviews', 'add a booking button'],
    link: 'Northumberland',
    title: 'Northumberland',
    h1: 'Web design in Northumberland, from &pound;25 a month.',
    lede: 'Your Facebook page doesn&rsquo;t show up when someone in Cramlington or Morpeth searches for what you do. A proper website does. See yours free within 24 hours. Online tomorrow for &pound;12.50, then &pound;25 a month.',
    heroNote: 'Small business websites for Cramlington, Blyth, Morpeth, Ashington, Hexham, Alnwick and every town between. No card to see your design.',
    trust: STARTER_TRUST,
    trustLine: 'Send us your Facebook or Instagram. We do the rest.',
    desc: 'Web design in Northumberland for small businesses in Cramlington, Blyth, Morpeth, Ashington, Hexham and Alnwick. See your website free within 24 hours, then online tomorrow for £12.50 and £25 a month, web address included.',
    placeholder: 'e.g. Morpeth Mobile Valeting',
    features: features({
      live: 'A proper site for your business, designed, written and put online by us. Built from your Facebook page if that&rsquo;s all you have.',
      google: 'Every town you cover named on your site, so you come up for &ldquo;plumber Blyth&rdquo;, &ldquo;dog groomer Hexham&rdquo; or &ldquo;cakes Cramlington&rdquo;, not just where you&rsquo;re based.'
    }),
    extra: compare('Northumberland') + areas(
      'Across Northumberland.',
      'From the south-east towns to the market towns and the coast. In a county this size, customers search by town, so your site names every place you cover.',
      ['Cramlington', 'Blyth', 'Morpeth', 'Ashington', 'Bedlington', 'Seaton Delaval', 'Seaton Sluice', 'Ponteland', 'Newbiggin-by-the-Sea', 'Hexham', 'Prudhoe', 'Corbridge', 'Alnwick', 'Amble', 'Rothbury', 'Wooler', 'Berwick-upon-Tweed', 'Haltwhistle'],
      'Closer to the city? See <a href="/web-design-newcastle">web design in Newcastle</a>. Anywhere else in the UK, we build for you the same way.'
    ),
    buildNote: 'Send us your business name and your Facebook or Instagram. We design the site and you see it within 24 hours.',
    steps: STEPS,
    stepsLine: 'Business, &pound;50 a month, adds bookings, payments, live chat and priority changes within 48 hours, any month.',
    maxPitch: { heading: 'Want us to go and get you customers?', text: 'Starter gets you a proper site and found on Google. Max runs your ads and works on your Google ranking every month, for businesses that want to grow fast.' },
    promise: PROMISE,
    pricingExtra: ['&pound;25 a month is under &pound;6 a week, no VAT. No setup fee and no contract.'],
    faq: [
      ['How much does a website cost in Northumberland?', 'A small business website from an agency typically costs &pound;1,000 to &pound;3,000 or more up front, plus hosting and changes. With Kanvas One you see your design free, pay &pound;12.50 to go live, then &pound;25 a month with your web address, hosting, security, support and unlimited edits included. No VAT.'],
      ['I only have a Facebook page. Is that enough to start?', 'Yes. Plenty of businesses start from just a Facebook or Instagram page. We take your photos, services and reviews from it and design the site for you.'],
      ['I cover lots of towns. Will I show up in all of them?', 'Your site names every town you cover, written the way people search, and links to your Google listing. No honest company can promise the top spot. Max, &pound;250 a month, works on your ranking town by town every month.'],
      ['How quickly can my website be live?', 'You see your design within 24 hours. Once you join, it&rsquo;s live on your own web address the same day.'],
      ['Are you local?', 'Yes. We&rsquo;re a North East team working with businesses across Northumberland, Newcastle and North Tyneside. Everything is done online, so it&rsquo;s the same whether you&rsquo;re in Cramlington or Berwick.']
    ].concat(LOCAL_FAQ_END),
    endLine: 'Got a question? Email <a href="mailto:hello@kanvas.one?subject=Website%20for%20my%20Northumberland%20business">hello@kanvas.one</a> and we reply.',
    linksLabel: 'Websites for:'
  }
];
