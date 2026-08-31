/* Regenerates the two Supabase Auth templates from the shared shell.
 *
 * These are the only emails this app does not send itself - Supabase Auth
 * does, from templates pasted into its dashboard - so they cannot import the
 * shell at runtime the way api/ does. Generating them here keeps them in step
 * with every other email instead of drifting the moment the shell changes.
 *
 *   node email-templates/build.js
 *
 * Then paste the output files into the Supabase dashboard by hand; nothing
 * in this repo deploys them.
 */
const fs = require('fs');
const path = require('path');
const { html, standardFooter } = require('../api/_email_template.js');

const SITE = 'https://kanvas.one';
const out = path.join(__dirname);

/* Supabase substitutes these itself when it sends - they must survive into
   the output untouched, which is why nothing here escapes them. */
const CONFIRM_URL = '{{ .ConfirmationURL }}';

const files = {
  'confirm-signup.html': html({
    preheader: 'Confirm your email address to finish setting up your account.',
    heading: 'Welcome to one 👋',
    lines: [
      'You&rsquo;re one click away. Confirm your email address and your account is ready to go.',
      'Once you&rsquo;re in you can choose a plan, tell us about your business, and we&rsquo;ll start building.'
    ],
    ctaText: 'Confirm your email',
    ctaHref: CONFIRM_URL,
    ctaNote: 'This link expires in 24 hours.',
    footer: 'You&rsquo;re getting this because someone signed up to Kanvas (one.) with this '
          + 'address. If it wasn&rsquo;t you, ignore this email &mdash; no account is created '
          + 'until the link above is clicked.',
    footerLinks: standardFooter(SITE)
  }),

  'reset-password.html': html({
    preheader: 'Choose a new password for your account.',
    heading: 'Reset your password',
    lines: [
      'Click below to choose a new password for your one account.'
    ],
    ctaText: 'Choose a new password',
    ctaHref: CONFIRM_URL,
    ctaNote: 'This link expires in 24 hours.',
    callout: {
      text: 'If you didn&rsquo;t ask for this, you can ignore this email &mdash; your password '
          + 'won&rsquo;t change unless you click through and set a new one.'
    },
    footer: 'You&rsquo;re getting this because a password reset was requested for this address.',
    footerLinks: standardFooter(SITE)
  })
};

for (const [name, body] of Object.entries(files)) {
  fs.writeFileSync(path.join(out, name), body);
  console.log('wrote', name, body.length + ' bytes');
}
