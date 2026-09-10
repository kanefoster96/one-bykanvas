/* The "your site is live" email, shared by the admin page and the MCP
 * server so marking a site live from either sends the same message. */
const { ourSiteUrl } = require('./_env.js');
const { sendEmail } = require('./_email.js');
const { html: emailHtml, standardFooter } = require('./_email_template.js');

/* The moment a build actually finishes - the one email in this whole system
 * a customer has been waiting the longest for. */
async function notifySiteLive(db, userId, businessName, siteUrl) {
  const { data: who } = await db.auth.admin.getUserById(userId);
  const customerEmail = who && who.user && who.user.email;
  if (!customerEmail) return;

  const href = /^https?:\/\//i.test(siteUrl) ? siteUrl : 'https://' + siteUrl;
  const shown = href.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const site = ourSiteUrl();

  const result = await sendEmail({
    to: customerEmail,
    subject: 'Your site is live',
    text: `${businessName || 'Your site'} is live at ${shown}.\n\n`
        + `Have a look, and let us know if there's anything you'd like changed.\n\n`
        + `One favour: know another business that could use a site like yours? `
        + `Your referral code is on your account page - give it to them, and when `
        + `their site goes live your next month is free.\n\n`
        + (process.env.REVIEW_URL
            ? `And if you've got 60 seconds, a review helps us more than you'd think: ${process.env.REVIEW_URL}\n\n`
            : '')
        + `Manage your account: ${site}/account.html`,
    html: emailHtml({
      /* heading is escaped inside the shell, so the raw name goes in here -
         escaping it twice turned an ampersand into &amp;amp; on the page. */
      preheader: `${shown} is live. Have a look and tell us what you think.`,
      heading: `${businessName || 'Your site'} is live 🎉`,
      lines: [
        `It&rsquo;s built, it&rsquo;s online, and it&rsquo;s yours.`,
        `Have a look through, and let us know if there&rsquo;s anything you&rsquo;d like changed &mdash; that&rsquo;s what your monthly changes are for.`,
        /* The referral ask lands at the happiest moment there is. Honoured
           by hand: a month's credit on both accounts in Stripe. */
        `One favour: know another business that could use a site like yours? `
          + `Your referral code is on <a href="${site}/account.html">your account page</a> &mdash; `
          + `give it to them, and when their site goes live your <strong>next month is free</strong>.`
      ].concat(process.env.REVIEW_URL
        ? [`And if you&rsquo;ve got 60 seconds, `
           + `<a href="${process.env.REVIEW_URL}">a quick review</a> helps us more than you&rsquo;d think.`]
        : []),
      details: [
        { label: 'Business', value: businessName || '—' },
        { label: 'Web address', value: shown },
        { label: 'Status', value: 'Live' }
      ],
      ctaText: 'View your site',
      ctaHref: href,
      ctaNote: 'Ask for a change any time from your account.',
      footer: 'You&rsquo;re getting this because your site with Kanvas One has gone live.',
      footerLinks: standardFooter(site)
    })
  });
  console.log('admin: site live email', result);
}

module.exports = { notifySiteLive };
