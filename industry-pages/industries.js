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
    'I design a real page for your business within 24 hours, free, before you join. Don&rsquo;t love it? You owe nothing.',
    'Live on your own address the same day you join. Your features built within 14 days, or your next month is free.',
    'Cancel anytime. Your site comes down, your domain stays yours, and there is no exit fee.'
  ]
};


/* Two of ours, doing what they were built to do. Same two on the
   homepage and on every trade page: proof is proof. */
const CASES = [
  { tag: 'Dance school', title: 'Enquiries every day, onboarded without lifting a finger', text: 'Free trial classes are booked through the site. Each one is confirmed by email and the family is onboarded automatically, so the academy hears from new students daily and never chases a form.', host: 'kanvasacademy.com', url: 'https://kanvasacademy.com' },
  { tag: 'Dog trainer', title: 'A new business. Fully booked, with a waiting list.', text: 'Started from nothing. Now near the top of Google locally for dog training, booked solid, and running a waiting list straight from the site.', host: 'nellyandnova.co.uk', url: 'https://nellyandnova.co.uk' }
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
    ['I build it for you', 'Design, writing, web address, hosting and security. All done by me, all in the price.'],
    ['Live the same day, features in 14', 'Live on your own address the day you join. Your features within 14 days, or your next month is free. Then unlimited changes, within 48 hours.']
  ];
}

function endLine(subject) {
  return 'Got a question? Email <a href="mailto:hello@kanvas.one?subject=' + encodeURIComponent(subject) + '">hello@kanvas.one</a> and I reply.';
}

const COMMON_FAQ = [
  ['What if I don&rsquo;t like it?', 'You see your page within 24 hours, before you pay. Don&rsquo;t love it? You owe nothing.'],
  ['Do I have to take card payments?', 'No. Cash and bank transfer work too.'],
  ['How do the bookings and payments actually work?', 'I set them up with you after you join, the way you already work. Five minutes.'],
  ['Do I need Max?', 'Only if you want to climb Google every month. Business includes local SEO at launch.'],
  ['What happens if I cancel?', 'No exit fee. Your site goes offline and your domain transfers to you free.']
];

const MAX_HEADING = 'Want to show up higher every month?';


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
    trustLine: 'All included. You send photos from your phone. I do the rest.',
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
    buildNote: 'Send me the photos on your phone and a list of what you do. I write the pages and you&rsquo;re live the same day.',
    steps: steps(['Tell me your trade, your patch and how you like to work', 'What you do, where you cover, how customers book and pay.']),
    stepsLine: 'Unlimited changes included. Message me from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'The trades on page one for &ldquo;electrician Cramlington&rdquo; keep adding pages and reviews. Business gets you there. Max keeps you there, every month.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. One callout a month covers it twice over. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I get all my work from word of mouth. Why do I need a site?', 'Word of mouth ends with a Google search. They look you up before they ring. Your site is where the recommendation lands.'],
      ['I&rsquo;ve already got a Facebook page.', 'Keep it. Facebook doesn&rsquo;t show up for &ldquo;plumber Blyth&rdquo;. Your site does, and takes the booking while you&rsquo;re on a job.'],
      ['Can customers still just ring or WhatsApp me?', 'Yes. The site handles the confirmation and the paperwork.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my trade'),
    freeLede: 'I design a real page for your trade business, in your inbox within 24 hours, before you pay. If you don&rsquo;t like it, you owe nothing.'
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
    trustLine: 'All included. Send your price list and your best photos. I do the rest.',
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
    buildNote: 'Tell me your treatments and prices and send your best photos. I build the site and the booking, and you&rsquo;re live the same day.',
    steps: steps(['Tell me your treatments, your prices and your team', 'What you offer, who does what, how you want bookings to work.']),
    stepsLine: 'Unlimited changes included. Message me from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'The salons top for &ldquo;hairdresser near me&rdquo; keep adding pages, reviews and photos. Business gets you there. Max keeps you there.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. One colour appointment a month covers it twice over. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I already take bookings on Instagram and Facebook.', 'Keep them. Instagram doesn&rsquo;t show up for &ldquo;hairdresser near me&rdquo;. Your site does, and takes the booking while you&rsquo;re with a client.'],
      ['I use a booking app already. Will this replace it?', 'It can, or link to the one you have. Either way, clients book from your own site.'],
      ['Can I change prices myself?', 'Yes, from your dashboard, or message me and I do it for you.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my salon'),
    freeLede: 'I design a real page for your salon, in your inbox within 24 hours, before you pay. If you don&rsquo;t love it, you owe nothing.'
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
    trustLine: 'All included. Send your price list, your hours and a dozen photos. I do the rest.',
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
    buildNote: 'Send your price list, your hours and a dozen photos. I do the rest and you&rsquo;re live the same day.',
    steps: steps(['Tell me your prices, your hours and your barbers', 'What you charge, when you open, who works which days.']),
    stepsLine: 'Unlimited changes included. Message me from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'Six barbers within a mile, all on Google. The one that keeps adding reviews and pages stays top. Business gets you there. Max keeps you there.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. Two cuts a month covers it. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I&rsquo;m walk-in only. Do I need bookings?', 'No. Plenty of shops stay walk-in and use the site for hours, prices and Google. Bookings are there if you want them.'],
      ['I&rsquo;ve got Instagram. Isn&rsquo;t that enough?', 'Instagram is where your work gets seen. Google is where someone finds a barber right now. The site gives you both.'],
      ['Can I change prices and hours myself?', 'Yes, from your dashboard, or message me and I do it.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my barbershop'),
    freeLede: 'I design a real page for your shop, in your inbox within 24 hours, before you pay. Don&rsquo;t rate it? You owe nothing.'
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
    trustLine: 'All included. Send your menu and some photos. I do the rest.',
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
    buildNote: 'Send your menu and some photos. I build the site and you&rsquo;re live the same day.',
    steps: steps(['Tell me your menu, your hours and what you want to sell online', 'What&rsquo;s on the board, when you open, whether you want orders online.']),
    stepsLine: 'Unlimited changes included. Message me from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'Visitors search &ldquo;coffee near me&rdquo; and pick from the top three. Business gets you in the running. Max keeps you there, every season.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. Eight flat whites a month covers it. Under &pound;6 a week, no VAT.'],
    faq: [
      ['People find us on Instagram. Do we need a site?', 'Your regulars do. The person who just parked up and typed &ldquo;coffee near me&rdquo; doesn&rsquo;t. The site puts you in that list.'],
      ['Can I change the menu myself?', 'Yes, from your dashboard, or message me and I do it.'],
      ['What about delivery apps?', 'Keep them if they work. Orders through your own site have no commission.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my coffee shop'),
    freeLede: 'I design a real page for your coffee shop, in your inbox within 24 hours, before you pay. Not your cup? You owe nothing.'
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
    trustLine: 'All included. Tell me your classes and prices. I do the rest.',
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
    buildNote: 'Tell me your classes, prices and how memberships work. I build the site and you&rsquo;re live the same day.',
    steps: steps(['Tell me your classes, your prices and how memberships work', 'What you run, what it costs, whether there is a trial.']),
    stepsLine: 'Unlimited changes included. Message me from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'January is decided in December. Business gets you ranking at launch. Max keeps you climbing every month.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. One membership a month covers it twice over. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I use a gym app for memberships already.', 'Keep it, or let the site take memberships with no per-member fees. Either way, new members find you on Google.'],
      ['I&rsquo;m a personal trainer, not a gym. Is this for me?', 'Yes. Sessions booked and paid online, a page that ranks for &ldquo;personal trainer near me&rdquo;. Same price.'],
      ['Can I change the timetable myself?', 'Yes, from your dashboard, or message me and I do it.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my gym'),
    freeLede: 'I design a real page for your gym, in your inbox within 24 hours, before you pay. No commitment. That part comes later.'
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
    trustLine: 'All included. Tell me your services, prices and areas. I do the rest.',
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
    buildNote: 'Tell me your services, prices and areas. I write the pages and you&rsquo;re live the same day.',
    steps: steps(['Tell me your services, your prices and your patch', 'What you clean, what you charge, where you go.']),
    stepsLine: 'Unlimited changes included. Message me from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'The cleaners top for &ldquo;cleaner near me&rdquo; are the ones whose sites keep growing. Business gets you ranking. Max keeps you climbing.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. One regular clean a month covers it twice over. Under &pound;6 a week, no VAT.'],
    faq: [
      ['My work comes from Facebook groups and recommendations.', 'Keep doing that. They look you up before they message. A site with reviews, insurance and clear prices turns the look into a booking.'],
      ['Can I list prices without giving a fixed quote?', 'Yes. A price guide by property size, with a form for the exact quote.'],
      ['I&rsquo;m a one person business. Is a site overkill?', 'One-person businesses need it most. It answers the questions while you&rsquo;re cleaning.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my cleaning business'),
    freeLede: 'I design a real page for your cleaning business, in your inbox within 24 hours, before you pay. Not spotless? You owe nothing.'
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
    trustLine: 'All included. Tell me your subjects, levels and rates. I do the rest.',
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
    buildNote: 'Tell me your subjects, levels and rates. I write the pages and you&rsquo;re live the same day.',
    steps: steps(['Tell me your subjects, your levels and your rates', 'What you teach, to whom, what it costs, how you take bookings.']),
    stepsLine: 'Unlimited changes included. Message me from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'September and January are decided on Google. Business gets you ranking at launch. Max keeps you climbing.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. One lesson a month covers it twice over. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I&rsquo;m on a tutoring directory already.', 'Keep it. Directories list you beside fifty others and take a cut. Your own site ranks for your subject in your town.'],
      ['I&rsquo;m fully booked. Why would I need a site?', 'To stay that way. A waiting list fills September in July, and you choose the students.'],
      ['Can I show results without naming students?', 'Yes. Grades improved, initials, and quotes from parents with permission.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my tutoring'),
    freeLede: 'I design a real page for your tutoring, in your inbox within 24 hours, before you pay. Full marks or you owe nothing.'
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
    trustLine: 'All included. Send your best shots and your packages. I do the rest.',
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
    buildNote: 'Send me your best shots and your packages. I build the galleries and you&rsquo;re live the same day.',
    steps: steps(['Send your best work, your packages and your genres', 'A folder of photos, and what you shoot, what it costs, how you want enquiries to work.']),
    stepsLine: 'Unlimited changes included. Message me from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'Couples book a year out, from one Google search. Business gets you ranking at launch. Max keeps you in that search, every month.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. One booking covers the year. Under &pound;6 a week, no VAT.'],
    faq: [
      ['My Instagram is my portfolio. Do I need a site?', 'Instagram shows your work to people who already follow you. Google shows it to the couple searching this week. The site gives you both.'],
      ['I already have a website on a portfolio platform.', 'Then you know: templates, upsells, nothing ranking. This one ranks for your genres, and someone else keeps it updated.'],
      ['Will the galleries load fast on phones?', 'Yes. Photos are sized for the screen, so a gallery opens in a second at the venue.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my photography'),
    freeLede: 'I design a real page around your photos, in your inbox within 24 hours, before you pay. If it&rsquo;s not picture perfect, you owe nothing.'
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
    trustLine: 'All included. Send job photos and a list of services. I do the rest.',
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
    buildNote: 'Send job photos and a list of services. I write the pages and you&rsquo;re live the same day.',
    steps: steps(['Tell me your services, your patch and send the job photos', 'The photos on your phone, and what you do, where you go, how you like to quote.']),
    stepsLine: 'Unlimited changes included. Message me from your phone and it&rsquo;s done within 48 hours.',
    maxPitch: { heading: MAX_HEADING, text: 'Spring is decided in February, when everyone searches at once. Business gets you ranking at launch. Max keeps you climbing.' },
    promise: PROMISE,
    pricingExtra: ['Starter is &pound;25 a month, no setup fee. One lawn cut a fortnight covers it. Under &pound;6 a week, no VAT.'],
    faq: [
      ['I get plenty of work from Facebook and word of mouth.', 'The small jobs, yes. The patio and the makeover are researched on Google first. That is the job the site wins you.'],
      ['I&rsquo;m out on jobs all day. Who updates it?', 'I do. Send the photos from your phone and they are on the site.'],
      ['Can I show prices?', 'A price guide for the regular work, and a quote form for the rest.']
    ].concat(COMMON_FAQ),
    endLine: endLine('Website for my gardening business'),
    freeLede: 'I design a real page for your gardening business, in your inbox within 24 hours, before you pay. If it doesn&rsquo;t grow on you, you owe nothing.'
  }
];

module.exports.CASES = CASES;
