/* The build checklist, per plan: what "done" means for a customer's site,
 * and on One their app and their ads too.
 *
 * Each job is a list of headings, each heading a list of [key, words].
 * The key is what's stored when a step is ticked (build_steps.step), so
 * the words can change freely; a key must never be reused for a different
 * step. Add a step anywhere: every customer's progress counts it from then
 * on. The One site steps follow the new-club checklist in the Academy repo
 * (docs/new-club.md).
 */
(function () {
  var START = { title: 'Before you start', steps: [
    ['read', 'Read what they sent (their link, photos, words)'],
    ['domain', 'Web address registered, or theirs pointed here']
  ] };
  var LIVE = { title: 'Go live', steps: [
    ['phone', 'Every page checked on a phone'],
    ['live', 'Marked live here, with the address'],
    ['live_email', '"You’re live" email sent']
  ] };

  var STARTER = [START,
    { title: 'Website', steps: [
      ['home', 'Homepage, from their page'],
      ['services', 'Services, menu or prices'],
      ['contact', 'Contact form, sending to their email'],
      ['call', 'Click to call and their address or area']
    ] },
    LIVE];

  var BUSINESS = [START,
    { title: 'Website', steps: [
      ['home', 'Homepage, from their page'],
      ['services', 'Services, menu or prices'],
      ['contact', 'Contact form, sending to their email'],
      ['call', 'Click to call and their address or area']
    ] },
    { title: 'Their features', steps: [
      ['feature_1', 'First feature built and tested'],
      ['feature_2', 'Second feature built and tested'],
      ['feature_3', 'Third feature built and tested'],
      ['stripe', 'Their Stripe connected, if they take payments'],
      ['test_payment', 'Test payment made and refunded'],
      ['email_domain', 'Emails send from their own address']
    ] },
    LIVE];

  /* One for clubs: the Academy copied and made theirs. */
  var ONE_SITE = [
    { title: 'Before you start', steps: [
      ['setup_read', 'Setup form answers read'],
      ['setup_gaps', 'Anything blank or "not sure" asked about'],
      ['repo', 'New repo copied from the base'],
      ['club_json', 'club.json filled in']
    ] },
    { title: 'Pages', steps: [
      ['home', 'Homepage'],
      ['about', 'About'],
      ['classes', 'Classes and timetable'],
      ['prices', 'Membership and prices'],
      ['trial', 'Trial booking'],
      ['contact', 'Contact'],
      ['faq', 'FAQ']
    ] },
    { title: 'Shop and events', steps: [
      ['store', 'Shop products, or hidden if they have none'],
      ['events', 'Events, shows and tickets, or hidden']
    ] },
    { title: 'Members and coaches', steps: [
      ['coaches', 'Coaches added and their logins sent'],
      ['registers', 'Registers and QR check-in tested'],
      ['members', 'Members moved across']
    ] },
    { title: 'Terms, privacy and cookies', steps: [
      ['terms', 'Terms and membership terms in their name'],
      ['privacy', 'Privacy policy in their name'],
      ['cookies', 'Cookie policy']
    ] },
    { title: 'Their accounts', steps: [
      ['supabase', 'Database project, schema run'],
      ['stripe', 'Stripe set-up link sent, card payments on'],
      ['stripe_plans', 'Plans made in their Stripe, Connect webhook added'],
      ['email_domain', 'Email domain verified'],
      ['twilio', 'Texting number and its webhooks'],
      ['vercel', 'Hosting project, settings and web address']
    ] },
    { title: 'Tracking', steps: [
      ['pixel', 'Meta pixel on the site']
    ] },
    { title: 'Go live', steps: [
      ['check_club', 'npm run check:club -- --live passes'],
      ['handover', 'Before-handover tests done (trial, join, cancel, push)'],
      ['live', 'Marked live here, with the address'],
      ['live_email', '"You’re live" email sent']
    ] }
  ];

  var ONE_APP = [
    { title: 'Their accounts', steps: [
      ['apple_account', 'Apple developer account ready (D-U-N-S done), Kane invited'],
      ['google_account', 'Google Play account ready, Kane invited']
    ] },
    { title: 'Build', steps: [
      ['eas', 'App project created for them'],
      ['identity', 'Name, IDs and colours in the app settings'],
      ['icons', 'Icon and splash screen'],
      ['listing', 'Store listings: screenshots, text, privacy answers'],
      ['reviewer', 'Reviewer login set up']
    ] },
    { title: 'Submit', steps: [
      ['ios_submitted', 'Sent to Apple'],
      ['android_submitted', 'Sent to Google']
    ] },
    { title: 'Approved', steps: [
      ['ios_live', 'Live on the App Store'],
      ['android_live', 'Live on Google Play'],
      ['store_links', 'Store links added to their site']
    ] }
  ];

  var ONE_ADS = [
    { title: 'Set up', steps: [
      ['page_access', 'Access to their Facebook page'],
      ['ad_account', 'Ad account ready'],
      ['pixel_events', 'Pixel sees trial bookings']
    ] },
    { title: 'Run', steps: [
      ['adverts', 'Adverts made'],
      ['live', 'Campaign live (month 2)'],
      ['month_2', 'Month 2 checked: spend and trials'],
      ['month_3', 'Month 3 checked'],
      ['month_4', 'Month 4 checked: 10-Trial Promise met?']
    ] }
  ];

  function count(groups) { return groups.reduce(function (n, g) { return n + g.steps.length; }, 0); }

  /* The checklists a plan has, in the order they show. */
  function jobsFor(plan) {
    if (plan === 'max') {
      return [
        { job: 'site', title: 'Website', groups: ONE_SITE },
        { job: 'app', title: 'App', groups: ONE_APP },
        { job: 'ads', title: 'Ads', groups: ONE_ADS }
      ];
    }
    return [{ job: 'site', title: 'Website', groups: plan === 'starter' ? STARTER : BUSINESS }];
  }

  window.BUILD_STEPS = {
    jobsFor: jobsFor,
    job: function (plan, job) { return jobsFor(plan).filter(function (j) { return j.job === job; })[0] || null; },
    total: function (plan, job) { var j = this.job(plan, job); return j ? count(j.groups) : 0; },
    /* Only keys still on the list count, so a removed step can't push
       progress over the total. */
    keys: function (plan, job) {
      var j = this.job(plan, job), out = [];
      if (j) j.groups.forEach(function (g) { g.steps.forEach(function (s) { out.push(s[0]); }); });
      return out;
    }
  };
})();
