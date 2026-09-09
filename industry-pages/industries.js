/* The nine industry pages, as data. build.js turns each entry into a page.
 *
 * Every page follows the same shape, written to the same rules:
 *
 *   h1        the outcome for this trade, with "Websites for X" in it for
 *             search. One sentence, no exclamation marks.
 *   lede      the four things people weigh up, in their order: the result,
 *             why it will work for them, how soon, how little they must do.
 *   heroNote  the risk taken off them, in one line.
 *   features  outcome first, then how, then the detail. The first sentence
 *             is the one they read.
 *   also      the extras, named. Bonuses stack; nothing is vague.
 *   promise   the guarantee, with a name so it is remembered.
 *   pricingExtra  the price anchored to one job they already do.
 *   faq       the objections we hear, answered straight.
 *
 * Prices and claims here are the real ones: £50 a month, no VAT, live in
 * 10 days, cancel anytime, the domain is theirs. Nothing is promised that
 * we do not do.
 */

const PROMISE = {
  name: 'The See It First Promise',
  lines: [
    'We design a real page for your business before you pay a penny. Don&rsquo;t love it? You owe nothing.',
    'Live in 10 days. After that, unlimited changes, made for you by a person, included.',
    'Cancel anytime. Your site comes down, your domain stays yours, and there is no exit fee.'
  ]
};

const TRUST = ['No VAT', 'No setup fees', 'Live in 10 days', 'Cancel anytime'];

/* The three steps, with step one written for each trade. */
function steps(one, three) {
  return [
    one,
    ['We build it for you', 'Design, writing, web address, hosting and security, all handled by a person, all in the monthly price. You never touch a website builder.'],
    three || ['Live in 10 days, then we keep it updated', 'It stays ours to look after: unlimited changes and new features, made for you whenever you ask.']
  ];
}

function endLine(subject) {
  return 'Got a question? Email <a href="mailto:hello@kanvas.one?subject=' + encodeURIComponent(subject) + '">hello@kanvas.one</a> and a real person replies.';
}

module.exports = [
  {
    slug: 'trades',
    rich: true,
    icons: ['search', 'clock', 'mail', 'calendar', 'card', 'person', 'repeat', 'star', 'photo'],
    lines: ['confirm callouts by email', 'take a callout fee up front', 'keep every customer on file', 'add a WhatsApp button', 'add a page for every town I cover'],
    link: 'Trades',
    title: 'Trades',
    h1: 'Websites for trades that win the next job.',
    lede: 'Found on Google in the towns you cover. Callouts confirmed and paid by email while you&rsquo;re on the tools. Every customer on file for next year&rsquo;s service. Built for you, live in 10 days.',
    heroNote: 'See your free example page first. If you don&rsquo;t love it, you owe nothing. From &pound;50 a month, no VAT.',
    trust: TRUST,
    trustLine: 'Everything below is optional and set up the way you already work. You send photos from your phone. We do the rest.',
    desc: 'Websites for plumbers, electricians, builders and roofers. Found on Google locally, callouts confirmed and paid by email, every customer on file. Built for you, live in 10 days, from £50 a month, no VAT.',
    features: [
      ['Found first on Google locally', 'Be the plumber they find, not the one they were recommended and never looked up. A page for every service and every town you cover, written for the searches people actually type, with your Google Business Profile linked and kept current so you show in the map results too.'],
      ['Never miss a job', 'Every enquiry saved with their details, even the ones that came in while you were up a ladder. Click to call and WhatsApp buttons on every page, a quote form that takes photos of the problem, and a live chat that keeps their email if they leave.'],
      ['Callouts confirmed by email', 'The customer rings, you take a name and email, add the callout in your dashboard, and they get a confirmation straight away. Charge a callout fee? The email has a pay link and the booking confirms when they pay.'],
      ['Take bookings online', 'Customers book a service and a time window that suits you, from their phone, at 11pm if they like. Morning or afternoon slots, a limit per day, a deposit if you want one. Every booking lands in your dashboard and your calendar.'],
      ['Payments your way', 'Fee upfront, on the day, built into the final price, or no fee at all. Card payments through Stripe, or cash and bank transfer if you prefer. You choose in your dashboard and change it any time.'],
      ['Every customer in one place', 'Every enquiry, booking, payment and note against the customer. Search by name, street or job, see what you did and when, and email them from your dashboard.'],
      ['Follow up the next service', 'Boiler service, annual check, gutters before winter. Set a reminder when you finish the job and the customer gets a friendly email when it&rsquo;s due, with a link to book you again. Repeat work without chasing it.'],
      ['Reviews on autopilot', 'More reviews, higher on Google, more calls. A day after each job the customer gets an email asking for a Google review, and the best ones show on your site automatically.'],
      ['Show off your work', 'Customers see the standard before they ring. Galleries of finished jobs and before and after photos, straight from your phone. Send us the pictures and they go on the site.']
    ],
    alsoTitle: 'Also included, no extra cost',
    also: ['Trade badges (Gas Safe, NICEIC)', 'Google reviews on your site', 'Quote requests with photos', 'Google Calendar link', 'Team pages for bigger firms', 'Emergency callout banner', 'Areas covered map'],
    buildNote: 'Send us the photos on your phone and a list of what you do. We write the pages, sort the web address and have you online within 10 days. No evenings lost to a website builder.',
    steps: steps(['Tell us your trade, your patch and how you like to work', 'Five minutes of questions: what you do, where you cover, how customers book and pay. That&rsquo;s your part done.']),
    stepsLine: 'Unlimited edits included. Message us from your phone and it&rsquo;s changed.',
    maxPitch: {
      heading: 'Want to show up higher every month?',
      text: 'Google keeps changing and your competitors keep adding pages. The trades who keep working on their site are the ones who stay on page one for &ldquo;electrician Cramlington&rdquo;. Business gets you there at launch. Max keeps you there, with new pages, reviews and updates every month.'
    },
    promise: PROMISE,
    pricingExtra: ['One callout a month covers it. Less than &pound;12 a week, no VAT.'],
    faq: [
      ['I get all my work from word of mouth. Why do I need a site?', 'Word of mouth ends with a Google search. When someone is given your name, they look you up before they ring. If there is nothing there, or an out of date Facebook page, some of them ring the next name on the list. Your site is where the recommendation lands.'],
      ['I&rsquo;ve already got a Facebook page.', 'Keep it. Facebook shows your posts to a fraction of your followers and does not appear when someone searches &ldquo;plumber Blyth&rdquo;. Your site does, and it takes the booking while you are on a job.'],
      ['Do I have to charge a callout fee?', 'No. If you do, pick upfront, on the day, or built into the price, and change it whenever you like.'],
      ['Do I have to take card payments?', 'No. Cash and bank transfer work too.'],
      ['Can customers still just ring or WhatsApp me?', 'Yes. That is how most trades use it. The site handles the confirmation and the paperwork.'],
      ['What if I don&rsquo;t like it?', 'You see a real example page before you pay anything. If you don&rsquo;t love it, you owe nothing and nobody chases you.'],
      ['Do I need Max?', 'Only if you want to climb Google every month. Business already includes local SEO at launch.'],
      ['What happens if I cancel?', 'Your site goes offline, there is no exit fee, and your domain transfers to you free.']
    ],
    endLine: endLine('Website for my trade'),
    freeLede: 'We design a real page for your trade business before you pay anything. If you don&rsquo;t like it, you owe nothing.'
  },

  {
    slug: 'salons',
    rich: true,
    icons: ['calendar', 'card', 'search', 'gift', 'tag', 'star', 'mail', 'photo', 'person'],
    lines: ['add online booking', 'update my price list', 'sell gift vouchers', 'take deposits for appointments', 'email my clients an offer'],
    link: 'Salons',
    title: 'Salons',
    h1: 'Websites for salons that fill the diary.',
    lede: 'Clients book online at 10pm instead of leaving a voicemail. Deposits end no-shows. Gift vouchers bring December money for February appointments. Built for you, live in 10 days.',
    heroNote: 'See your free example page first. If you don&rsquo;t love it, you owe nothing. From &pound;50 a month, no VAT.',
    trust: TRUST,
    trustLine: 'Everything below is optional and set up the way you already work. Send your price list and your best photos. We do the rest.',
    desc: 'Websites for hair and beauty salons. Online booking, deposits that stop no-shows, gift vouchers, editable price lists and galleries. Built for you, live in 10 days, from £50 a month, no VAT.',
    features: [
      ['Booked while you&rsquo;re mid colour', 'Clients pick a stylist, a treatment and a time from their phone, day or night. No voicemail to return, no double bookings. Every appointment lands in your diary.'],
      ['Deposits that end no-shows', 'A small deposit at booking and your quiet Tuesday stops being a no-show Tuesday. Set the amount, or turn it off for regulars.'],
      ['Found by clients nearby', 'A page for every treatment, written for what people search: &ldquo;balayage Morpeth&rdquo;, &ldquo;gel nails near me&rdquo;. Your Google Business Profile linked, so you show in the map results too.'],
      ['Gift vouchers, sold online', 'Paid upfront, emailed to the buyer, redeemed at the chair. Revenue in December for appointments in February.'],
      ['A price list you change in seconds', 'Add a treatment or change a price from your phone and the site updates instantly. No calls to a web person.'],
      ['Reviews on autopilot', 'A day after each appointment the client gets an email asking for a Google review. The best ones show on your site automatically, which is what new clients read before booking.'],
      ['Reminders that bring them back', 'Six weeks after a cut, eight after a colour, a friendly email says it&rsquo;s time, with a link to book. Regulars stay regular without you chasing.'],
      ['Your work, front and centre', 'Galleries of colour, cuts and nails: the same photos winning you clients on Instagram, on a site you own and Google can see.'],
      ['Every client on file', 'Their appointments, notes, what they had last time and what they paid, in one place. Email them an offer when there is a gap to fill.']
    ],
    alsoTitle: 'Also included, no extra cost',
    also: ['Stylist profiles', 'Treatment menus by category', 'Instagram feed on the site', 'Cancellation policy on every booking', 'Google Calendar link', 'Late availability banner', 'Memberships for regular treatments'],
    buildNote: 'Tell us your treatments and prices and send your best photos. We build the site, the booking and the price list, and you&rsquo;re online within 10 days.',
    steps: steps(['Tell us your treatments, your prices and your team', 'Five minutes of questions: what you offer, who does what, how you want bookings and deposits to work. That&rsquo;s your part done.']),
    stepsLine: 'Unlimited edits included. Message us from your phone and it&rsquo;s changed.',
    maxPitch: {
      heading: 'Want to show up higher every month?',
      text: 'Every salon in town is on Google. The ones that keep adding pages, reviews and photos are the ones that stay top for &ldquo;hairdresser near me&rdquo;. Business gets you there at launch. Max keeps you there, month after month.'
    },
    promise: PROMISE,
    pricingExtra: ['One colour appointment a month covers it. Less than &pound;12 a week, no VAT.'],
    faq: [
      ['I already take bookings on Instagram and Facebook.', 'Keep them. Instagram shows your posts to a fraction of your followers and does not appear when someone searches &ldquo;hairdresser near me&rdquo;. Your site does, and it takes the booking and the deposit while you are with a client.'],
      ['I use a booking app already. Will this replace it?', 'It can, or the site can link to the one you have. Either way, your clients book from your own site, where Google sends them.'],
      ['Will deposits put clients off?', 'Most salons find the opposite: fewer no-shows and clients who turn up on time. You set the amount, and regulars can be exempt.'],
      ['Can I change prices myself?', 'Yes, from your phone, and it is live in seconds. Or message us and we do it for you.'],
      ['What if I don&rsquo;t like it?', 'You see a real example page before you pay anything. If you don&rsquo;t love it, you owe nothing and nobody chases you.'],
      ['What happens if I cancel?', 'Your site goes offline, there is no exit fee, and your domain transfers to you free.']
    ],
    endLine: endLine('Website for my salon'),
    freeLede: 'We design a real page for your salon before you pay anything. If you don&rsquo;t love it, you owe nothing.'
  },

  {
    slug: 'barbers',
    rich: true,
    icons: ['calendar', 'search', 'tag', 'clock', 'star', 'repeat', 'photo', 'card', 'person'],
    lines: ['let clients book a chair', 'update my price board', 'change my opening hours', 'show my latest cuts', 'add a loyalty card'],
    link: 'Barbers',
    title: 'Barbers',
    h1: 'Websites for barbers that keep the chair full.',
    lede: 'Walk-ins find you on Google Maps and book a chair before they&rsquo;ve walked anywhere. Prices and hours always right. Regulars reminded when it&rsquo;s time. Built for you, live in 10 days.',
    heroNote: 'See your free example page first. If you don&rsquo;t rate it, you owe nothing. From &pound;50 a month, no VAT.',
    trust: TRUST,
    trustLine: 'Everything below is optional and set up the way you already work. Send your price list, your hours and a dozen photos. We do the rest.',
    desc: 'Websites for barbershops. Book a chair online, price boards, opening hours, photo walls and loyalty. Built for you, live in 10 days, from £50 a month, no VAT.',
    features: [
      ['Book a chair online', 'Clients pick a barber and a time from their phone. The queue outside is optional now, and no-shows drop when there is a name on the slot.'],
      ['Found on Maps and search', 'Set up so &ldquo;barber near me&rdquo; finds your shop first, with your hours, your prices and your reviews right there in the result.'],
      ['A price board you control', 'Skin fade up a pound? Change it from your phone and the site updates instantly.'],
      ['Opening hours people trust', 'Bank holidays, early closes, that week you&rsquo;re away. Always right, everywhere it&rsquo;s shown, so nobody turns up to a locked door.'],
      ['Reviews on autopilot', 'A day after each cut the client gets an email asking for a Google review. The best ones show on your site automatically.'],
      ['Regulars reminded', 'Three weeks after a cut, a friendly email says it&rsquo;s time, with a link to book. The regulars stay regular without you chasing.'],
      ['A photo wall of your cuts', 'The fades and beards from your Instagram, working for you on Google too.'],
      ['Deposits for the busy slots', 'Saturday mornings booked with a small deposit, so the people who book are the people who turn up. Turn it on for the slots you choose.'],
      ['Loyalty for regulars', 'A tenth cut free counter or member perks. Reasons to come back to your chair rather than the one that opened down the road.']
    ],
    alsoTitle: 'Also included, no extra cost',
    also: ['Barber profiles', 'Walk-in wait time banner', 'Instagram feed on the site', 'Gift vouchers', 'Google Calendar link', 'Student and kids pricing', 'Products you sell, listed'],
    buildNote: 'Send your price list, your hours and a dozen photos. We do the rest and you&rsquo;re online within 10 days, usually sooner.',
    steps: steps(['Tell us your prices, your hours and your barbers', 'Five minutes of questions: what you charge, when you open, who works which days. That&rsquo;s your part done.']),
    stepsLine: 'Unlimited edits included. Message us from your phone and it&rsquo;s changed.',
    maxPitch: {
      heading: 'Want to show up higher every month?',
      text: 'There are six barbers within a mile of you and all of them are on Google. The one that keeps adding reviews, photos and pages stays top for &ldquo;barber near me&rdquo;. Business gets you there at launch. Max keeps you there.'
    },
    promise: PROMISE,
    pricingExtra: ['Three cuts a month covers it. Less than &pound;12 a week, no VAT.'],
    faq: [
      ['I&rsquo;m walk-in only. Do I need bookings?', 'No. Plenty of shops keep it walk-in and use the site for hours, prices, photos and Google. Bookings are there if you want them, even for one barber or one day a week.'],
      ['I&rsquo;ve got Instagram. Isn&rsquo;t that enough?', 'Instagram is where your work gets seen. Google is where people looking for a barber right now find one. The site gives you both: your feed on the page and your shop in the map results.'],
      ['Can I change prices and hours myself?', 'Yes, from your phone, live in seconds. Or message us and we do it.'],
      ['Do I have to take deposits?', 'No. Turn them on for the slots that get no-shows and leave them off everywhere else.'],
      ['What if I don&rsquo;t like it?', 'You see a real example page before you pay anything. If you don&rsquo;t rate it, you owe nothing.'],
      ['What happens if I cancel?', 'Your site goes offline, there is no exit fee, and your domain transfers to you free.']
    ],
    endLine: endLine('Website for my barbershop'),
    freeLede: 'We design a real page for your shop before you pay anything. Don&rsquo;t rate it? You owe nothing.'
  },

  {
    slug: 'coffee-shops',
    rich: true,
    icons: ['pencil', 'search', 'card', 'clock', 'repeat', 'star', 'photo', 'calendar', 'mail'],
    lines: ['build a live drinks menu', 'add order ahead', 'add a loyalty card', 'update my opening hours', "add this week's specials"],
    link: 'Coffee shops',
    title: 'Coffee shops',
    h1: 'Websites for coffee shops that bring people back.',
    lede: '&ldquo;Are they open, what&rsquo;s on?&rdquo; answered before they ask. Orders taken and paid before they&rsquo;re through the door. A loyalty card that lives on their phone. Built for you, live in 10 days.',
    heroNote: 'See your free example page first. If it&rsquo;s not your cup, you owe nothing. From &pound;50 a month, no VAT.',
    trust: TRUST,
    trustLine: 'Everything below is optional and set up the way you already work. Send your menu and some photos. We do the rest.',
    desc: 'Websites for coffee shops. Editable menus, opening hours, order ahead, loyalty cards and Google Maps. Built for you, live in 10 days, from £50 a month, no VAT.',
    features: [
      ['A menu you edit from the counter', 'Change a drink, a bake or a price and customers see it instantly. Mark things sold out in one tap. No more &ldquo;is the menu online right?&rdquo;'],
      ['Found by people nearby', 'Set up so &ldquo;coffee near me&rdquo; finds you first, on Google Maps and in search, with your hours and photos in the result.'],
      ['Order ahead', 'Coffees and lunches ordered and paid before they arrive. Shorter queues at eight in the morning, bigger tickets all day.'],
      ['Hours that are always right', 'Holiday hours changed once, correct everywhere. No more &ldquo;are you open?&rdquo; messages at 7am.'],
      ['Loyalty on their phone', 'A digital stamp card, the tenth coffee free, no cardboard to lose. A reason to walk past the chain.'],
      ['Reviews on autopilot', 'Order-ahead customers get a friendly email asking for a Google review. The best ones show on your site, which is what visitors to town read first.'],
      ['Photos that sell the room', 'The pour, the counter, the seat in the window. The reasons people cross the street, on Google where they are deciding.'],
      ['Events and bookings', 'Cupping nights, supper clubs, the back room for a party. Tickets or a booking form, paid online, all from the site.'],
      ['Specials to your regulars', 'This week&rsquo;s bake or a rainy day offer, emailed to the people who signed up at the counter. Quiet afternoons get busier.']
    ],
    alsoTitle: 'Also included, no extra cost',
    also: ['Instagram feed on the site', 'Allergen and dietary labels', 'Wholesale or beans page', 'Gift cards', 'Sold out in one tap', 'Christmas and holiday hours', 'Catering enquiry form'],
    buildNote: 'Send your menu and some photos. We build the site and the editable menu, and you&rsquo;re online within 10 days. You keep the machine running.',
    steps: steps(['Tell us your menu, your hours and what you want to sell online', 'Five minutes of questions: what&rsquo;s on the board, when you open, whether you want orders or loyalty. That&rsquo;s your part done.']),
    stepsLine: 'Unlimited edits included. Message us from your phone and it&rsquo;s changed.',
    maxPitch: {
      heading: 'Want to show up higher every month?',
      text: 'Every visitor to town searches &ldquo;coffee near me&rdquo; and picks from the top three. Business gets you into the running at launch. Max keeps adding reviews, photos and pages so you stay there through every season.'
    },
    promise: PROMISE,
    pricingExtra: ['Fifteen flat whites a month covers it. Less than &pound;12 a week, no VAT.'],
    faq: [
      ['People find us on Instagram. Do we need a site?', 'Your regulars do. The people who have just parked up and typed &ldquo;coffee near me&rdquo; don&rsquo;t. Google shows them a site with hours, a menu and reviews. The site puts you in that list, with your Instagram feed on it.'],
      ['Can I change the menu myself?', 'Yes, from your phone behind the counter, live in seconds. Or message us and we do it.'],
      ['Do I have to take orders online?', 'No. Plenty of shops use the site for the menu, hours, photos and Google only. Order ahead is there if you want it.'],
      ['What about delivery apps?', 'Keep them if they work for you. Orders through your own site have no commission, and the customer&rsquo;s email is yours.'],
      ['What if I don&rsquo;t like it?', 'You see a real example page before you pay anything. If it&rsquo;s not your cup, you owe nothing.'],
      ['What happens if I cancel?', 'Your site goes offline, there is no exit fee, and your domain transfers to you free.']
    ],
    endLine: endLine('Website for my coffee shop'),
    freeLede: 'We design a real page for your coffee shop before you pay anything. Not your cup? You owe nothing.'
  },

  {
    slug: 'gyms',
    rich: true,
    icons: ['card', 'calendar', 'search', 'person', 'layers', 'photo', 'star', 'repeat', 'mail'],
    lines: ['add a class timetable', 'set up memberships', 'add a members area', 'take payments monthly', 'show member results'],
    link: 'Gyms &amp; personal trainers',
    title: 'Gyms &amp; personal trainers',
    h1: 'Websites for gyms that sign members up.',
    lede: 'Memberships paid monthly on their own. Classes booked from a timetable you edit. Programmes behind a login worth the fee alone. Built for you, live in 10 days.',
    heroNote: 'See your free example page first. If you don&rsquo;t love it, you owe nothing. From &pound;50 a month, no VAT.',
    trust: TRUST,
    trustLine: 'Everything below is optional and set up the way you already work. Tell us your classes and prices. We do the rest.',
    desc: 'Websites for gyms and personal trainers. Memberships paid monthly, class timetables and bookings, members areas and programmes. Built for you, live in 10 days, from £50 a month, no VAT.',
    features: [
      ['Memberships paid monthly, on their own', 'Members sign up, pay and log in on your site. The money arrives every month without chasing. The setup the big chains have, at your gym.'],
      ['Classes booked from a timetable you edit', 'Change the spin slot from your phone and members see this week&rsquo;s real timetable. They book a spot, and full classes take a waiting list.'],
      ['New members from search', 'Set up so &ldquo;gym near me&rdquo; and &ldquo;personal trainer near me&rdquo; find you first, with your reviews and photos in the result.'],
      ['Programmes behind a login', 'Training plans, videos and content only members can see. Worth the membership on its own, and a reason not to cancel.'],
      ['Free trial or taster, handled', 'A first session or a seven day trial booked online, with the membership offered the moment it ends.'],
      ['Transformations that convert', 'Before and after galleries and member stories. The proof that sells the first session.'],
      ['Reviews on autopilot', 'A week into membership, and after milestones, members get a friendly email asking for a Google review. The best ones show on your site.'],
      ['Lapsed members brought back', 'Someone who cancelled three months ago gets one friendly email with a reason to return. Most gyms never send it.'],
      ['Every member on file', 'Plan, payments, attendance and notes, in one place. Email the whole list, or just the ones who have gone quiet.']
    ],
    alsoTitle: 'Also included, no extra cost',
    also: ['Trainer profiles', 'Pause and cancel from their account', 'Class capacity limits', 'Personal training packages', 'Challenges and events with tickets', 'Google Calendar link', 'Merch and supplements page'],
    buildNote: 'Tell us your classes, prices and how memberships work. We build the site, timetable and member logins, and you&rsquo;re online within 10 days.',
    steps: steps(['Tell us your classes, your prices and how memberships work', 'Five minutes of questions: what you run, what it costs, whether there is a trial. That&rsquo;s your part done.']),
    stepsLine: 'Unlimited edits included. Message us from your phone and it&rsquo;s changed.',
    maxPitch: {
      heading: 'Want to show up higher every month?',
      text: 'January is decided in December. The gyms that keep adding pages, reviews and results are the ones people find when the resolutions start. Business gets you ranking at launch. Max keeps you climbing every month.'
    },
    promise: PROMISE,
    pricingExtra: ['One membership a month covers it. Less than &pound;12 a week, no VAT.'],
    faq: [
      ['I use a gym app for memberships already.', 'Keep it if it works. The site can link to it, or take memberships itself with no per-member fees. Either way, new members find you on Google and sign up from your own site.'],
      ['I&rsquo;m a personal trainer, not a gym. Is this for me?', 'Yes. Packages, online booking, a programme area for your clients and a page that ranks for &ldquo;personal trainer near me&rdquo;. Same price.'],
      ['Can members cancel themselves?', 'If you want them to. Some gyms prefer a conversation first. You choose.'],
      ['Can I change the timetable myself?', 'Yes, from your phone, live in seconds. Or message us and we do it.'],
      ['What if I don&rsquo;t like it?', 'You see a real example page before you pay anything. If you don&rsquo;t love it, you owe nothing.'],
      ['What happens if I cancel?', 'Your site goes offline, there is no exit fee, and your domain transfers to you free.']
    ],
    endLine: endLine('Website for my gym'),
    freeLede: 'We design a real page for your gym before you pay anything. No commitment. That part comes later.'
  },

  {
    slug: 'cleaners',
    rich: true,
    icons: ['doc', 'search', 'shield', 'star', 'repeat', 'card', 'person', 'pin', 'photo'],
    lines: ['add a quote form', 'show my before and afters', 'set up weekly bookings', 'list the areas I cover', 'add my reviews'],
    link: 'Cleaners',
    title: 'Cleaners',
    h1: 'Websites for cleaners that win the regular round.',
    lede: 'Quotes from a form that asks the right questions, so you price without a visit. Reviews and insurance on the page where nervous first timers look. Weekly cleans booked once and paid on their own. Built for you, live in 10 days.',
    heroNote: 'See your free example page first. If it&rsquo;s not spotless, you owe nothing. From &pound;50 a month, no VAT.',
    trust: TRUST,
    trustLine: 'Everything below is optional and set up the way you already work. Tell us your services, prices and areas. We do the rest.',
    desc: 'Websites for cleaning businesses. Quote forms, reviews and trust badges, weekly bookings paid automatically, areas covered and before and after galleries. Built for you, live in 10 days, from £50 a month, no VAT.',
    features: [
      ['Quotes while you clean', 'A form that asks rooms, frequency, oven or not, with photos attached. Quoting takes minutes, not visits, and the enquiry is saved with their details.'],
      ['Found in the areas you cover', 'A page for every service and every town on your round, written for &ldquo;cleaner Ashington&rdquo; and &ldquo;end of tenancy clean near me&rdquo;. Enquiries from streets you actually drive to.'],
      ['Trust on the page', 'Insured, DBS checked, years trading, said clearly where first time customers look for it. Cleaning is bought on trust, and the site earns it before they ring.'],
      ['Reviews doing the selling', 'A day after each clean the customer gets a friendly email asking for a Google review. The best ones show on your site. In this trade they are the deciding factor.'],
      ['Regular slots, booked once', 'Weekly and fortnightly cleans set up as repeat bookings with the card charged each time. A steady round, not one-offs, and no chasing invoices.'],
      ['Deposits for the big jobs', 'End of tenancy and deep cleans booked with a deposit paid online. Committed customers, protected diary.'],
      ['Every customer in one place', 'Their address, key notes, what you did last time, what they paid. Email the whole round when you have a gap.'],
      ['The areas you cover', 'Postcodes and towns listed plainly, with a map. The jobs that come in are on your patch.'],
      ['Before and after galleries', 'End of tenancy transformations sell deep cleans better than any wording. Straight from your phone to the site.']
    ],
    alsoTitle: 'Also included, no extra cost',
    also: ['Price guide by property size', 'Checklist of what a clean includes', 'Team pages', 'Gift vouchers', 'Holiday and pause bookings', 'Google Calendar link', 'Landlord and letting agent page'],
    buildNote: 'Tell us your services, prices and areas. We write the pages and build the quote form, and you&rsquo;re online within 10 days.',
    steps: steps(['Tell us your services, your prices and your patch', 'Five minutes of questions: what you clean, what you charge, where you go. That&rsquo;s your part done.']),
    stepsLine: 'Unlimited edits included. Message us from your phone and it&rsquo;s changed.',
    maxPitch: {
      heading: 'Want to show up higher every month?',
      text: 'The cleaners at the top for &ldquo;cleaner near me&rdquo; are not the best cleaners. They are the ones whose sites keep growing: new areas, new reviews, new pages. Business gets you ranking at launch. Max keeps you climbing.'
    },
    promise: PROMISE,
    pricingExtra: ['One regular clean a month covers it. Less than &pound;12 a week, no VAT.'],
    faq: [
      ['My work comes from Facebook groups and recommendations.', 'Keep doing that. When someone is recommended you, they look you up before they message. A site with reviews, insurance and clear prices turns that look into a booking. A Facebook page with three photos often doesn&rsquo;t.'],
      ['Do I have to take card payments?', 'No. Bank transfer and cash work too. Cards just mean weekly cleans get paid without asking.'],
      ['Can I list prices without giving a fixed quote?', 'Yes. A price guide by property size, with the form for the exact quote. Customers know roughly, and only serious ones fill the form.'],
      ['I&rsquo;m a one person business. Is a site overkill?', 'It is one person businesses that need it most. It answers the questions while you are cleaning, so you are not losing jobs to the phone going to voicemail.'],
      ['What if I don&rsquo;t like it?', 'You see a real example page before you pay anything. If it&rsquo;s not spotless, you owe nothing.'],
      ['What happens if I cancel?', 'Your site goes offline, there is no exit fee, and your domain transfers to you free.']
    ],
    endLine: endLine('Website for my cleaning business'),
    freeLede: 'We design a real page for your cleaning business before you pay anything. Not spotless? You owe nothing.'
  },

  {
    slug: 'tutors',
    rich: true,
    icons: ['layers', 'search', 'card', 'star', 'shield', 'calendar', 'person', 'repeat', 'doc'],
    lines: ['add a page for GCSE maths', 'take lesson payments online', 'show my results', 'add a waiting list', 'update my timetable'],
    link: 'Tutors',
    title: 'Tutors',
    h1: 'Websites for tutors that parents choose.',
    lede: 'A page for every subject and level, found by the parent searching for exactly that. Results and DBS on the page where they check. Lessons booked and paid in blocks, no chasing transfers. Built for you, live in 10 days.',
    heroNote: 'See your free example page first. If you don&rsquo;t love it, you owe nothing. From &pound;50 a month, no VAT.',
    trust: TRUST,
    trustLine: 'Everything below is optional and set up the way you already work. Tell us your subjects, levels and rates. We do the rest.',
    desc: 'Websites for tutors and tuition centres. Subject pages, lessons booked and paid online, results and testimonials, timetables and waiting lists. Built for you, live in 10 days, from £50 a month, no VAT.',
    features: [
      ['A page per subject and level', 'GCSE maths, A level physics, 11+. Each with its own page, found by the parent searching for exactly that, in your town.'],
      ['Found by local parents', 'Set up so &ldquo;maths tutor near me&rdquo; and &ldquo;11+ tutor Gosforth&rdquo; find you first, with your reviews and results in the result.'],
      ['Lessons booked and paid', 'Blocks of lessons paid online upfront. No chasing bank transfers between sessions, and cancellations follow your policy automatically.'],
      ['Results and testimonials', 'Grades improved and parent quotes, presented properly. Your track record is the product, and the site puts it first.'],
      ['Trust, stated clearly', 'DBS checked, qualifications, exam boards covered. The checklist parents run through, answered on the page before they enquire.'],
      ['Your timetable, current', 'Show which slots are free this term. When you are full, the site takes a waiting list, so September is booked in July.'],
      ['Every student on file', 'Lessons, payments, notes and progress against each student, with a parent email a click away.'],
      ['Reviews on autopilot', 'At the end of each term, or after results day, parents get a friendly email asking for a Google review. The best ones show on your site.'],
      ['Resources behind a login', 'Past papers, worksheets and homework in a private area for your students. A reason to stay with you, and one less email chain.']
    ],
    alsoTitle: 'Also included, no extra cost',
    also: ['Online lesson links', 'Group and one to one pricing', 'Exam board pages', 'Term dates and holidays', 'Free assessment booking', 'Google Calendar link', 'Tuition centre team pages'],
    buildNote: 'Tell us your subjects, levels and rates. We write the pages and set up bookings, and you&rsquo;re online within 10 days.',
    steps: steps(['Tell us your subjects, your levels and your rates', 'Five minutes of questions: what you teach, to whom, what it costs, how you take bookings. That&rsquo;s your part done.']),
    stepsLine: 'Unlimited edits included. Message us from your phone and it&rsquo;s changed.',
    maxPitch: {
      heading: 'Want to show up higher every month?',
      text: 'September and January are decided on Google. The tutors who keep adding subject pages, reviews and results are the ones parents find first. Business gets you ranking at launch. Max keeps you climbing.'
    },
    promise: PROMISE,
    pricingExtra: ['One lesson a month covers it. Less than &pound;12 a week, no VAT.'],
    faq: [
      ['I&rsquo;m on a tutoring directory already.', 'Keep it. Directories rank you next to fifty others and take a cut. Your own site ranks for your subject in your town, and every enquiry is yours.'],
      ['I&rsquo;m fully booked. Why would I need a site?', 'To stay that way. A waiting list fills September in July, and a page that ranks means you choose the students rather than the other way round. It also lets you raise rates.'],
      ['Do I have to take payments online?', 'No. Bank transfer works. Online payment just means blocks are paid before the first lesson.'],
      ['Can I show results without naming students?', 'Yes. Grades improved, first names or initials, and quotes from parents with their permission.'],
      ['What if I don&rsquo;t like it?', 'You see a real example page before you pay anything. If you don&rsquo;t love it, you owe nothing.'],
      ['What happens if I cancel?', 'Your site goes offline, there is no exit fee, and your domain transfers to you free.']
    ],
    endLine: endLine('Website for my tutoring'),
    freeLede: 'We design a real page for your tutoring before you pay anything. Full marks or you owe nothing.'
  },

  {
    slug: 'photographers',
    rich: true,
    icons: ['photo', 'search', 'calendar', 'card', 'person', 'tag', 'star', 'repeat', 'mail'],
    lines: ['add my wedding gallery', 'take booking deposits', 'add client logins', 'update my packages', 'add an enquiry form'],
    link: 'Photographers',
    title: 'Photographers',
    h1: 'Websites for photographers that book the shoot.',
    lede: 'Galleries that do your work justice, found for the genre they are searching. Enquiries that arrive with the date attached. Deposits that hold it. Built for you, live in 10 days.',
    heroNote: 'See your free example page first. If it&rsquo;s not picture perfect, you owe nothing. From &pound;50 a month, no VAT.',
    trust: TRUST,
    trustLine: 'Everything below is optional and set up the way you already work. Send your best shots and your packages. We do the rest.',
    desc: 'Websites for photographers. Portfolio galleries, enquiries with the date attached, deposits that hold the date, client galleries behind a login. Built for you, live in 10 days, from £50 a month, no VAT.',
    features: [
      ['Galleries that do your work justice', 'Weddings, portraits, products. Fast loading galleries where the photos do the talking, on a site that is yours rather than an algorithm&rsquo;s.'],
      ['Found for what you shoot', 'A page per genre, so &ldquo;wedding photographer near me&rdquo; finds the wedding work and &ldquo;newborn photographer Newcastle&rdquo; finds the newborns. Not the whole archive.'],
      ['Enquiries with the date attached', 'The form asks the date, venue and what they are after, so you reply already knowing if you are free. Every enquiry saved with their details.'],
      ['Deposits that hold the date', 'A booking fee paid online when they book. The date is yours and theirs, in writing, and the diary stops double filling.'],
      ['Client galleries behind a login', 'Deliver each shoot in a private gallery your client logs in to view, download and share. Print orders if you want them.'],
      ['Packages you edit yourself', 'Your packages and prices laid out clearly. Change them from your phone between seasons.'],
      ['Reviews on autopilot', 'A week after the gallery goes out, the client gets a friendly email asking for a Google review. The best ones show on your site, next to the work.'],
      ['Follow ups that book the next shoot', 'The newborn family gets a first birthday email. The wedding couple gets an anniversary one. Repeat bookings without a spreadsheet.'],
      ['Mini session days, sold out', 'Autumn minis and Christmas sessions listed with slots and prices, booked and paid online. The whole day fills from one post.']
    ],
    alsoTitle: 'Also included, no extra cost',
    also: ['Instagram feed on the site', 'Gift vouchers', 'Pricing guide download', 'Venue and supplier pages', 'Second shooter and team pages', 'Google Calendar link', 'Print and album ordering'],
    buildNote: 'Send us your best shots and your packages. We build the galleries and the enquiry flow, and you&rsquo;re online within 10 days.',
    steps: steps(['Send your best work, your packages and your genres', 'Five minutes of questions and a folder of photos: what you shoot, what it costs, how you want enquiries and deposits to work. That&rsquo;s your part done.']),
    stepsLine: 'Unlimited edits included. Message us from your phone and it&rsquo;s changed.',
    maxPitch: {
      heading: 'Want to show up higher every month?',
      text: 'Couples book photographers a year out, from a Google search they do once. The photographers who keep adding galleries, venue pages and reviews are the ones in that search. Business gets you ranking at launch. Max keeps you climbing.'
    },
    promise: PROMISE,
    pricingExtra: ['A fraction of one booking covers the year. Less than &pound;12 a week, no VAT.'],
    faq: [
      ['My Instagram is my portfolio. Do I need a site?', 'Instagram shows your work to people who already follow you. Google shows it to the couple searching &ldquo;wedding photographer&rdquo; in your town this week. The site gives you both, with your feed on it.'],
      ['I already have a website on a portfolio platform.', 'Then you know the pain: templates, upsells, nothing ranking. This one is built around your work, ranks for your genres, and someone else keeps it updated.'],
      ['Will the galleries load fast on phones?', 'Yes. Photos are sized for the screen they are on, so a wedding gallery opens in a second on a phone at the venue.'],
      ['Can clients download their photos?', 'Yes, from their private gallery, with a login. You choose what is downloadable and for how long.'],
      ['What if I don&rsquo;t like it?', 'You see a real example page around your own photos before you pay anything. If it&rsquo;s not picture perfect, you owe nothing.'],
      ['What happens if I cancel?', 'Your site goes offline, there is no exit fee, and your domain transfers to you free.']
    ],
    endLine: endLine('Website for my photography'),
    freeLede: 'We design a real page around your photos before you pay anything. If it&rsquo;s not picture perfect, you owe nothing.'
  },

  {
    slug: 'gardeners',
    rich: true,
    icons: ['photo', 'search', 'doc', 'layers', 'calendar', 'card', 'repeat', 'star', 'pin'],
    lines: ['show my landscaping projects', 'add a quote form with photos', 'promote autumn hedge cuts', 'list the areas I cover', 'take deposits online'],
    link: 'Gardeners &amp; landscapers',
    title: 'Gardeners &amp; landscapers',
    h1: 'Websites for gardeners that land the bigger jobs.',
    lede: 'Finished gardens shown start to finish, found by the person searching for a patio in your town. Quotes with photos attached so you price before you visit. Deposits on the big jobs. Built for you, live in 10 days.',
    heroNote: 'See your free example page first. If it doesn&rsquo;t grow on you, you owe nothing. From &pound;50 a month, no VAT.',
    trust: TRUST,
    trustLine: 'Everything below is optional and set up the way you already work. Send job photos and a list of services. We do the rest.',
    desc: 'Websites for gardeners and landscapers. Project galleries, quote forms with photos, a page per service, seasonal promotions, deposits and areas covered. Built for you, live in 10 days, from £50 a month, no VAT.',
    features: [
      ['Project galleries', 'Decking, patios, full makeovers, shown start to finish. The garden sells the next garden, and the site is where the finished ones live.'],
      ['Found in the towns you cover', 'A page for every service and every village on your patch, written for &ldquo;landscaper Ponteland&rdquo; and &ldquo;hedge cutting near me&rdquo;. Your Google Business Profile linked, so you show on the map too.'],
      ['Quotes with photos attached', 'Customers send photos of the garden with the enquiry, so you price accurately before you visit. Every enquiry saved with their details.'],
      ['A page per service', 'Lawn care, hedges, landscaping, clearances. Each found by the person searching for it, each with its own photos.'],
      ['Seasonal work, promoted in season', 'Hedge cuts pushed in autumn, makeovers in spring, gutters before winter. The site keeps up with the calendar and emails last year&rsquo;s customers when it&rsquo;s time.'],
      ['Deposits for the big jobs', 'Landscaping booked with a deposit paid online. Committed customers, protected diary, no wasted Saturdays.'],
      ['Regular rounds, booked once', 'Fortnightly lawn and garden maintenance set up as repeat bookings, paid on their own. A round that runs itself.'],
      ['Reviews on autopilot', 'A day after the job the customer gets a friendly email asking for a Google review. The best ones show on your site, next to the photos.'],
      ['The areas you cover', 'Villages and postcodes listed with a map, so the jobs that come in are on your patch and not an hour away.']
    ],
    alsoTitle: 'Also included, no extra cost',
    also: ['Before and after sliders', 'Trade and insurance badges', 'Materials and suppliers page', 'Team pages', 'Waste carrier licence shown', 'Google Calendar link', 'Commercial grounds page'],
    buildNote: 'Send job photos and a list of services. We write the pages and build the quote form, and you&rsquo;re online within 10 days.',
    steps: steps(['Tell us your services, your patch and send the job photos', 'Five minutes of questions and the photos on your phone: what you do, where you go, how you like to quote. That&rsquo;s your part done.']),
    stepsLine: 'Unlimited edits included. Message us from your phone and it&rsquo;s changed.',
    maxPitch: {
      heading: 'Want to show up higher every month?',
      text: 'Spring is decided in February, when everyone searches &ldquo;landscaper near me&rdquo; at once. The gardeners who keep adding projects, pages and reviews are the ones that search finds. Business gets you ranking at launch. Max keeps you climbing.'
    },
    promise: PROMISE,
    pricingExtra: ['One lawn cut a week covers it. Less than &pound;12 a week, no VAT.'],
    faq: [
      ['I get plenty of work from Facebook and word of mouth.', 'The small jobs, yes. The patio and the makeover are researched on Google first, and the person doing the researching picks from sites with galleries and reviews. That is the job the site wins you.'],
      ['I&rsquo;m out on jobs all day. Who updates it?', 'We do. Send the photos from your phone and a line about the job, and they are on the site. Unlimited changes are included.'],
      ['Do I have to take deposits?', 'No. Turn them on for the big jobs only, or not at all.'],
      ['Can I show prices?', 'A price guide for the regular work, and the quote form for the rest. You decide how much to show.'],
      ['What if I don&rsquo;t like it?', 'You see a real example page before you pay anything. If it doesn&rsquo;t grow on you, you owe nothing.'],
      ['What happens if I cancel?', 'Your site goes offline, there is no exit fee, and your domain transfers to you free.']
    ],
    endLine: endLine('Website for my gardening business'),
    freeLede: 'We design a real page for your gardening business before you pay anything. If it doesn&rsquo;t grow on you, you owe nothing.'
  }
];
