/* The nine industry pages, as data. build.js turns each entry into a page.
 *
 * Every page follows the same shape, written to the same rules:
 *
 *   h1        the outcome for this trade, with "Websites for X" in it for
 *             search. One sentence, no exclamation marks.
 *   lede      the four things people weigh up, in their order: the result,
 *             why it will work for them, how soon, how little they must do.
 *   heroNote  the risk taken off them, in one line.
 *   features  six plain cards, the same six on every page in this trade's
 *             words. What the site does, not how: the how is agreed with
 *             each customer after they join, so no page promises a build
 *             that takes the full ten days to get right.
 *   also      the extras, named. Small, real, quick to add.
 *   promise   the guarantee, with a name so it is remembered.
 *   pricingExtra  the price anchored to one job they already do.
 *   faq       the objections we hear, answered straight.
 *
 * Prices and claims here are the real ones: from £25 a month, no VAT, live in
 * live the same day, cancel anytime, the domain is theirs. Nothing is promised that
 * we do not do.
 */

const PROMISE = {
  name: 'The See It First Promise',
  lines: [
    'We design a real page for your business within 24 hours, free, before you join. Don&rsquo;t love it? You owe nothing.',
    'Live on your own address the same day you join. Your features built within 14 days, or your next month is free.',
    'Cancel anytime. Your site comes down, your domain stays yours, and there is no exit fee.'
  ]
};


/* Two businesses on Kanvas One, named by trade only. Same two on the
   homepage and on every trade page: proof is proof. */
const CASES = [
  { tag: 'Dance school', title: 'Enquiries every day, onboarded without lifting a finger', text: 'Free trial classes are booked through the site. Each one is confirmed by email and the family is onboarded automatically, so the academy hears from new students daily and never chases a form.' },
  { tag: 'Dog trainer', title: 'A new business. Fully booked, with a waiting list.', text: 'Started from nothing. Now near the top of Google locally for dog training, booked solid, and running a waiting list straight from the site.' }
];

const TRUST = ['No VAT', 'No setup fees', 'Live the same day', 'Cancel anytime'];
const ICONS = ['layers', 'search', 'card', 'calendar', 'star', 'person'];
const ALSO_TITLE = 'Also included, no extra cost';

/* The six cards. Each trade passes its own words for the three that
   differ - who is looking, what they book or order, what a record is. */
function features(t) {
  return [
    ['A live website, built for you', 'Your services, prices, hours, photos and team. ' + t.live],
    ['Found on Google in your area', t.google + ' Your Google listing linked, so you show on the map too.'],
    ['Accept payments online', t.pay + ' Straight to your bank.'],
    [t.bookTitle, t.book],
    ['Reviews asked for automatically', t.reviews + ' The best ones show on your site.'],
    ['Your customers in one place', t.records]
  ];
}

function steps(one) {
  return [
    one,
    ['We build it for you', 'Design, writing, web address, hosting and security. All done by us, all in the price.'],
    ['Live the same day, features in 14', 'Live on your own address the day you join. Your features within 14 days, or your next month is free. Then unlimited changes, within 48 hours.']
  ];
}

function endLine(subject) {
  return 'Got a question? Email <a href="mailto:hello@kanvas.one?subject=' + encodeURIComponent(subject) + '">hello@kanvas.one</a> and we reply.';
}

const COMMON_FAQ = [
  ['What if I don&rsquo;t like it?', 'You see your page within 24 hours, before you pay. Don&rsquo;t love it? You owe nothing.'],
  ['Do I have to take card payments?', 'No. Cash and bank transfer work too.'],
  ['How do the bookings and payments actually work?', 'We set them up with you after you join, the way you already work. Five minutes.'],
  ['Do I need Max?', 'Only if you want to climb Google every month. Business includes local SEO at launch.'],
  ['What happens if I cancel?', 'No exit fee. Your site goes offline and your domain transfers to you free.']
];

const MAX_HEADING = 'Want us to go and get you customers?';

/* The Starter-first pages: one per business type we advertise to. Every
   card here is on the £25 plan, so nothing on these pages needs Business
   to be true. The offer reads the same as the ads and /free: a free design
   in 24 hours, £12.50 today to go live, then £25 a month. */
const STARTER_ICONS = ['layers', 'search', 'mail', 'photo', 'person', 'pencil'];
const STARTER_TRUST = ['&pound;12.50 today', 'Web address included', 'Live the same day', 'Cancel anytime'];
const STARTER_NOTE = 'Free design within 24 hours, no card. Love it? &pound;12.50 puts it live, then &pound;25 a month, no VAT.';
const STARTER_ALSO_TITLE = 'Want bookings, payments or live chat too?';

function starterFeatures(t) {
  return [
    ['A live website, built for you', t.live],
    ['Found on Google and AI search', t.google + ' Your Google listing linked, so you show on the map too.'],
    [t.formTitle, t.form],
    ['Your work, shown off properly', t.gallery],
    ['Click to call, WhatsApp and Instagram', 'One tap from any page to ring you, message you, or see your latest work on Instagram.'],
    ['A change every month, made by us', 'New prices, new photos, new dates. Message us from your phone and it&rsquo;s done.']
  ];
}

function starterSteps(one) {
  return [
    one,
    ['We design it, free, within 24 hours', 'A real page for your business in your inbox. Nothing to pay to see it.'],
    ['&pound;12.50 and you&rsquo;re live', 'Love it? Join for &pound;12.50 and it&rsquo;s live on your own web address the same day. Then &pound;25 a month, cancel any month.']
  ];
}

const STARTER_FAQ = [
  ['What does it cost?', 'Nothing to see your design. &pound;12.50 today puts it live, with your web address included. Then &pound;25 a month, no VAT, cancel any month.'],
  ['What if I don&rsquo;t like it?', 'You see your page within 24 hours, before you pay. Don&rsquo;t love it? You owe nothing.'],
  ['Can I add bookings or payments later?', 'Yes. Move to Business, &pound;50 a month, any month, and we add them for you.'],
  ['What happens if I cancel?', 'No exit fee. Your site goes offline and your domain transfers to you free.']
];



module.exports = [
  {
    slug: 'trades',
    rich: true,
    icons: ICONS,
    lines: ['confirm callouts by email', 'take a callout fee up front', 'remind last year’s customers their service is due', 'add a WhatsApp button', 'add a page for every town I cover'],
    link: 'Trades',
    title: 'Trades',
    h1: 'Websites for trades that win the next job.',
    lede: 'Found on Google in the towns you cover. Callouts booked and paid through your site. Reviews asked for after every job.',
    heroNote: 'Free page within 24 hours. If you don&rsquo;t love it, you owe nothing. From &pound;25 a month, no VAT.',
    trust: TRUST,
    trustLine: 'All included. You send photos from your phone. We do the rest.',
    desc: 'Websites for plumbers, electricians, builders and roofers. Found on Google locally, callouts booked and paid online, reviews asked for automatically. Built for you, live the same day you join, from £25 a month, no VAT.',
    features: features({
      live: 'Click to call and WhatsApp on every page, and your trade badges where people look for them.',
      google: 'A page for every service and every town you cover, written for the searches people actually type.',
      pay: 'A callout fee up front, a deposit on a bigger job, or the balance when it is done.',
      bookTitle: 'Callouts booked through your website',
      book: 'A customer picks a service and a time that suits you, or sends a quote request with photos of the problem.',
      reviews: 'A day after each job the customer gets a friendly email asking for a Google review.',
      records: 'Every callout, quote and payment against the customer, with your notes, so next year&rsquo;s service is a click away.'
    }),
    alsoTitle: ALSO_TITLE,
    also: ['Trade badges (Gas Safe, NICEIC)', 'Photo galleries of finished jobs', 'Google reviews on your site', 'Areas covered', 'Emergency callout banner', 'Team page', 'Google Calendar link'],
    buildNote: 'Send us the photos on your phone and a list of what you do. We write the pages and you&rsquo;re live the same day.',
    steps: steps(['Tell us your trade, your patch and how you like to work', 'What you do, where you cover, how customers book and pay.']),
    stepsLine: 'Unlimited changes included. Message us from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'The trades on page one for &ldquo;electrician Cramlington&rdquo; keep adding pages and reviews. Business gets you there. Max keeps you there, every month.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. One callout a month covers it twice over. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I get all my work from word of mouth. Why do I need a site?', 'Word of mouth ends with a Google search. They look you up before they ring. Your site is where the recommendation lands.'],
      ['I&rsquo;ve already got a Facebook page.', 'Keep it. Facebook doesn&rsquo;t show up for &ldquo;plumber Blyth&rdquo;. Your site does, and takes the booking while you&rsquo;re on a job.'],
      ['Can customers still just ring or WhatsApp me?', 'Yes. The site handles the confirmation and the paperwork.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my trade'),
    freeLede: 'We design a real page for your trade business, in your inbox within 24 hours, before you pay. If you don&rsquo;t like it, you owe nothing.'
  },

  {
    slug: 'salons',
    rich: true,
    icons: ICONS,
    lines: ['add online booking', 'update my price list', 'sell gift vouchers', 'take deposits for appointments', 'remind clients when they’re due a rebook'],
    link: 'Salons',
    title: 'Salons',
    h1: 'Websites for salons that fill the diary.',
    lede: 'Found by clients nearby on Google. Appointments booked and paid through your site, day or night. Reviews asked for after every visit.',
    heroNote: 'Free page within 24 hours. If you don&rsquo;t love it, you owe nothing. From &pound;25 a month, no VAT.',
    trust: TRUST,
    trustLine: 'All included. Send your price list and your best photos. We do the rest.',
    desc: 'Websites for hair and beauty salons. Found on Google nearby, appointments booked and paid online, reviews asked for automatically. Built for you, live the same day you join, from £25 a month, no VAT.',
    features: features({
      live: 'Your treatment menu and prices, your stylists, and the photos winning you clients on Instagram.',
      google: 'A page for every treatment, written for what people search: &ldquo;balayage Morpeth&rdquo;, &ldquo;gel nails near me&rdquo;.',
      pay: 'A deposit at booking so no-shows stop, or the full treatment paid up front. Gift vouchers sold online too.',
      bookTitle: 'Appointments booked through your website',
      book: 'A client picks a treatment, a stylist and a time, from their phone, at 10pm if they like.',
      reviews: 'A day after each appointment the client gets a friendly email asking for a Google review.',
      records: 'Every appointment and payment against the client, with your notes on what they had last time.'
    }),
    alsoTitle: ALSO_TITLE,
    also: ['Stylist profiles', 'Treatment menu by category', 'Instagram feed on the site', 'Gift vouchers', 'Google reviews on your site', 'Late availability banner', 'Google Calendar link'],
    buildNote: 'Tell us your treatments and prices and send your best photos. We build the site and the booking, and you&rsquo;re live the same day.',
    steps: steps(['Tell us your treatments, your prices and your team', 'What you offer, who does what, how you want bookings to work.']),
    stepsLine: 'Unlimited changes included. Message us from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'The salons top for &ldquo;hairdresser near me&rdquo; keep adding pages, reviews and photos. Business gets you there. Max keeps you there.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. One colour appointment a month covers it twice over. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I already take bookings on Instagram and Facebook.', 'Keep them. Instagram doesn&rsquo;t show up for &ldquo;hairdresser near me&rdquo;. Your site does, and takes the booking while you&rsquo;re with a client.'],
      ['I use a booking app already. Will this replace it?', 'It can, or link to the one you have. Either way, clients book from your own site.'],
      ['Can I change prices myself?', 'Yes, from your dashboard, or message us and we do it for you.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my salon'),
    freeLede: 'We design a real page for your salon, in your inbox within 24 hours, before you pay. If you don&rsquo;t love it, you owe nothing.'
  },

  {
    slug: 'barbers',
    rich: true,
    icons: ICONS,
    lines: ['let clients book a chair', 'update my price board', 'change my opening hours', 'show my latest cuts', 'add a loyalty card'],
    link: 'Barbers',
    title: 'Barbers',
    h1: 'Websites for barbers that keep the chair full.',
    lede: 'Found on Google Maps by people looking for a barber right now. A chair booked and paid through your site. Reviews asked for after every cut.',
    heroNote: 'Free page within 24 hours. If you don&rsquo;t rate it, you owe nothing. From &pound;25 a month, no VAT.',
    trust: TRUST,
    trustLine: 'All included. Send your price list, your hours and a dozen photos. We do the rest.',
    desc: 'Websites for barbershops. Found on Google Maps, a chair booked and paid online, reviews asked for automatically. Built for you, live the same day you join, from £25 a month, no VAT.',
    features: features({
      live: 'Your price board, your hours, your barbers, and the fades and beards from your Instagram.',
      google: 'Set up so &ldquo;barber near me&rdquo; finds your shop first, with your hours and prices right there in the result.',
      pay: 'Pay when they book, so the people who book are the people who turn up. Or pay at the chair, your call.',
      bookTitle: 'A chair booked through your website',
      book: 'A client picks a barber and a time from their phone. Walk-ins still welcome.',
      reviews: 'A day after each cut the client gets a friendly email asking for a Google review.',
      records: 'Every booking and payment against the client, so the regulars stay regular.'
    }),
    alsoTitle: ALSO_TITLE,
    also: ['Barber profiles', 'Price board', 'Instagram feed on the site', 'Gift vouchers', 'Google reviews on your site', 'Walk-in wait time banner', 'Google Calendar link'],
    buildNote: 'Send your price list, your hours and a dozen photos. We do the rest and you&rsquo;re live the same day.',
    steps: steps(['Tell us your prices, your hours and your barbers', 'What you charge, when you open, who works which days.']),
    stepsLine: 'Unlimited changes included. Message us from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'Six barbers within a mile, all on Google. The one that keeps adding reviews and pages stays top. Business gets you there. Max keeps you there.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. Two cuts a month covers it. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I&rsquo;m walk-in only. Do I need bookings?', 'No. Plenty of shops stay walk-in and use the site for hours, prices and Google. Bookings are there if you want them.'],
      ['I&rsquo;ve got Instagram. Isn&rsquo;t that enough?', 'Instagram is where your work gets seen. Google is where someone finds a barber right now. The site gives you both.'],
      ['Can I change prices and hours myself?', 'Yes, from your dashboard, or message us and we do it.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my barbershop'),
    freeLede: 'We design a real page for your shop, in your inbox within 24 hours, before you pay. Don&rsquo;t rate it? You owe nothing.'
  },

  {
    slug: 'coffee-shops',
    rich: true,
    icons: ICONS,
    lines: ['build a live drinks menu', 'add order ahead', 'add a loyalty card', 'update my opening hours', "add this week's specials"],
    link: 'Coffee shops',
    title: 'Coffee shops',
    h1: 'Websites for coffee shops that bring people back.',
    lede: '&ldquo;Are they open, what&rsquo;s on?&rdquo; answered on Google before they ask. Orders paid through your site. Reviews asked for automatically.',
    heroNote: 'Free page within 24 hours. If it&rsquo;s not your cup, you owe nothing. From &pound;25 a month, no VAT.',
    trust: TRUST,
    trustLine: 'All included. Send your menu and some photos. We do the rest.',
    desc: 'Websites for coffee shops. Found on Google nearby, menu and hours always right, orders paid online, reviews asked for automatically. Built for you, live the same day you join, from £25 a month, no VAT.',
    features: features({
      live: 'Your menu, your hours, holiday hours changed once and right everywhere, and the photos that sell the room.',
      google: 'Set up so &ldquo;coffee near me&rdquo; finds you first, with your hours and photos in the result.',
      pay: 'Orders, gift cards and event tickets paid online, no commission to a delivery app.',
      bookTitle: 'Orders through your website',
      book: 'A customer orders and pays before they arrive, or books the back room for a party.',
      reviews: 'Customers who order online get a friendly email asking for a Google review.',
      records: 'Every order against the customer, so you can email your regulars when there is a new bake.'
    }),
    alsoTitle: ALSO_TITLE,
    also: ['Menu with allergen labels', 'Opening and holiday hours', 'Instagram feed on the site', 'Gift cards', 'Google reviews on your site', 'Catering enquiry form', 'Wholesale or beans page'],
    buildNote: 'Send your menu and some photos. We build the site and you&rsquo;re live the same day.',
    steps: steps(['Tell us your menu, your hours and what you want to sell online', 'What&rsquo;s on the board, when you open, whether you want orders online.']),
    stepsLine: 'Unlimited changes included. Message us from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'Visitors search &ldquo;coffee near me&rdquo; and pick from the top three. Business gets you in the running. Max keeps you there, every season.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. Eight flat whites a month covers it. Under &pound;6 a week, no VAT.'],
    faq: [
      ['People find us on Instagram. Do we need a site?', 'Your regulars do. The person who just parked up and typed &ldquo;coffee near me&rdquo; doesn&rsquo;t. The site puts you in that list.'],
      ['Can I change the menu myself?', 'Yes, from your dashboard, or message us and we do it.'],
      ['What about delivery apps?', 'Keep them if they work. Orders through your own site have no commission.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my coffee shop'),
    freeLede: 'We design a real page for your coffee shop, in your inbox within 24 hours, before you pay. Not your cup? You owe nothing.'
  },

  {
    slug: 'gyms',
    rich: true,
    icons: ICONS,
    lines: ['add a class timetable', 'set up memberships', 'add a members area', 'take payments monthly', 'show member results'],
    link: 'Gyms &amp; personal trainers',
    title: 'Gyms &amp; personal trainers',
    h1: 'Websites for gyms that sign members up.',
    lede: 'Found on Google by people looking for a gym or a trainer nearby. Memberships and sessions paid through your site. Reviews asked for automatically.',
    heroNote: 'Free page within 24 hours. If you don&rsquo;t love it, you owe nothing. From &pound;25 a month, no VAT.',
    trust: TRUST,
    trustLine: 'All included. Tell us your classes and prices. We do the rest.',
    desc: 'Websites for gyms and personal trainers. Found on Google nearby, memberships and sessions paid online, reviews asked for automatically. Built for you, live the same day you join, from £25 a month, no VAT.',
    features: features({
      live: 'Your classes, your prices, your trainers, and the before and after photos that sell the first session.',
      google: 'Set up so &ldquo;gym near me&rdquo; and &ldquo;personal trainer near me&rdquo; find you first, with your reviews in the result.',
      pay: 'Memberships paid monthly on their own, or a block of sessions paid up front. The money arrives without chasing.',
      bookTitle: 'Classes and sessions booked through your website',
      book: 'A member picks a class or a session and a time, from their phone.',
      reviews: 'A few weeks into membership the member gets a friendly email asking for a Google review.',
      records: 'Every membership, booking and payment against the member, with a members area for the things only they should see.'
    }),
    alsoTitle: ALSO_TITLE,
    also: ['Trainer profiles', 'Class timetable', 'Members area', 'Free trial booking', 'Google reviews on your site', 'Transformation gallery', 'Google Calendar link'],
    buildNote: 'Tell us your classes, prices and how memberships work. We build the site and you&rsquo;re live the same day.',
    steps: steps(['Tell us your classes, your prices and how memberships work', 'What you run, what it costs, whether there is a trial.']),
    stepsLine: 'Unlimited changes included. Message us from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'January is decided in December. Business gets you ranking at launch. Max keeps you climbing every month.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. One membership a month covers it twice over. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I use a gym app for memberships already.', 'Keep it, or let the site take memberships with no per-member fees. Either way, new members find you on Google.'],
      ['I&rsquo;m a personal trainer, not a gym. Is this for me?', 'Yes. Sessions booked and paid online, a page that ranks for &ldquo;personal trainer near me&rdquo;. Same price.'],
      ['Can I change the timetable myself?', 'Yes, from your dashboard, or message us and we do it.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my gym'),
    freeLede: 'We design a real page for your gym, in your inbox within 24 hours, before you pay. No commitment. That part comes later.'
  },

  {
    slug: 'cleaners',
    rich: true,
    icons: ICONS,
    lines: ['add a quote form', 'show my before and afters', 'set up weekly bookings', 'remind last year’s deep cleans they’re due', 'add my reviews'],
    link: 'Cleaners',
    title: 'Cleaners',
    h1: 'Websites for cleaners that win the regular round.',
    lede: 'Found on Google in the areas you cover. Cleans booked and paid through your site. Reviews asked for after every visit, where nervous first timers look.',
    heroNote: 'Free page within 24 hours. If it&rsquo;s not spotless, you owe nothing. From &pound;25 a month, no VAT.',
    trust: TRUST,
    trustLine: 'All included. Tell us your services, prices and areas. We do the rest.',
    desc: 'Websites for cleaning businesses. Found on Google in your areas, cleans booked and paid online, reviews asked for automatically. Built for you, live the same day you join, from £25 a month, no VAT.',
    features: features({
      live: 'Your services and prices, the areas you cover, insured and DBS checked said clearly, and before and after photos.',
      google: 'A page for every service and every town on your round, written for &ldquo;cleaner Ashington&rdquo; and &ldquo;end of tenancy clean near me&rdquo;.',
      pay: 'Weekly cleans paid on their own, a deposit on a deep clean, or pay when it is done.',
      bookTitle: 'Cleans booked through your website',
      book: 'A customer asks for a quote with photos, or books a regular slot that suits you.',
      reviews: 'A day after each clean the customer gets a friendly email asking for a Google review. In this trade they are the deciding factor.',
      records: 'Every booking and payment against the customer, with their address and your notes.'
    }),
    alsoTitle: ALSO_TITLE,
    also: ['Price guide by property size', 'What a clean includes', 'Areas covered', 'Before and after gallery', 'Google reviews on your site', 'Team page', 'Landlord and letting agent page'],
    buildNote: 'Tell us your services, prices and areas. We write the pages and you&rsquo;re live the same day.',
    steps: steps(['Tell us your services, your prices and your patch', 'What you clean, what you charge, where you go.']),
    stepsLine: 'Unlimited changes included. Message us from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'The cleaners top for &ldquo;cleaner near me&rdquo; are the ones whose sites keep growing. Business gets you ranking. Max keeps you climbing.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. One regular clean a month covers it twice over. Under &pound;6 a week, no VAT.'],
    faq: [
      ['My work comes from Facebook groups and recommendations.', 'Keep doing that. They look you up before they message. A site with reviews, insurance and clear prices turns the look into a booking.'],
      ['Can I list prices without giving a fixed quote?', 'Yes. A price guide by property size, with a form for the exact quote.'],
      ['I&rsquo;m a one person business. Is a site overkill?', 'One-person businesses need it most. It answers the questions while you&rsquo;re cleaning.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my cleaning business'),
    freeLede: 'We design a real page for your cleaning business, in your inbox within 24 hours, before you pay. Not spotless? You owe nothing.'
  },

  {
    slug: 'tutors',
    rich: true,
    icons: ICONS,
    lines: ['add a page for GCSE maths', 'take lesson payments online', 'show my results', 'add a waiting list', 'update my timetable'],
    link: 'Tutors',
    title: 'Tutors',
    h1: 'Websites for tutors that parents choose.',
    lede: 'Found on Google by parents searching for your subject in your town. Lessons booked and paid through your site. Reviews asked for at the end of term.',
    heroNote: 'Free page within 24 hours. If you don&rsquo;t love it, you owe nothing. From &pound;25 a month, no VAT.',
    trust: TRUST,
    trustLine: 'All included. Tell us your subjects, levels and rates. We do the rest.',
    desc: 'Websites for tutors and tuition centres. Found on Google locally, lessons booked and paid online, reviews asked for automatically. Built for you, live the same day you join, from £25 a month, no VAT.',
    features: features({
      live: 'Your subjects and levels, your rates, DBS and qualifications where parents check, and your results.',
      google: 'A page per subject and level, so &ldquo;maths tutor near me&rdquo; and &ldquo;11+ tutor Gosforth&rdquo; find you first.',
      pay: 'A block of lessons paid up front, or lesson by lesson. No chasing bank transfers between sessions.',
      bookTitle: 'Lessons booked through your website',
      book: 'A parent picks a subject and a slot that suits you, or joins the waiting list when you are full.',
      reviews: 'At the end of each term the parent gets a friendly email asking for a Google review.',
      records: 'Every lesson and payment against the student, with your notes on progress.'
    }),
    alsoTitle: ALSO_TITLE,
    also: ['Subject and level pages', 'Results and testimonials', 'Online lesson links', 'Term dates', 'Google reviews on your site', 'Free assessment booking', 'Google Calendar link'],
    buildNote: 'Tell us your subjects, levels and rates. We write the pages and you&rsquo;re live the same day.',
    steps: steps(['Tell us your subjects, your levels and your rates', 'What you teach, to whom, what it costs, how you take bookings.']),
    stepsLine: 'Unlimited changes included. Message us from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'September and January are decided on Google. Business gets you ranking at launch. Max keeps you climbing.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. One lesson a month covers it twice over. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I&rsquo;m on a tutoring directory already.', 'Keep it. Directories list you beside fifty others and take a cut. Your own site ranks for your subject in your town.'],
      ['I&rsquo;m fully booked. Why would I need a site?', 'To stay that way. A waiting list fills September in July, and you choose the students.'],
      ['Can I show results without naming students?', 'Yes. Grades improved, initials, and quotes from parents with permission.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my tutoring'),
    freeLede: 'We design a real page for your tutoring, in your inbox within 24 hours, before you pay. Full marks or you owe nothing.'
  },

  {
    slug: 'photographers',
    rich: true,
    icons: ICONS,
    lines: ['add my wedding gallery', 'take booking deposits', 'add client logins', 'update my packages', 'add an enquiry form'],
    link: 'Photographers',
    title: 'Photographers',
    h1: 'Websites for photographers that book the shoot.',
    lede: 'Found on Google for the kind of photography they are searching for. Shoots booked and deposits paid through your site. Reviews asked for after every gallery.',
    heroNote: 'Free page within 24 hours. If it&rsquo;s not picture perfect, you owe nothing. From &pound;25 a month, no VAT.',
    trust: TRUST,
    trustLine: 'All included. Send your best shots and your packages. We do the rest.',
    desc: 'Websites for photographers. Found on Google for your genre, shoots booked and deposits paid online, reviews asked for automatically. Built for you, live the same day you join, from £25 a month, no VAT.',
    features: features({
      live: 'Galleries that do your work justice, your packages and prices, and a page for each kind of shoot.',
      google: 'A page per genre, so &ldquo;wedding photographer near me&rdquo; finds the wedding work and &ldquo;newborn photographer Newcastle&rdquo; finds the newborns.',
      pay: 'A deposit that holds the date, the balance before the shoot, or prints and albums afterwards.',
      bookTitle: 'Shoots booked through your website',
      book: 'A couple sends the date, the venue and what they are after, so you reply already knowing if you are free.',
      reviews: 'A week after the gallery goes out the client gets a friendly email asking for a Google review.',
      records: 'Every enquiry, booking and payment against the client, with a private gallery only they can log in to.'
    }),
    alsoTitle: ALSO_TITLE,
    also: ['Portfolio galleries', 'Packages and prices', 'Instagram feed on the site', 'Client galleries with a login', 'Google reviews on your site', 'Gift vouchers', 'Google Calendar link'],
    buildNote: 'Send us your best shots and your packages. We build the galleries and you&rsquo;re live the same day.',
    steps: steps(['Send your best work, your packages and your genres', 'A folder of photos, and what you shoot, what it costs, how you want enquiries to work.']),
    stepsLine: 'Unlimited changes included. Message us from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'Couples book a year out, from one Google search. Business gets you ranking at launch. Max keeps you in that search, every month.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. One booking covers the year. Under &pound;6 a week, no VAT.'],
    faq: [
      ['My Instagram is my portfolio. Do I need a site?', 'Instagram shows your work to people who already follow you. Google shows it to the couple searching this week. The site gives you both.'],
      ['I already have a website on a portfolio platform.', 'Then you know: templates, upsells, nothing ranking. This one ranks for your genres, and someone else keeps it updated.'],
      ['Will the galleries load fast on phones?', 'Yes. Photos are sized for the screen, so a gallery opens in a second at the venue.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my photography'),
    freeLede: 'We design a real page around your photos, in your inbox within 24 hours, before you pay. If it&rsquo;s not picture perfect, you owe nothing.'
  },

  {
    slug: 'gardeners',
    rich: true,
    icons: ICONS,
    lines: ['show my landscaping projects', 'add a quote form with photos', 'remind last year’s hedge cuts they’re due', 'list the areas I cover', 'take deposits online'],
    link: 'Gardeners &amp; landscapers',
    title: 'Gardeners &amp; landscapers',
    h1: 'Websites for gardeners that land the bigger jobs.',
    lede: 'Found on Google in the villages you cover. Jobs quoted, booked and paid through your site. Reviews asked for after every job.',
    heroNote: 'Free page within 24 hours. If it doesn&rsquo;t grow on you, you owe nothing. From &pound;25 a month, no VAT.',
    trust: TRUST,
    trustLine: 'All included. Send job photos and a list of services. We do the rest.',
    desc: 'Websites for gardeners and landscapers. Found on Google in your areas, jobs quoted and paid online, reviews asked for automatically. Built for you, live the same day you join, from £25 a month, no VAT.',
    features: features({
      live: 'Your services and prices, the areas you cover, and finished gardens shown start to finish.',
      google: 'A page for every service and every village on your patch, written for &ldquo;landscaper Ponteland&rdquo; and &ldquo;hedge cutting near me&rdquo;.',
      pay: 'A deposit on the big jobs, regular rounds paid on their own, or pay when it is done.',
      bookTitle: 'Jobs quoted and booked through your website',
      book: 'A customer sends photos of the garden with the enquiry, so you price before you visit, or books a regular slot.',
      reviews: 'A day after the job the customer gets a friendly email asking for a Google review.',
      records: 'Every quote, booking and payment against the customer, so last autumn&rsquo;s hedge cut is a click away.'
    }),
    alsoTitle: ALSO_TITLE,
    also: ['Project galleries', 'Before and after photos', 'Areas covered', 'Trade and insurance badges', 'Google reviews on your site', 'Seasonal services', 'Google Calendar link'],
    buildNote: 'Send job photos and a list of services. We write the pages and you&rsquo;re live the same day.',
    steps: steps(['Tell us your services, your patch and send the job photos', 'The photos on your phone, and what you do, where you go, how you like to quote.']),
    stepsLine: 'Unlimited changes included. Message us from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'Spring is decided in February, when everyone searches at once. Business gets you ranking at launch. Max keeps you climbing.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. One lawn cut a fortnight covers it. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I get plenty of work from Facebook and word of mouth.', 'The small jobs, yes. The patio and the makeover are researched on Google first. That is the job the site wins you.'],
      ['I&rsquo;m out on jobs all day. Who updates it?', 'We do. Send the photos from your phone and they are on the site.'],
      ['Can I show prices?', 'A price guide for the regular work, and a quote form for the rest.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my gardening business'),
    freeLede: 'We design a real page for your gardening business, in your inbox within 24 hours, before you pay. If it doesn&rsquo;t grow on you, you owe nothing.'
  },
  {
    slug: 'hairdressers',
    rich: true,
    icons: STARTER_ICONS,
    lines: ['add my price list', 'link my booking app', 'show my best colour work', 'add my Instagram', 'update my opening hours'],
    link: 'Hairdressers',
    title: 'Hairdressers',
    h1: 'Websites for hairdressers who want to be picked first.',
    lede: 'Your work, your reviews and your prices on your own site, not next to a cheaper salon on a booking app. Found on Google and AI search nearby. Designed for you within 24 hours.',
    heroNote: STARTER_NOTE,
    trust: STARTER_TRUST,
    trustLine: 'Send your Instagram. We do the rest.',
    desc: 'Websites for hairdressers. Your work, prices and reviews on your own site, found on Google and AI search nearby, with a button to your booking app. Free design in 24 hours, £12.50 to go live, then £25 a month.',
    placeholder: 'e.g. Studio Nine Hair',
    features: starterFeatures({
      live: 'Your services and prices, your opening hours, and the work that wins you clients on Instagram.',
      google: 'Written for what people search: &ldquo;hairdresser near me&rdquo;, &ldquo;balayage Morpeth&rdquo;.',
      formTitle: 'A button straight to your booking app',
      form: 'Clients see your work first, then book in the app you already use. Or send an enquiry straight to you.',
      gallery: 'Your best cuts and colours in a proper gallery, not lost in a feed.'
    }),
    alsoTitle: STARTER_ALSO_TITLE,
    also: ['Online booking', 'Deposits for appointments', 'Gift vouchers', 'Reviews asked for automatically', 'Live chat'],
    buildNote: 'Send us your Instagram and your price list. We design the site and you see it within 24 hours.',
    steps: starterSteps(['Send us your Instagram', 'Your work, your prices and where you are. That&rsquo;s all we need.']),
    stepsLine: 'Business, &pound;50 a month, adds bookings, payments and unlimited changes, any month.',
    maxPitch: { heading: MAX_HEADING, text: 'The salons top for &ldquo;hairdresser near me&rdquo; keep adding pages, reviews and photos. Starter gets you found. Max keeps you there.' },
    promise: PROMISE,
    pricingExtra: ['&pound;25 a month is less than one cut and colour. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I already get bookings through Instagram and an app.', 'Keep them. Instagram doesn&rsquo;t show up for &ldquo;hairdresser near me&rdquo;, and on the app you sit next to someone cheaper. Your own site shows your work first.'],
      ['Will it replace my booking app?', 'No need. Your site has a button straight to it.']
    ].concat(STARTER_FAQ),
    endLine: endLine('Website for my hair business'),
    freeLede: 'We design a real page for your hair business, in your inbox within 24 hours, before you pay. If you don&rsquo;t love it, you owe nothing.'
  },
  {
    slug: 'lash-artists',
    rich: true,
    icons: STARTER_ICONS,
    lines: ['add my lash menu', 'show my before and afters', 'link my booking app', 'add an enquiry form', 'add my aftercare guide'],
    link: 'Lash artists',
    title: 'Lash Artists',
    h1: 'Websites for lash artists who want Google to send clients.',
    lede: 'Your lashes look amazing on Instagram, but &ldquo;lash extensions near me&rdquo; shows someone else. Your own site puts your work where new clients search. Designed for you within 24 hours.',
    heroNote: STARTER_NOTE,
    trust: STARTER_TRUST,
    trustLine: 'Send your Instagram. We do the rest.',
    desc: 'Websites for lash artists and lash techs. Your work, prices and reviews on your own site, found on Google and AI search nearby, with an enquiry form. Free design in 24 hours, £12.50 to go live, then £25 a month.',
    placeholder: 'e.g. Lashed by Amy',
    features: starterFeatures({
      live: 'Your lash menu and prices, where you work, and your best sets front and centre.',
      google: 'Written for what people search: &ldquo;lash extensions near me&rdquo;, &ldquo;Russian volume lashes Whitley Bay&rdquo;.',
      formTitle: 'Enquiries that come straight to you',
      form: 'A simple form for new clients, or a button to the booking app you already use.',
      gallery: 'Before and afters in a proper gallery, so clients see exactly what they&rsquo;re booking.'
    }),
    alsoTitle: STARTER_ALSO_TITLE,
    also: ['Online booking', 'Deposits to stop no-shows', 'Patch test reminders', 'Reviews asked for automatically', 'Gift vouchers'],
    buildNote: 'Send us your Instagram and your lash menu. We design the site and you see it within 24 hours.',
    steps: starterSteps(['Send us your Instagram', 'Your work, your prices and where you are. That&rsquo;s all we need.']),
    stepsLine: 'Business, &pound;50 a month, adds bookings, deposits and unlimited changes, any month.',
    maxPitch: { heading: MAX_HEADING, text: 'The lash artists top on Google keep adding photos, pages and reviews. Starter gets you found. Max keeps you there.' },
    promise: PROMISE,
    pricingExtra: ['&pound;25 a month is less than one infill. Under &pound;6 a week, no VAT.'],
    faq: [
      ['My clients find me on Instagram already.', 'The ones who follow you, yes. New clients search Google and AI first, and Instagram doesn&rsquo;t show up there. Your site does.'],
      ['I work from home. Do I have to show my address?', 'No. We show your area and give the full address once they book.']
    ].concat(STARTER_FAQ),
    endLine: endLine('Website for my lash business'),
    freeLede: 'We design a real page for your lash business, in your inbox within 24 hours, before you pay. If you don&rsquo;t love it, you owe nothing.'
  },
  {
    slug: 'makeup-artists',
    rich: true,
    icons: STARTER_ICONS,
    lines: ['add my bridal packages', 'show my portfolio', 'add a wedding date enquiry form', 'add my prices', 'add reviews from my brides'],
    link: 'Makeup artists',
    title: 'Makeup Artists',
    h1: 'Websites for makeup artists brides can find.',
    lede: 'Brides Google &ldquo;bridal makeup near me&rdquo; and book from what they find. Your own site shows your portfolio, your prices and a date enquiry form. Designed for you within 24 hours.',
    heroNote: STARTER_NOTE,
    trust: STARTER_TRUST,
    trustLine: 'Send your Instagram. We do the rest.',
    desc: 'Websites for makeup artists and bridal MUAs. Your portfolio, packages and reviews on your own site, found on Google and AI search, with a wedding date enquiry form. Free design in 24 hours, £12.50 to go live, then £25 a month.',
    placeholder: 'e.g. Glow by Sophie',
    features: starterFeatures({
      live: 'Your bridal and occasion packages, your prices, and the areas you travel to.',
      google: 'Written for what brides search: &ldquo;bridal makeup artist Newcastle&rdquo;, &ldquo;wedding makeup near me&rdquo;.',
      formTitle: 'Wedding date enquiries, straight to you',
      form: 'Brides send their date, venue and party size, so you can check the diary and reply with a quote.',
      gallery: 'Your portfolio in a proper gallery, sorted by bridal, occasion and editorial.'
    }),
    alsoTitle: STARTER_ALSO_TITLE,
    also: ['Deposits to secure the date', 'Online booking for trials', 'Reviews asked for automatically', 'Gift vouchers', 'Live chat'],
    buildNote: 'Send us your Instagram and your packages. We design the site and you see it within 24 hours.',
    steps: starterSteps(['Send us your Instagram', 'Your work, your packages and the areas you cover. That&rsquo;s all we need.']),
    stepsLine: 'Business, &pound;50 a month, adds deposits, bookings and unlimited changes, any month.',
    maxPitch: { heading: MAX_HEADING, text: 'The artists brides find first keep adding photos, pages and reviews. Starter gets you found. Max keeps you there.' },
    promise: PROMISE,
    pricingExtra: ['&pound;25 a month, and one bride a year pays for it many times over. Under &pound;6 a week, no VAT.'],
    faq: [
      ['Brides find me on Instagram.', 'Some do. Most start with Google or AI and book from what comes up. Instagram doesn&rsquo;t show up there. Your site does.'],
      ['Can I show different packages?', 'Yes. Bridal, bridesmaids, occasion, lessons: each with its own price and photos.']
    ].concat(STARTER_FAQ),
    endLine: endLine('Website for my makeup business'),
    freeLede: 'We design a real page for your makeup business, in your inbox within 24 hours, before you pay. If you don&rsquo;t love it, you owe nothing.'
  },
  {
    slug: 'cake-makers',
    rich: true,
    icons: STARTER_ICONS,
    lines: ['show my wedding cakes', 'add a quote form for custom orders', 'add my flavours and prices', 'add my collection details', 'show my birthday cakes'],
    link: 'Cake makers',
    title: 'Cake Makers',
    h1: 'Websites for cake makers that turn your designs into orders.',
    lede: 'Your cakes are on Instagram, but &ldquo;wedding cakes near me&rdquo; and &ldquo;custom birthday cake&rdquo; show someone else. Your own site shows off your designs, with a quote form for new orders. Designed for you within 24 hours.',
    heroNote: STARTER_NOTE,
    trust: STARTER_TRUST,
    trustLine: 'Send your Instagram. We do the rest.',
    desc: 'Websites for cake makers and cake designers. Your designs, flavours and prices on your own site, found on Google and AI search nearby, with a quote form for custom orders. Free design in 24 hours, £12.50 to go live, then £25 a month.',
    placeholder: 'e.g. Bake Me Happy',
    features: starterFeatures({
      live: 'Your cakes, your flavours, your starting prices and how collection or delivery works.',
      google: 'Written for what people search: &ldquo;wedding cakes Durham&rdquo;, &ldquo;custom birthday cake near me&rdquo;.',
      formTitle: 'A quote form for custom orders',
      form: 'Customers send the date, the number of guests, the flavours and a photo of what they have in mind. You quote back.',
      gallery: 'Your designs in a proper gallery: wedding, birthday, celebration, cupcakes. Not lost in a feed.'
    }),
    alsoTitle: STARTER_ALSO_TITLE,
    also: ['Deposits on orders', 'Online ordering for set designs', 'Reviews asked for automatically', 'Gift vouchers', 'Live chat'],
    buildNote: 'Send us your Instagram and your flavours. We design the site and you see it within 24 hours.',
    steps: starterSteps(['Send us your Instagram', 'Your cakes, your flavours and how ordering works. That&rsquo;s all we need.']),
    stepsLine: 'Business, &pound;50 a month, adds deposits, online ordering and unlimited changes, any month.',
    maxPitch: { heading: MAX_HEADING, text: 'The cake makers top on Google keep adding photos, pages and reviews. Starter gets you found. Max keeps you there.' },
    promise: PROMISE,
    pricingExtra: ['&pound;25 a month is less than one birthday cake. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I get plenty of orders through Instagram and Facebook.', 'Keep them. People planning a wedding or a big birthday search Google and AI first, and Instagram doesn&rsquo;t show up there. Your site does, and takes the quote request.'],
      ['I bake from home. Do I need to show my address?', 'No. We show your area and how collection or delivery works.']
    ].concat(STARTER_FAQ),
    endLine: endLine('Website for my cake business'),
    freeLede: 'We design a real page for your cake business, in your inbox within 24 hours, before you pay. If you don&rsquo;t love it, you owe nothing.'
  },
  {
    slug: 'kids-clubs',
    rich: true,
    icons: STARTER_ICONS,
    lines: ['add our timetable', 'add a trial request form', 'show our prices', 'add photos from our classes', 'answer the questions parents ask'],
    link: 'Kids&rsquo; clubs',
    title: 'Kids&rsquo; Clubs',
    h1: 'Websites for kids&rsquo; clubs parents can find.',
    lede: 'Parents search &ldquo;kids clubs near me&rdquo;, and clubs without a website don&rsquo;t make the list. Your timetable, prices and a trial request form, on your own site. Designed for you within 24 hours.',
    heroNote: STARTER_NOTE,
    trust: STARTER_TRUST,
    trustLine: 'Send your Facebook or Instagram. We do the rest.',
    desc: 'Websites for kids&rsquo; clubs, classes and activities. Your timetable, prices and a trial request form on your own site, found on Google and AI search by local parents. Free design in 24 hours, £12.50 to go live, then £25 a month.',
    placeholder: 'e.g. Little Kickers Morpeth',
    features: starterFeatures({
      live: 'Your classes, ages, timetable and prices, and where you meet.',
      google: 'Written for what parents search: &ldquo;kids clubs near me&rdquo;, &ldquo;football for 5 year olds Gateshead&rdquo;.',
      formTitle: 'A trial request form',
      form: 'Parents pick a class and send their details for a trial. It comes straight to you.',
      gallery: 'Photos from your sessions, so parents can see what their child would be doing.'
    }),
    alsoTitle: STARTER_ALSO_TITLE,
    also: ['Trial bookings confirmed automatically', 'Monthly payments online', 'Reviews asked for automatically', 'Term reminders', 'Live chat'],
    buildNote: 'Send us your Facebook or Instagram and your timetable. We design the site and you see it within 24 hours.',
    steps: starterSteps(['Send us your Facebook or Instagram', 'Your classes, your timetable and where you are. That&rsquo;s all we need.']),
    stepsLine: 'Business, &pound;50 a month, adds trial bookings confirmed automatically, payments and unlimited changes, any month.',
    maxPitch: { heading: MAX_HEADING, text: 'The clubs parents find first keep adding pages, photos and reviews. Starter gets you found. Max keeps your classes full.' },
    promise: PROMISE,
    pricingExtra: ['&pound;25 a month is less than one child&rsquo;s monthly fees. Under &pound;6 a week, no VAT.'],
    faq: [
      ['Parents find us on Facebook.', 'The ones already in the local groups, yes. New families search Google and AI first, and a Facebook page rarely shows up. Your site does.'],
      ['Have you built sites for clubs before?', 'Yes. Clubs and dance schools we work with now regularly get parents messaging about classes after finding them on Google and AI search. We know the questions parents ask, so we build the answers in.']
    ].concat(STARTER_FAQ),
    endLine: endLine('Website for my kids club'),
    freeLede: 'We design a real page for your club, in your inbox within 24 hours, before you pay. If you don&rsquo;t love it, you owe nothing.'
  },
  {
    slug: 'electricians',
    rich: true,
    icons: STARTER_ICONS,
    lines: ['add a quote form', 'add my NICEIC badge', 'add a page for every town I cover', 'show photos of my jobs', 'add a WhatsApp button'],
    link: 'Electricians',
    title: 'Electricians',
    h1: 'Websites for electricians that win the job before you ring back.',
    lede: 'They got your number, then looked you up. No website, so they rang someone else. A proper site shows you&rsquo;re the real deal, with a quote form ready to win the job. Designed for you within 24 hours.',
    heroNote: STARTER_NOTE,
    trust: STARTER_TRUST,
    trustLine: 'Send your Facebook, Checkatrade or Trust a Trader link. We do the rest.',
    desc: 'Websites for electricians. Found on Google and AI search in the towns you cover, your badges and reviews on show, with a quote form that sends you the job. Free design in 24 hours, £12.50 to go live, then £25 a month.',
    placeholder: 'e.g. Bright Spark Electrical',
    features: starterFeatures({
      live: 'Your services, your badges, the towns you cover and the reviews that prove you&rsquo;re the real deal.',
      google: 'Written for what people search: &ldquo;electrician near me&rdquo;, &ldquo;EICR Cramlington&rdquo;.',
      formTitle: 'A quote form that sends you the job',
      form: 'Customers describe the job and add photos. The details come straight to you, ready to quote.',
      gallery: 'Photos of finished jobs, so customers trust you before they ring.'
    }),
    alsoTitle: STARTER_ALSO_TITLE,
    also: ['Callouts booked online', 'Callout fees taken up front', 'Reviews asked for automatically', 'Service reminders', 'Live chat'],
    buildNote: 'Send us your Facebook, Checkatrade or Trust a Trader link. We design the site and you see it within 24 hours.',
    steps: starterSteps(['Send us your link', 'Your Facebook, Checkatrade or Trust a Trader page. That&rsquo;s all we need.']),
    stepsLine: 'Business, &pound;50 a month, adds online bookings, payments and unlimited changes, any month.',
    maxPitch: { heading: MAX_HEADING, text: 'The electricians on page one for &ldquo;electrician Cramlington&rdquo; keep adding pages and reviews. Starter gets you found. Max keeps you there.' },
    promise: PROMISE,
    pricingExtra: ['&pound;25 a month is less than one callout. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I get my work from word of mouth.', 'Word of mouth ends with a search. They look you up before they ring. Your site is where the recommendation lands.'],
      ['I&rsquo;m on Checkatrade already.', 'Keep it. There you sit next to every other electrician. Your own site is just you.']
    ].concat(STARTER_FAQ),
    endLine: endLine('Website for my electrical business'),
    freeLede: 'We design a real page for your electrical business, in your inbox within 24 hours, before you pay. If you don&rsquo;t love it, you owe nothing.'
  },
  {
    slug: 'heating-engineers',
    rich: true,
    icons: STARTER_ICONS,
    lines: ['add a quote form', 'add my Gas Safe badge', 'add boiler servicing', 'add a page for every town I cover', 'show photos of my installs'],
    link: 'Heating engineers',
    title: 'Heating Engineers',
    h1: 'Websites for heating engineers who want a full diary.',
    lede: 'You&rsquo;ve got gaps in the diary while he&rsquo;s booked for weeks. They just found him first. A site that gets you found, with a quote form ready to win the job. Designed for you within 24 hours.',
    heroNote: STARTER_NOTE,
    trust: STARTER_TRUST,
    trustLine: 'Send your Facebook, Checkatrade or Trust a Trader link. We do the rest.',
    desc: 'Websites for boiler and heating engineers. Found on Google and AI search in the towns you cover, your Gas Safe badge and reviews on show, with a quote form that sends you the job. Free design in 24 hours, £12.50 to go live, then £25 a month.',
    placeholder: 'e.g. Warm Home Heating',
    features: starterFeatures({
      live: 'Your services, your Gas Safe badge, the towns you cover and the reviews that win the job.',
      google: 'Written for what people search: &ldquo;boiler repair near me&rdquo;, &ldquo;new boiler Blyth&rdquo;.',
      formTitle: 'A quote form that sends you the job',
      form: 'Customers describe the problem and add photos of the boiler. The details come straight to you, ready to quote.',
      gallery: 'Photos of finished installs, so customers trust you before they ring.'
    }),
    alsoTitle: STARTER_ALSO_TITLE,
    also: ['Services booked online', 'Annual service reminders', 'Reviews asked for automatically', 'Callout fees taken up front', 'Live chat'],
    buildNote: 'Send us your Facebook, Checkatrade or Trust a Trader link. We design the site and you see it within 24 hours.',
    steps: starterSteps(['Send us your link', 'Your Facebook, Checkatrade or Trust a Trader page. That&rsquo;s all we need.']),
    stepsLine: 'Business, &pound;50 a month, adds online bookings, service reminders and unlimited changes, any month.',
    maxPitch: { heading: MAX_HEADING, text: 'The engineers booked for weeks keep adding pages and reviews. Starter gets you found. Max keeps you there, every month.' },
    promise: PROMISE,
    pricingExtra: ['&pound;25 a month is less than one boiler service. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I get my work from word of mouth.', 'Word of mouth ends with a search. They look you up before they ring. Your site is where the recommendation lands.'],
      ['Winter is busy anyway.', 'That&rsquo;s when they search. The site makes sure they find you, not the engineer down the road.']
    ].concat(STARTER_FAQ),
    endLine: endLine('Website for my heating business'),
    freeLede: 'We design a real page for your heating business, in your inbox within 24 hours, before you pay. If you don&rsquo;t love it, you owe nothing.'
  },
{
    slug: 'nail-techs',
    rich: true,
    icons: STARTER_ICONS,
    lines: ['add my nail menu', 'show my latest sets', 'link my booking app', 'add my prices', 'add my opening hours'],
    link: 'Nail techs',
    title: 'Nail Techs',
    h1: 'Websites for nail techs new clients can find.',
    lede: 'New clients search &ldquo;nails near me&rdquo; and book whoever Google shows them. Your own site puts your sets, your prices and a button to book where they search. Designed for you within 24 hours.',
    heroNote: STARTER_NOTE,
    trust: STARTER_TRUST,
    trustLine: 'Send your Instagram. We do the rest.',
    desc: 'Websites for nail techs and nail salons. Your sets, prices and reviews on your own site, found on Google and AI search nearby, with a button to book. Free design in 24 hours, £12.50 to go live, then £25 a month.',
    placeholder: 'e.g. Polished by Jess',
    features: starterFeatures({
      live: 'Your nail menu and prices, your hours, and where to find you.',
      google: 'Written for what people search: &ldquo;nails near me&rdquo;, &ldquo;BIAB nails Blyth&rdquo;.',
      formTitle: 'A button straight to your booking app',
      form: 'Clients see your sets first, then book in the app you already use. Or send an enquiry straight to you.',
      gallery: 'Your latest sets in a proper gallery, so new clients can pick the look they want.'
    }),
    alsoTitle: STARTER_ALSO_TITLE,
    also: ['Online booking', 'Deposits to stop no-shows', 'Infill reminders', 'Reviews asked for automatically', 'Gift vouchers'],
    buildNote: 'Send us your Instagram and your nail menu. We design the site and you see it within 24 hours.',
    steps: starterSteps(['Send us your Instagram', 'Your sets, your prices and where you are. That&rsquo;s all we need.']),
    stepsLine: 'Business, &pound;50 a month, adds bookings, deposits and unlimited changes, any month.',
    maxPitch: { heading: MAX_HEADING, text: 'The nail techs top for &ldquo;nails near me&rdquo; keep adding photos, pages and reviews. Starter gets you found. Max keeps you there.' },
    promise: PROMISE,
    pricingExtra: ['&pound;25 a month is less than one set of nails. Under &pound;6 a week, no VAT.'],
    faq: [
      ['My clients book through Instagram already.', 'The ones who follow you, yes. New clients search Google and AI first, and Instagram doesn&rsquo;t show up there. Your site does.'],
      ['I work from home. Do I have to show my address?', 'No. We show your area and give the full address once they book.']
    ].concat(STARTER_FAQ),
    endLine: endLine('Website for my nail business'),
    freeLede: 'We design a real page for your nail business, in your inbox within 24 hours, before you pay. If you don&rsquo;t love it, you owe nothing.'
  },
  {
    slug: 'mobile-car-valeters',
    rich: true,
    icons: STARTER_ICONS,
    lines: ['add my valet packages', 'show my before and afters', 'add a quote form', 'add the areas I cover', 'add my prices'],
    link: 'Mobile car valeters',
    title: 'Mobile Car Valeters',
    h1: 'Websites for mobile car valeters that book the job.',
    lede: 'They want a price before they book. No website? They ask someone else. Your own site shows your before and afters, your packages and prices, with a quote form that books the job. Designed for you within 24 hours.',
    heroNote: STARTER_NOTE,
    trust: STARTER_TRUST,
    trustLine: 'Send your Facebook or Instagram. We do the rest.',
    desc: 'Websites for mobile car valeters and detailers. Your before and afters, packages and prices on your own site, found on Google and AI search nearby, with a quote form. Free design in 24 hours, £12.50 to go live, then £25 a month.',
    placeholder: 'e.g. Shine On Valeting',
    features: starterFeatures({
      live: 'Your valet packages and prices, the areas you cover and how booking works.',
      google: 'Written for what people search: &ldquo;mobile car valeting near me&rdquo;, &ldquo;car detailing Cramlington&rdquo;.',
      formTitle: 'A quote form that books the job',
      form: 'Customers pick a package, tell you the car and where it is, and send it straight to you.',
      gallery: 'Before and afters in a proper gallery. Nothing sells a valet faster.'
    }),
    alsoTitle: STARTER_ALSO_TITLE,
    also: ['Online booking', 'Deposits taken up front', 'Maintenance valet reminders', 'Reviews asked for automatically', 'Gift vouchers'],
    buildNote: 'Send us your Facebook or Instagram and your packages. We design the site and you see it within 24 hours.',
    steps: starterSteps(['Send us your Facebook or Instagram', 'Your packages, your prices and where you cover. That&rsquo;s all we need.']),
    stepsLine: 'Business, &pound;50 a month, adds bookings, deposits and unlimited changes, any month.',
    maxPitch: { heading: MAX_HEADING, text: 'The valeters booked for weeks keep adding photos, pages and reviews. Starter gets you found. Max keeps you there.' },
    promise: PROMISE,
    pricingExtra: ['&pound;25 a month is less than one full valet. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I get my work from Facebook.', 'Some of it. People searching &ldquo;car valeting near me&rdquo; never see your Facebook page. Your site shows up, with your prices.'],
      ['Can I show different packages?', 'Yes. Mini, full, interior, detailing: each with its own price and photos.']
    ].concat(STARTER_FAQ),
    endLine: endLine('Website for my valeting business'),
    freeLede: 'We design a real page for your valeting business, in your inbox within 24 hours, before you pay. If you don&rsquo;t love it, you owe nothing.'
  },
  {
    slug: 'driving-instructors',
    rich: true,
    icons: STARTER_ICONS,
    lines: ['add my lesson prices', 'add the areas I cover', 'add a form for new learners', 'add my block booking deals', 'show my pass photos'],
    link: 'Driving instructors',
    title: 'Driving Instructors',
    h1: 'Websites for driving instructors parents trust.',
    lede: 'Parents check you out before they book lessons. No website? They pick someone else. Your prices, the areas you cover and a form for new learners, on your own site. Designed for you within 24 hours.',
    heroNote: STARTER_NOTE,
    trust: STARTER_TRUST,
    trustLine: 'Send your Facebook or Instagram. We do the rest.',
    desc: 'Websites for driving instructors and driving schools. Your prices, areas and pass photos on your own site, found on Google and AI search nearby, with a form for new learners. Free design in 24 hours, £12.50 to go live, then £25 a month.',
    placeholder: 'e.g. Pass First Time Driving',
    features: starterFeatures({
      live: 'Your lesson prices and block deals, manual or automatic, and the areas you cover.',
      google: 'Written for what people search: &ldquo;driving lessons near me&rdquo;, &ldquo;automatic driving instructor Morpeth&rdquo;.',
      formTitle: 'A form for new learners',
      form: 'Learners, or their parents, send their details, what they need and when they&rsquo;re free. It comes straight to you.',
      gallery: 'Your pass photos and reviews, the proof parents look for before they book.'
    }),
    alsoTitle: STARTER_ALSO_TITLE,
    also: ['Lessons booked online', 'Block bookings paid up front', 'Lesson reminders', 'Reviews asked for automatically', 'Gift vouchers'],
    buildNote: 'Send us your Facebook or Instagram and your prices. We design the site and you see it within 24 hours.',
    steps: starterSteps(['Send us your Facebook or Instagram', 'Your prices, your car and where you cover. That&rsquo;s all we need.']),
    stepsLine: 'Business, &pound;50 a month, adds online booking, payments and unlimited changes, any month.',
    maxPitch: { heading: MAX_HEADING, text: 'The instructors with a waiting list keep adding pages, pass photos and reviews. Starter gets you found. Max keeps the diary full.' },
    promise: PROMISE,
    pricingExtra: ['&pound;25 a month is less than one lesson. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I already have a waiting list.', 'Then keep the quiet months full. Learners search Google and AI first, and parents check you out before they pay for a block.'],
      ['I&rsquo;m listed on a driving school site.', 'Keep it. There you sit next to every other instructor. Your own site is just you.']
    ].concat(STARTER_FAQ),
    endLine: endLine('Website for my driving school'),
    freeLede: 'We design a real page for your driving school, in your inbox within 24 hours, before you pay. If you don&rsquo;t love it, you owe nothing.'
  }
];

module.exports.CASES = CASES;
