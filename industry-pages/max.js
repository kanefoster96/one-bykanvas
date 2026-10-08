/* The Max models: one per business type, each an end-to-end system that is
 * built, tested and repeated for that type. Built by build.js into
 * /max/<slug>.html. Same price whatever the type; the customer pays their
 * own ad spend on top.
 *
 * Trades is the first and the fullest. Clubs and Salon carry the same
 * structure; each carries its own examples.
 *
 * Fields:
 *   slug, name           /max/<slug>, "Trades Max"
 *   icon                 the mark in the app-style icon at the top: SVG paths, 24-box, stroked
 *   promise              the one-line promise under the name
 *   desc                 meta description, from the promise
 *   who                  who it is for, one paragraph
 *   stages               four: { name, intro (italic), items }
 *   you / we             the two columns of what each side does
 *   value                rows of [what you get, what it does for you]
 *   why                  four [bold lead, sentence] pairs
 *   faq                  [question, answer] pairs; also structured data
 */
const AD_SPEND = 'You pay your own ad spend on top, straight to Meta. &pound;150 to &pound;300 for the first month is enough to learn what works.';

module.exports = [
  {
    slug: 'trades',
    icon: '<path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>',
    name: 'Trades Max',
    promise: 'Your phone rings with jobs. The rest is done for you.',
    desc: 'Trades Max: a website, ads, local SEO, quotes, bookings, payments, reviews and referrals, built and run for plumbers, electricians, roofers and builders. £249 a month, no setup fee, you pay your own ad spend. Live within 24 hours of joining.',
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
      ['Your website, designed, built and hosted', 'Found, trusted, and contacted in one tap'],
      ['Facebook and Instagram ads, run for you', 'New enquiries every week, on a budget you set'],
      ['Local SEO, worked on every month', 'Higher on Google and Maps in your towns, for good'],
      ['Quotes, bookings, deposits and payments', 'Jobs booked and paid without a phone call'],
      ['Review and referral requests, automatic', 'More reviews, and customers who bring the next one'],
      ['Follow-up emails, written and sent for you', 'Nobody forgotten, nothing missed'],
      ['Business email at your own address', 'Looks like a business, not a hotmail'],
      ['A dashboard with every customer, job and payment', 'One place, not five apps']
    ],
    why: [
      ['One system, not five apps.', 'The ad, the form, the booking, the payment, the review ask and the follow-up all know about each other, because they are one site.'],
      ['Built for trades, then tested and repeated.', 'The same model runs for every trade on it. What works for one plumber is already in the next one’s site.'],
      ['The follow-up is what most trades never do.', 'Not because they do not care. Because they are on a roof. The site does it for you.'],
      ['You keep it all.', 'The site, the reviews, the ranking and the customer list are yours. Step down to Business any month and they stay.']
    ],
    faq: [
      ['How much should the ad budget be?', 'Your call, and you can change it any time. &pound;150 to &pound;300 for the first month is enough to learn what works. Below about &pound;10 a day there is not enough to learn from.'],
      ['Who pays Meta?', 'You do, directly, on your own ad account. We never hold or spend your advertising money. The &pound;249 is for the work.'],
      ['Will it definitely bring jobs?', 'No one honest can promise that. What we promise is the work: a proper offer, a proper ad, a page that converts, the follow-ups, and a note every month showing what it brought in, so you decide with numbers.'],
      ['What if I already have a website?', 'We build the new one, move your address across, and nothing goes offline in between. Your reviews and ranking come with you.'],
      ['Can I start smaller?', 'Yes. Starter is the site for &pound;9.99 a month, Business adds bookings and payments for &pound;49. Move up to Trades Max any month.']
    ]
  },
  {
    slug: 'clubs',
    icon: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    name: 'Clubs Max',
    promise: 'New members every week. Trials, sign-ups and renewals, run for you.',
    desc: 'Clubs Max: a website, ads, local SEO, trial bookings, memberships, payments, reviews and referrals, built and run for dance schools, gyms, martial arts and sports clubs. £249 a month, no setup fee, you pay your own ad spend. Live within 24 hours of joining.',
    who: 'Dance schools, gyms, martial arts, cheer, swim schools, sports clubs. You run the classes and the shows; you want every class full and every term renewed; you have no evenings left for the admin.',
    stages: [
      { name: 'Get found', intro: 'Every new member starts with a parent, or a person, searching.', items: [
        'Your Facebook and Instagram ads, written, built and run for you. You set the budget',
        'A page for every class, age group and venue',
        'Your Google Business Profile set up, verified and worked on every month',
        'Your shows, grades, results and photos on the site, where a parent looks before they book'
      ] },
      { name: 'Turn enquiries into booked trials', intro: 'A trial booked on the spot beats a form that waits for a reply.', items: [
        'A free trial booked on the site, into a real class with real spaces',
        'An email confirming it, with what to bring and where to park',
        'A reminder the day before, and a follow-up if they do not come',
        'A taster, an induction or an assessment as the first step, whichever your club runs'
      ] },
      { name: 'Run the club', intro: 'The site keeps the admin out of the sports hall.', items: [
        'Membership paid monthly on the site, renewed automatically',
        'Every member’s classes, payments and forms in one place',
        'Registers and cancellations handled by the site',
        'Uniforms, grading fees and show tickets sold on the site, paid before the day'
      ] },
      { name: 'Get more from every member', intro: 'A happy member brings a friend, and stays another term.', items: [
        'A review asked for after the first month, automatically',
        'A refer-a-friend link with a reward for both',
        'A renewal email before the term ends',
        'A second class, the competition squad or the holiday camp, offered to the members already with you'
      ] }
    ],
    you: [
      'Send a photo, or a line about the class you want to fill',
      'Set the ad budget, and change it whenever you like',
      'Run the trials and the classes',
      'Tell us when a term, a show or a camp is coming, and we sell it'
    ],
    we: [
      'Design and build the site, live the day you join',
      'Write the offer, build the ad and the trial booking, and run it',
      'Keep you ranking in your area, every month',
      'Send the confirmations, reminders, renewals, review asks and referral offers',
      'Send you a note every month: what ran, what it cost, who joined'
    ],
    value: [
      ['Your website, designed, built and hosted', 'Found, trusted, and a trial booked in one tap'],
      ['Facebook and Instagram ads, run for you', 'New trials every week, on a budget you set'],
      ['Local SEO, worked on every month', 'Higher on Google and Maps for your area, for good'],
      ['Trial bookings, memberships and payments', 'Members signed up and paid without a form to chase'],
      ['Review and referral requests, automatic', 'More reviews, and members who bring a friend'],
      ['Follow-up and renewal emails, sent for you', 'Nobody forgotten at the end of term'],
      ['Business email at your own address', 'Looks like a club, not a gmail'],
      ['A dashboard with every member, class and payment', 'One place, not five apps']
    ],
    why: [
      ['One system, not five apps.', 'The ad, the trial booking, the membership, the payment and the renewal all know about each other, because they are one site.'],
      ['Built for clubs, then tested and repeated.', 'This is the model our own dance school runs on: trials booked on the site, memberships renewed on their own, and a waiting list for the popular classes.'],
      ['The follow-up is what fills the class.', 'The trial that did not turn up, the member whose term is ending. The site chases both, politely, for you.'],
      ['You keep it all.', 'The site, the reviews, the ranking and the member list are yours. Step down to Business any month and they stay.']
    ],
    faq: [
      ['How much should the ad budget be?', 'Your call, and you can change it any time. &pound;150 to &pound;300 for the first month is enough to learn what works.'],
      ['Who pays Meta?', 'You do, directly, on your own ad account. We never hold or spend your advertising money. The &pound;249 is for the work.'],
      ['Does it handle consent forms and medical details?', 'Yes. They are filled in when a parent books the trial, kept against the member, and there for the coach on the register. Nothing on paper.'],
      ['Can I start smaller?', 'Yes. Starter is the site for &pound;9.99 a month, Business adds bookings and payments for &pound;49. Move up to Clubs Max any month.']
    ]
  },
  {
    slug: 'salon',
    icon: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88"/><path d="M14.47 14.48 20 20"/><path d="M8.12 8.12 12 12"/>',
    name: 'Salon Max',
    promise: 'A full book, fewer no-shows, and clients who come back on their own.',
    desc: 'Salon Max: a website, ads, local SEO, online booking with deposits, payments, reviews, rebooking and referrals, built and run for salons, barbers, nail techs and beauty rooms. £249 a month, no setup fee, you pay your own ad spend. Live within 24 hours of joining.',
    who: 'Hair salons, barbers, nail techs, lash and brow rooms, beauty clinics. You do the work and the client comes back for you; you want a full book and fewer gaps; you have no time to chase the ones who drift.',
    stages: [
      { name: 'Get found', intro: 'Every new client starts with a search, or a photo they saw.', items: [
        'Your Facebook and Instagram ads, written, built and run for you. You set the budget',
        'A page for every service, with your prices and your work',
        'Your Google Business Profile set up, verified and worked on every month',
        'Your before and afters and your team on the site, where a client looks before they book'
      ] },
      { name: 'Turn enquiries into bookings', intro: 'The client who can book at eleven at night, does.', items: [
        'Online booking with a deposit, into your real diary',
        'An email confirming it, with the address and what to expect',
        'A reminder the day before, which is what stops no-shows',
        'A consultation or a patch test booked as the first step, where the service needs one'
      ] },
      { name: 'Do the appointment', intro: 'The site keeps the admin off the front desk.', items: [
        'Every client’s history, photos and notes in one place',
        'Pay by card on the site, or a pay-a-link for the balance',
        'Gift vouchers sold online, redeemed in the chair',
        'The products you use, sold on the site for collection or delivery'
      ] },
      { name: 'Get more from every client', intro: 'The best client is the one who rebooks before she leaves.', items: [
        'A rebooking email at the right interval for the service',
        'A Google review asked for the day after, automatically',
        'A refer-a-friend link with a reward for both',
        'A treatment or an upgrade offered at booking, when they are already saying yes'
      ] }
    ],
    you: [
      'Send a photo of your work, or a line about the service you want more of',
      'Set the ad budget, and change it whenever you like',
      'Do the appointments',
      'Tell us about a new service, an offer or a quiet week, and we fill it'
    ],
    we: [
      'Design and build the site, live the day you join',
      'Write the offer, build the ad and the booking, and run it',
      'Keep you ranking in your town, every month',
      'Send the confirmations, reminders, rebooking nudges, review asks and referral offers',
      'Send you a note every month: what ran, what it cost, who booked'
    ],
    value: [
      ['Your website, designed, built and hosted', 'Found, trusted, and booked in one tap'],
      ['Facebook and Instagram ads, run for you', 'New clients every week, on a budget you set'],
      ['Local SEO, worked on every month', 'Higher on Google and Maps in your town, for good'],
      ['Online booking, deposits and payments', 'A full book, fewer no-shows, no booking app taking a cut'],
      ['Review, rebooking and referral emails, automatic', 'More reviews, and clients who come back on their own'],
      ['Gift vouchers and products, sold online', 'Money in while the chair is empty'],
      ['Business email at your own address', 'Looks like a salon, not a gmail'],
      ['A dashboard with every client, appointment and payment', 'One place, not five apps']
    ],
    why: [
      ['One system, not five apps.', 'The ad, the booking, the deposit, the reminder, the review ask and the rebooking nudge all know about each other, because they are one site.'],
      ['Built for salons, then tested and repeated.', 'The booking, the deposit and the reminder are the same three things every salon needs, so they are built once and tuned to yours: your services, your intervals, your team.'],
      ['The rebooking email is the money.', 'A client reminded at six weeks rebooks. One who is not, drifts. The site remembers so you do not have to.'],
      ['You keep it all.', 'The site, the reviews, the ranking and the client list are yours. Step down to Business any month and they stay.']
    ],
    faq: [
      ['How much should the ad budget be?', 'Your call, and you can change it any time. &pound;150 to &pound;300 for the first month is enough to learn what works.'],
      ['Who pays Meta?', 'You do, directly, on your own ad account. We never hold or spend your advertising money. The &pound;249 is for the work.'],
      ['Can each stylist have their own diary?', 'Yes. Clients book a person or the first free chair, each stylist sees their own day, and a stylist who leaves takes nothing with them.'],
      ['Can I start smaller?', 'Yes. Starter is the site for &pound;9.99 a month, Business adds bookings and payments for &pound;49. Move up to Salon Max any month.']
    ]
  }
];

module.exports.AD_SPEND = AD_SPEND;
