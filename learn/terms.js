/* Business words, explained: the terms the Learning Centre teaches.
 *
 * One list, used twice. On the guide pages glossary.js picks it up
 * (window.GL_EXTRA) and gives each word a dotted underline with this
 * explanation. learn/build.js reads the same list for the "Business word"
 * boxes inside the guides and for /learn/club-business-words. Keys before
 * their shorter cousins (good friction before friction) so the longer
 * phrase wins.
 */
(function (root) {
  var TERMS = {
    churn: { match: /\bchurn\b/i, title: 'Churn',
      text: 'How many members leave over a period, usually counted each month. If 3 of your 60 members leave in a month, your churn is 5%. The lower it is, the less hard you have to work just to stay full.' },
    involuntary: { match: /\binvoluntary churn\b/i, title: 'Involuntary churn',
      text: 'Members you lose because a payment failed, not because they wanted to leave. An expired card that nobody chases quietly becomes a lost member.' },
    retention: { match: /\bretention\b/i, title: 'Retention',
      text: 'The opposite of churn: how many of your members stay. Keeping a member is far cheaper than finding a new one, so small improvements here are worth a lot.' },
    lifetimevalue: { match: /\blifetime value\b/i, title: 'Lifetime value',
      text: 'What one member is worth over the whole time they stay. At £50 a month, that’s £600 a year, and a child who stays two years is worth £1,200. It’s why keeping members matters so much.' },
    goodfriction: { match: /\bgood friction\b/i, title: 'Good friction',
      text: 'A step you add on purpose because it helps. Asking why they want to join, or having them pick a date, means the families who book are serious, so more of them turn up.' },
    badfriction: { match: /\bbad friction\b/i, title: 'Bad friction',
      text: 'A step that doesn’t need to be there and turns families away: having to email to ask, a long form, waiting for a reply, or a booking page that doesn’t work on a phone.' },
    friction: { match: /\bfriction\b/i, title: 'Friction',
      text: 'Anything that stands between a parent and the next step, like booking a trial or joining. Every question, form and wait is friction. Some of it helps, most of it loses you families.' },
    conversion: { match: /\bconversion rate\b/i, title: 'Conversion rate',
      text: 'Out of the people who take one step, how many take the next. If 10 children come to a trial and 6 join, your trial-to-member conversion rate is 60%.' },
    showup: { match: /\bshow-up rate\b/i, title: 'Show-up rate',
      text: 'How many of the families who book actually turn up. If 22 book a trial and 15 come, your show-up rate is 68%.' },
    noshow: { match: /\bno-shows?\b/i, title: 'No-show',
      text: 'Someone who booked and didn’t come, without letting you know. Every club gets them. Reminders, and making families feel expected, cut them down.' },
    capacity: { match: /\bcapacity\b|\b\d{2,3}% full\b/i, title: 'Capacity',
      text: 'How many spaces you have in total, across every class. Six classes of 15 is a capacity of 90. “80% full” means 72 of those spaces are taken.' },
    breakeven: { match: /\bbreak[- ]even\b/i, title: 'Break-even',
      text: 'The point where the money coming in covers every cost, so you’re no longer losing money. Every member above it is profit.' },
    revenue: { match: /\brevenue\b/i, title: 'Revenue',
      text: 'All the money coming in, before any costs come off. Not the same as profit: a club with high revenue and high costs can still struggle.' },
    profit: { limit: 2, match: /\bprofits?\b/i, title: 'Profit',
      text: 'What’s left of your revenue once every cost is paid: the hall, coaches, kit and software. It’s the number that pays you.' },
    perceivedrisk: { match: /\bperceived risk\b/i, title: 'Perceived risk',
      text: 'How risky a decision feels to the person making it: the money, the time, an upset child, the awkwardness of leaving. The lower it feels, the more people say yes. A free trial makes it close to nothing.' },
    dreamoutcome: { match: /\bdream outcome\b/i, title: 'Dream outcome',
      text: 'What a parent really wants for their child from your classes: more confidence, new friends, a new skill, getting on a stage. It’s what they’re actually buying, so it’s worth knowing for every family.' },
    valueequation: { match: /\bvalue equation\b/i, title: 'The value equation',
      text: 'A simple way to think about how much something is worth to a parent, made popular by the business author Alex Hormozi. Value goes up with the dream outcome and how sure they are they’ll get it, and down with how long it takes and how much effort and risk it involves.' },
    cac: { match: /\bCAC\b|\bcustomer acquisition cost\b/i, title: 'CAC: customer acquisition cost',
      text: 'What it costs you to win one new member: ads, trials, your time and any offers, added up and divided by the members they brought. A sibling who joins costs you almost nothing to win.' },
    referral: { match: /\breferrals?\b/i, title: 'Referral',
      text: 'A new family who came because an existing one recommended you. Referrals tend to join more readily and stay longer, because they arrive already trusting you.' },
    upsell: { match: /\bupsells?\b/i, title: 'Upsell',
      text: 'Offering an existing member something more, like a second class, at the moment it would genuinely help them. It grows your income without having to find a new family.' },
    costper: { match: /\bcost per (?:trial|lead|enquiry|booking|member|customer|result)\b/i, title: 'Cost per trial',
      text: 'What you spent on ads divided by the number of bookings they brought. If £100 of ads brings 10 trials, that’s £10 per trial. It’s the number that tells you whether the ads are worth it.' }
  };
  if (typeof module === 'object' && module.exports) module.exports = TERMS;
  else root.GL_EXTRA = TERMS;
})(this);
