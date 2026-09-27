/* The feature pages: one per thing a business owner types into Google when
 * they have a problem, not a trade. "booking system for small business",
 * "take payments online", "facebook ads for local businesses". Each page
 * answers that search with the pain, the way it works on a Kanvas One site,
 * the plan it lives on, and the free example first.
 *
 * Built by build.js into /<slug>.html. Fields:
 *
 *   slug        the URL
 *   short       the name in cross-links
 *   search      the title tag, written the way the search is
 *   h1          the promise
 *   lede        the outcome, one or two sentences
 *   desc        meta description
 *   pain        what it is like without it, in the owner's words
 *   lines       requests typed into the demo box
 *   placeholder the business name example on the form
 *   how         three steps, [heading, text]
 *   gets        what they get, ticked
 *   plan        'business' | 'max': the plan it lives on
 *   planLine    one sentence on the plan and price
 *   faq         [question, answer] pairs; also structured data
 */
module.exports = [
  {
    slug: 'booking-system-for-small-business',
    short: 'Booking system',
    search: 'Booking system for small businesses, built into your website',
    h1: 'A booking system on your own website.',
    lede: 'Customers pick a slot, pay a deposit and get a reminder. You find out on your phone. No app to send them to, no back-and-forth.',
    desc: 'A booking system built into your own website, set up for you: customers pick a slot, pay a deposit and get a text reminder. Built and run for you from £50 a month, no setup fee. See a real page for your business free within 24 hours.',
    pain: 'Every booking is three messages. What days have you got, what time, can you do Saturday. Then a no-show, because nothing was paid and nothing reminded them. The booking apps want a cut, a monthly fee, and your customers on their site instead of yours.',
    lines: ['Let customers book a slot on my site', 'Take a £10 deposit when they book', 'Text them a reminder the day before', 'Show my availability so they stop asking'],
    placeholder: 'e.g. Fade Room Barbers',
    how: [
      ['Tell me how you work', 'Your services, how long each takes, when you are open, what deposit you want. Five minutes.'],
      ['I build it into your site', 'The calendar, the deposit, the confirmation and the reminder. On your own address, matching your site, within 14 days of joining.'],
      ['Bookings arrive on your phone', 'Each one with the name, the service and the deposit paid. Change your hours yourself, any time.']
    ],
    gets: [
      'A calendar on your site that only shows the slots you have',
      'Deposits or full payment at booking, straight to your bank',
      'A confirmation to them, a message to you',
      'A text reminder the day before, which is what stops no-shows',
      'Every customer’s bookings kept against their name',
      'Cancel and rebook links, so they do not have to ring'
    ],
    plan: 'business',
    planLine: 'Bookings are part of Business: &pound;50 a month, no setup fee, and the site, hosting and web address are in it.',
    faq: [
      ['Does it work for more than one person?', 'Yes. Each barber, stylist or trainer gets their own hours and their own calendar, and the customer picks who.'],
      ['Can I take a deposit?', 'Yes, any amount you like, or the full price. It goes to your bank through Stripe, and a customer who paid a deposit turns up.'],
      ['What if I already use a booking app?', 'Keep it if you like it. Most people move because the app takes a fee per booking, or sends their customers to the app&rsquo;s site instead of theirs.'],
      ['Do my customers need an account?', 'No. Name, phone, pick a slot, pay. Their history is kept for you, not gated behind a login for them.'],
      ['How long does it take?', 'Your site is live the day you join. The booking system is built within 14 days, or your next month is free.']
    ]
  },
  {
    slug: 'take-payments-online-small-business',
    short: 'Online payments',
    search: 'Take payments online for your small business, on your own website',
    h1: 'Take payments on your own website.',
    lede: 'Deposits, invoices, products, gift vouchers. Paid by card on your site, straight to your bank, while you are on a job.',
    desc: 'Take card payments on your own website: deposits, invoices, products and gift vouchers, paid straight to your bank. Set up for you from £50 a month, no setup fee. See a real page for your business free within 24 hours.',
    pain: 'Chasing bank transfers. Cash that has to be counted. A card machine that costs monthly whether you use it or not. Customers who want to pay now, at eleven at night, and cannot.',
    lines: ['Take deposits on my site', 'Let people pay an invoice by card', 'Sell gift vouchers online', 'Add a small shop to my site'],
    placeholder: 'e.g. Nova Nails',
    how: [
      ['Tell me what people pay you for', 'Deposits, a price list, products, vouchers, invoices. Whatever it is, and how you want the money to land.'],
      ['I connect it to your bank', 'Stripe, set up for you, paid into your account. No monthly fee for the card machine you do not use.'],
      ['Customers pay on your site', 'On their phone, in a minute, at any hour. You get a message; they get a receipt.']
    ],
    gets: [
      'Card payments on your own site, Apple Pay and Google Pay included',
      'Deposits at booking, or the full price up front',
      'Pay-a-link invoices: send the link, get paid',
      'Gift vouchers sold online and redeemed in person',
      'A small shop, if you sell things',
      'Every payment against the customer’s name'
    ],
    plan: 'business',
    planLine: 'Payments are part of Business: &pound;50 a month, no setup fee. Card fees are Stripe&rsquo;s, about 1.5% plus 20p per payment, and nothing on top from me.',
    faq: [
      ['What does it cost per payment?', 'Stripe&rsquo;s fee, about 1.5% plus 20p for a UK card. Nothing on top. There is no monthly fee for taking payments.'],
      ['When does the money arrive?', 'In your bank account a few days after the payment, on a rolling basis. Stripe sets the exact schedule.'],
      ['Can I still take cash?', 'Of course. This is for the customer who wants to pay now and the deposit that makes a booking real.'],
      ['Is it safe?', 'The card details go to Stripe, never to your site or to me. Stripe is what most online shops in the UK run on.'],
      ['Can I sell products?', 'Yes. A shop page with your products, stock and postage, built in. Ask for it and it gets made.']
    ]
  },
  {
    slug: 'facebook-ads-for-local-businesses',
    short: 'Facebook and Instagram ads',
    search: 'Facebook and Instagram ads for local businesses, run for you',
    h1: 'Facebook and Instagram ads, run for you.',
    lede: 'You set the budget. I write the offer, build the ad and the form, run it, and tell you each month what it cost and what came in.',
    desc: 'Facebook and Instagram ads for local businesses, set up, run and tracked for you. You set the budget and change it any time; I write the offer, build the ad and the form, and report every month. Part of Max, £250 a month, ten businesses at a time.',
    pain: 'You boosted a post once and got likes from people three hundred miles away. An agency wanted &pound;600 a month before the budget. So the ads never got done, and the phone stays as quiet as it was.',
    lines: ['Run a Facebook ad for my boiler service offer', 'Get me more customers in my town', 'Put a form on my site the ad can send people to', 'Tell me what the ads brought in this month'],
    placeholder: 'e.g. Dave the Plumber',
    how: [
      ['A photo, or a line of text', 'The job you want more of, and a picture of it. That is all I need from you, plus access to your Facebook page.'],
      ['I build the offer, the ad and the form', 'Written for your town and your trade, pointing at a page on your own site that turns a click into a call. Live within 7 days.'],
      ['You set the budget, I run it', 'Paid by you straight to Meta, changed whenever you like. Every month, a note: what ran, what it cost, what came in.']
    ],
    gets: [
      'The offer, the ad and the landing form, written and built for you',
      'Ads shown to people in your area, not the whole country',
      'A budget you set and can change or pause any time, from &pound;10 a day',
      'Your first ad live within 7 days',
      'A monthly note: spend, enquiries, cost per enquiry, what changed',
      'Missed calls from the ads answered by text in seconds'
    ],
    plan: 'max',
    planLine: 'Ads are part of Max: &pound;250 a month with the website, the ranking work and the texts in it. Ten businesses at a time; &pound;250 for the first ten, then the price goes up.',
    faq: [
      ['How much should the budget be?', 'Your call, and you can change it any time. Below about &pound;10 a day there is not enough to learn from, so that is where I suggest starting.'],
      ['Who pays Meta?', 'You do, directly, on your own ad account. I never hold or spend your advertising money. The &pound;250 is for the work.'],
      ['Will it definitely bring customers?', 'No one honest can promise that. What I promise is the work: a proper offer, a proper ad, a page that converts, and a note every month showing what it brought in, so you can decide with numbers.'],
      ['What do you need from me?', 'A photo or a line about the job you want more of, and admin access to your Facebook page. I do the rest.'],
      ['Why only ten businesses?', 'Because running ads properly takes attention every week. Ten is what I can do well. The first ten pay &pound;250 and keep that price.']
    ]
  },
  {
    slug: 'website-with-live-chat',
    short: 'Live chat',
    search: 'A website with live chat, answered from your phone',
    h1: 'Live chat on your website, answered from your phone.',
    lede: 'The question they would have rung about, answered in a message, kept with their name. No app for them, no desk for you.',
    desc: 'Live chat built into your own website and answered from your phone: enquiries, questions and quotes in one place, kept against the customer’s name. Set up for you from £50 a month, no setup fee. See a real page for your business free within 24 hours.',
    pain: 'Half your enquiries are the same four questions. They arrive on Facebook, Instagram, WhatsApp, text and email, and one of them always gets missed. The one you miss was the job.',
    lines: ['Add live chat to my site', 'Answer questions from my phone', 'Keep every enquiry in one place', 'Let people send me a photo of the job'],
    placeholder: 'e.g. Bright Sparks Electrical',
    how: [
      ['I add the chat to your site', 'A small button on every page. Customers type, and can send a photo of the job.'],
      ['It comes to your phone', 'A notification, and the whole conversation. Reply when you are off the ladder. If they left a number, they hear back by text too.'],
      ['Everything in one place', 'Chats, enquiries, bookings and payments, against the customer’s name. Nothing missed, nothing to search five apps for.']
    ],
    gets: [
      'Live chat on every page of your site',
      'Answered from your phone, not a desk',
      'Photos of the job sent in the chat',
      'A reply by text or email if they stepped away',
      'The common questions answered on the site before they ask',
      'Every conversation kept with the customer’s bookings and payments'
    ],
    plan: 'business',
    planLine: 'Live chat is part of Business: &pound;50 a month, no setup fee, with the site, hosting and web address in it.',
    faq: [
      ['Do I have to answer straight away?', 'No. It is a message, not a phone call. They see that you will reply, and if they leave a number they get your reply by text.'],
      ['Is it a bot?', 'No. It is you, from your phone. The site answers the common questions in the page itself, so the chat is for the ones that need you.'],
      ['Can they send photos?', 'Yes. A photo of the boiler, the garden, the nails they want. It saves the first visit for most trades.'],
      ['Where do the messages go?', 'Your phone, and your account on Kanvas One, where every customer&rsquo;s chats, bookings and payments sit together.'],
      ['How long does it take?', 'Your site is live the day you join. The chat is built within 14 days, or your next month is free.']
    ]
  },
  {
    slug: 'get-google-reviews-automatically',
    short: 'Google reviews automatically',
    search: 'Get Google reviews automatically, after every job',
    h1: 'Google reviews asked for after every job, automatically.',
    lede: 'A message the day after, with the link. You never have to ask, and the reviews are what move you up the map.',
    desc: 'Get Google reviews automatically: a message to every customer the day after the job, with the link, sent by your website. Set up for you from £50 a month, no setup fee. See a real page for your business free within 24 hours.',
    pain: 'You know reviews are what people check. You mean to ask. The job is done, the van is loaded, and asking feels awkward, so the customer who was delighted never says so where anyone can see it.',
    lines: ['Ask every customer for a Google review', 'Send the review link the day after the job', 'Show my reviews on my site', 'Get me higher on Google Maps in my town'],
    placeholder: 'e.g. Green & Tidy Gardens',
    how: [
      ['Your Google listing, linked', 'I connect your Google Business Profile to your site, or set one up if you have none.'],
      ['The ask, sent for you', 'The day after each booking or payment, the customer gets a short message from your business with the review link. Written once, sent every time.'],
      ['Reviews on your site too', 'The good ones show on your own pages, so the next customer sees them before they ring.']
    ],
    gets: [
      'A review request sent the day after every job, automatically',
      'Your Google Business Profile set up, verified and linked',
      'Your reviews shown on your own site',
      'A reply nudge to you when a new review lands',
      'More reviews, which is what Google Maps ranks by in your town',
      'Nothing for you to remember'
    ],
    plan: 'business',
    planLine: 'Automatic review requests are part of Business: &pound;50 a month, no setup fee, with the site, hosting and web address in it.',
    faq: [
      ['Is it allowed?', 'Yes. Asking every customer for an honest review is what Google recommends. What is not allowed is paying for reviews or filtering out the unhappy ones, and this does neither.'],
      ['What does the message say?', 'A short thank-you from your business and the link. You see it before it goes live and can change the wording any time.'],
      ['What if someone leaves a bad one?', 'You get a nudge, and you reply. A calm reply to a bad review is read by more people than the review itself.'],
      ['Do I need a Google Business Profile?', 'Yes, and if you have none I set it up and verify it with you. It is the listing that appears on Maps.'],
      ['How long does it take?', 'Your site is live the day you join. The review requests are running within 14 days, or your next month is free.']
    ]
  }
];
