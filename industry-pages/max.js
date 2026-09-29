/* The Max models: one per business type, each an end-to-end system that is
 * built, tested and repeated for that type. Built by build.js into
 * /max/<slug>.html. Same price whatever the type; the customer pays their
 * own ad spend on top.
 *
 * Trades is the first and the fullest. Clubs and Salon carry the same
 * structure with [TODO] where the type-specific examples go.
 *
 * Fields:
 *   slug, name           /max/<slug>, "Trades Max"
 *   promise              the one-line promise under the name
 *   desc                 meta description, from the promise
 *   who                  who it is for, one paragraph
 *   stages               four: { name, intro (italic), items }
 *   you / we             the two columns of what each side does
 *   value                rows of [what you get, what it does for you, bought separately]
 *   valueTotal           the bold total line
 *   why                  four [bold lead, sentence] pairs
 *   faq                  [question, answer] pairs; also structured data
 *   tag                  the ?t= value for the free page
 */
const AD_SPEND = 'You pay your own ad spend on top, straight to Meta. &pound;150 to &pound;300 for the first month is enough to learn what works.';

module.exports = [
  {
    slug: 'trades',
    name: 'Trades Max',
    tag: 'trades',
    promise: 'Your phone rings with jobs. The rest is done for you.',
    desc: 'Trades Max: a website, ads, local SEO, quotes, bookings, payments, reviews and referrals, built and run for plumbers, electricians, roofers and builders. £250 a month, no setup fee, you pay your own ad spend. See a real page for your business free within 24 hours.',
    who: 'Plumbers, electricians, gas engineers, roofers, builders, plasterers, landscapers. One or two vans, good at the work, want more of it, and no time to do the marketing yourself.',
    stages: [
      { name: 'Get found', intro: 'Every job starts with someone searching, or scrolling.', items: [
        'Your Facebook and Instagram ads, written, built and run for you. You set the budget',
        'A page for every service you do and every town you cover',
        'Your Google Business Profile set up, verified and worked on every month',
        'Your reviews shown on your site and on Google Maps'
      ] },
      { name: 'Turn enquiries into booked jobs', intro: 'An enquiry answered in a minute is a job. One answered tomorrow is someone else’s.', items: [
        'A quote request form with photos of the job, straight to your phone',
        'An email back to them the moment they ask, with what happens next',
        'A follow-up email if they go quiet, sent for you',
        'A booking with a deposit, taken on your site'
      ] },
      { name: 'Do the job', intro: 'The site keeps the paperwork out of the van.', items: [
        'Every customer’s details, photos and history in one place',
        'An email the day before, so nobody is out when you arrive',
        'Pay by card on your site, or a pay-a-link invoice',
        'A receipt sent for you'
      ] },
      { name: 'Get more from every customer', intro: 'The cheapest customer is the one you already have.', items: [
        'A Google review asked for the day after, automatically',
        'A referral link with something in it for both sides',
        'A reminder when the next service is due: boiler service, gutter clean, annual check',
        'An add-on offered at the right moment, and paid for on the site'
      ] }
    ],
    you: [
      'Send a photo, or a line about the job you want more of',
      'Set the ad budget, and change it whenever you like',
      'Answer the enquiries that come in',
      'Do the job'
    ],
    we: [
      'Design and build the site, live the day you join',
      'Write the offer, build the ad and the form, and run it',
      'Keep you ranking in your towns, every month',
      'Send the confirmations, reminders, review asks and referral offers',
      'Send you a note every month: what ran, what it cost, what came in'
    ],
    value: [
      ['Your website, designed, built and hosted', 'Found, trusted, and contacted in one tap', '&pound;1,500 to build, then &pound;20 a month'],
      ['Facebook and Instagram ads, run for you', 'New enquiries every week, on a budget you set', '&pound;500 a month at an agency'],
      ['Local SEO, worked on every month', 'Higher on Google and Maps in your towns, for good', '&pound;300 a month'],
      ['Quotes, bookings, deposits and payments', 'Jobs booked and paid without a phone call', '&pound;40 a month in apps'],
      ['Review and referral requests, automatic', 'More reviews, and customers who bring the next one', '&pound;50 a month'],
      ['Follow-up emails, written and sent for you', 'Nobody forgotten, nothing missed', '&pound;30 a month'],
      ['Business email at your own address', 'Looks like a business, not a hotmail', '&pound;12 a month'],
      ['A dashboard with every customer, job and payment', 'One place, not five apps', 'Included']
    ],
    valueTotal: 'Bought separately: about &pound;950 a month, plus a build fee. Trades Max: &pound;250 a month, no setup fee.',
    why: [
      ['One system, not five apps.', 'The ad, the form, the booking, the payment, the review ask and the follow-up all know about each other, because they are one site.'],
      ['Built for trades, then tested and repeated.', 'The same model runs for every trade on it. What works for one plumber is already in the next one’s site.'],
      ['The follow-up is what most trades never do.', 'Not because they do not care. Because they are on a roof. The site does it for you.'],
      ['You keep it all.', 'The site, the reviews, the ranking and the customer list are yours. Step down to Business any month and they stay.']
    ],
    faq: [
      ['How much should the ad budget be?', 'Your call, and you can change it any time. &pound;150 to &pound;300 for the first month is enough to learn what works. Below about &pound;10 a day there is not enough to learn from.'],
      ['Who pays Meta?', 'You do, directly, on your own ad account. I never hold or spend your advertising money. The &pound;250 is for the work.'],
      ['Will it definitely bring jobs?', 'No one honest can promise that. What I promise is the work: a proper offer, a proper ad, a page that converts, the follow-ups, and a note every month showing what it brought in, so you decide with numbers.'],
      ['What if I already have a website?', 'I build the new one, move your address across, and nothing goes offline in between. Your reviews and ranking come with you.'],
      ['Can I start smaller?', 'Yes. Starter is the site for &pound;25, Business adds bookings and payments for &pound;25 more. Move up to Trades Max any month, if there is a place.'],
      ['Why only ten businesses?', 'Because running ads properly takes attention every week. Ten is what I can do well. The first ten pay &pound;250 and keep that price.']
    ]
  },
  {
    slug: 'clubs',
    name: 'Clubs Max',
    tag: 'clubs',
    promise: 'New members every week. Trials, sign-ups and renewals, run for you.',
    desc: 'Clubs Max: a website, ads, local SEO, trial bookings, memberships, payments, reviews and referrals, built and run for dance schools, gyms, martial arts and sports clubs. £250 a month, no setup fee, you pay your own ad spend. See a real page for your club free within 24 hours.',
    who: 'Dance schools, gyms, martial arts, cheer, swim schools, sports clubs. [TODO: the club owner in a sentence: what they run, what they want more of, what they have no time for.]',
    stages: [
      { name: 'Get found', intro: 'Every new member starts with a parent, or a person, searching.', items: [
        'Your Facebook and Instagram ads, written, built and run for you. You set the budget',
        'A page for every class, age group and venue',
        'Your Google Business Profile set up, verified and worked on every month',
        '[TODO: the club-specific proof shown on the site: shows, grades, results]'
      ] },
      { name: 'Turn enquiries into booked trials', intro: 'A trial booked on the spot beats a form that waits for a reply.', items: [
        'A free trial booked on the site, into a real class with real spaces',
        'An email confirming it, with what to bring and where to park',
        'A reminder the day before, and a follow-up if they do not come',
        '[TODO: the club-specific first step: taster, induction, assessment]'
      ] },
      { name: 'Run the club', intro: 'The site keeps the admin out of the sports hall.', items: [
        'Membership paid monthly on the site, renewed automatically',
        'Every member’s classes, payments and forms in one place',
        'Registers and cancellations handled by the site',
        '[TODO: uniforms, grading fees, event tickets, sold on the site]'
      ] },
      { name: 'Get more from every member', intro: 'A happy member brings a friend, and stays another term.', items: [
        'A review asked for after the first month, automatically',
        'A refer-a-friend link with a reward for both',
        'A renewal email before the term ends',
        '[TODO: the club-specific upsell: extra class, competition squad, holiday camp]'
      ] }
    ],
    you: [
      'Send a photo, or a line about the class you want to fill',
      'Set the ad budget, and change it whenever you like',
      'Run the trials and the classes',
      '[TODO]'
    ],
    we: [
      'Design and build the site, live the day you join',
      'Write the offer, build the ad and the trial booking, and run it',
      'Keep you ranking in your area, every month',
      'Send the confirmations, reminders, renewals, review asks and referral offers',
      'Send you a note every month: what ran, what it cost, who joined'
    ],
    value: [
      ['Your website, designed, built and hosted', 'Found, trusted, and a trial booked in one tap', '&pound;1,500 to build, then &pound;20 a month'],
      ['Facebook and Instagram ads, run for you', 'New trials every week, on a budget you set', '&pound;500 a month at an agency'],
      ['Local SEO, worked on every month', 'Higher on Google and Maps for your area, for good', '&pound;300 a month'],
      ['Trial bookings, memberships and payments', 'Members signed up and paid without a form to chase', '&pound;60 a month in club software'],
      ['Review and referral requests, automatic', 'More reviews, and members who bring a friend', '&pound;50 a month'],
      ['Follow-up and renewal emails, sent for you', 'Nobody forgotten at the end of term', '&pound;30 a month'],
      ['Business email at your own address', 'Looks like a club, not a gmail', '&pound;12 a month'],
      ['A dashboard with every member, class and payment', 'One place, not five apps', 'Included']
    ],
    valueTotal: 'Bought separately: about &pound;970 a month, plus a build fee. Clubs Max: &pound;250 a month, no setup fee.',
    why: [
      ['One system, not five apps.', 'The ad, the trial booking, the membership, the payment and the renewal all know about each other, because they are one site.'],
      ['Built for clubs, then tested and repeated.', 'This is the model my own dance school runs on. [TODO: one line of its numbers.]'],
      ['The follow-up is what fills the class.', 'The trial that did not turn up, the member whose term is ending. The site chases both, politely, for you.'],
      ['You keep it all.', 'The site, the reviews, the ranking and the member list are yours. Step down to Business any month and they stay.']
    ],
    faq: [
      ['How much should the ad budget be?', 'Your call, and you can change it any time. &pound;150 to &pound;300 for the first month is enough to learn what works.'],
      ['Who pays Meta?', 'You do, directly, on your own ad account. I never hold or spend your advertising money. The &pound;250 is for the work.'],
      ['[TODO: club-specific question, e.g. Does it handle waivers and consent forms?]', '[TODO]'],
      ['Can I start smaller?', 'Yes. Starter is the site for &pound;25, Business adds bookings and payments for &pound;25 more. Move up to Clubs Max any month, if there is a place.'],
      ['Why only ten businesses?', 'Because running ads properly takes attention every week. Ten is what I can do well. The first ten pay &pound;250 and keep that price.']
    ]
  },
  {
    slug: 'salon',
    name: 'Salon Max',
    tag: 'salon',
    promise: 'A full book, fewer no-shows, and clients who come back on their own.',
    desc: 'Salon Max: a website, ads, local SEO, online booking with deposits, payments, reviews, rebooking and referrals, built and run for salons, barbers, nail techs and beauty rooms. £250 a month, no setup fee, you pay your own ad spend. See a real page for your salon free within 24 hours.',
    who: 'Hair salons, barbers, nail techs, lash and brow rooms, beauty clinics. [TODO: the owner in a sentence: what they do, what they want more of, what they have no time for.]',
    stages: [
      { name: 'Get found', intro: 'Every new client starts with a search, or a photo they saw.', items: [
        'Your Facebook and Instagram ads, written, built and run for you. You set the budget',
        'A page for every service, with your prices and your work',
        'Your Google Business Profile set up, verified and worked on every month',
        '[TODO: the salon-specific proof shown on the site: before and afters, the team]'
      ] },
      { name: 'Turn enquiries into bookings', intro: 'The client who can book at eleven at night, does.', items: [
        'Online booking with a deposit, into your real diary',
        'An email confirming it, with the address and what to expect',
        'A reminder the day before, which is what stops no-shows',
        '[TODO: the salon-specific first step: consultation, patch test]'
      ] },
      { name: 'Do the appointment', intro: 'The site keeps the admin off the front desk.', items: [
        'Every client’s history, photos and notes in one place',
        'Pay by card on the site, or a pay-a-link for the balance',
        'Gift vouchers sold online, redeemed in the chair',
        '[TODO: retail products sold on the site]'
      ] },
      { name: 'Get more from every client', intro: 'The best client is the one who rebooks before she leaves.', items: [
        'A rebooking email at the right interval for the service',
        'A Google review asked for the day after, automatically',
        'A refer-a-friend link with a reward for both',
        '[TODO: the salon-specific add-on offered at booking: treatment, upgrade]'
      ] }
    ],
    you: [
      'Send a photo of your work, or a line about the service you want more of',
      'Set the ad budget, and change it whenever you like',
      'Do the appointments',
      '[TODO]'
    ],
    we: [
      'Design and build the site, live the day you join',
      'Write the offer, build the ad and the booking, and run it',
      'Keep you ranking in your town, every month',
      'Send the confirmations, reminders, rebooking nudges, review asks and referral offers',
      'Send you a note every month: what ran, what it cost, who booked'
    ],
    value: [
      ['Your website, designed, built and hosted', 'Found, trusted, and booked in one tap', '&pound;1,500 to build, then &pound;20 a month'],
      ['Facebook and Instagram ads, run for you', 'New clients every week, on a budget you set', '&pound;500 a month at an agency'],
      ['Local SEO, worked on every month', 'Higher on Google and Maps in your town, for good', '&pound;300 a month'],
      ['Online booking, deposits and payments', 'A full book, fewer no-shows, no booking app taking a cut', '&pound;40 a month in apps'],
      ['Review, rebooking and referral emails, automatic', 'More reviews, and clients who come back on their own', '&pound;50 a month'],
      ['Gift vouchers and products, sold online', 'Money in while the chair is empty', '&pound;30 a month'],
      ['Business email at your own address', 'Looks like a salon, not a gmail', '&pound;12 a month'],
      ['A dashboard with every client, appointment and payment', 'One place, not five apps', 'Included']
    ],
    valueTotal: 'Bought separately: about &pound;950 a month, plus a build fee. Salon Max: &pound;250 a month, no setup fee.',
    why: [
      ['One system, not five apps.', 'The ad, the booking, the deposit, the reminder, the review ask and the rebooking nudge all know about each other, because they are one site.'],
      ['Built for salons, then tested and repeated.', '[TODO: one line on the first salon on it and what changed.]'],
      ['The rebooking email is the money.', 'A client reminded at six weeks rebooks. One who is not, drifts. The site remembers so you do not have to.'],
      ['You keep it all.', 'The site, the reviews, the ranking and the client list are yours. Step down to Business any month and they stay.']
    ],
    faq: [
      ['How much should the ad budget be?', 'Your call, and you can change it any time. &pound;150 to &pound;300 for the first month is enough to learn what works.'],
      ['Who pays Meta?', 'You do, directly, on your own ad account. I never hold or spend your advertising money. The &pound;250 is for the work.'],
      ['[TODO: salon-specific question, e.g. Can each stylist have their own diary?]', '[TODO]'],
      ['Can I start smaller?', 'Yes. Starter is the site for &pound;25, Business adds bookings and payments for &pound;25 more. Move up to Salon Max any month, if there is a place.'],
      ['Why only ten businesses?', 'Because running ads properly takes attention every week. Ten is what I can do well. The first ten pay &pound;250 and keep that price.']
    ]
  }
];

module.exports.AD_SPEND = AD_SPEND;
