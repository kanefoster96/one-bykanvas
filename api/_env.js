/* Which of these environment variables are missing.
 *
 * Names only, and only ever to the server log: a customer gets a plain "not
 * configured" message, because the list of what a server is missing is not
 * theirs to see. Without this, a misconfigured deployment says only that
 * something is wrong, and finding out which of five names it is means guessing.
 */
function missingEnv(names) {
  return names.filter(function (n) {
    var v = process.env[n];
    return !v || !String(v).trim();
  });
}

/* Where OUR deployment lives, for links in emails and Stripe's return URLs.
 *
 * Named for whose site it is: admin.js uses `siteUrl` for the customer's own
 * website, and a plain `siteUrl` here shadowed it inside notifySiteLive.
 *
 * Every caller builds `${ourSiteUrl()}/account.html`, so a SITE_URL saved with a
 * trailing slash - which is how a browser shows a domain, and so how it gets
 * pasted - would produce a double slash in every link we send. Trimmed here
 * once rather than at seven call sites.
 *
 * The fallback is the custom domain, not the .vercel.app one: that address
 * sits behind Vercel Authentication, so falling back to it would send
 * customers to a login wall they cannot get through.
 */
function ourSiteUrl() {
  const raw = String(process.env.SITE_URL || '').trim();
  return (raw || 'https://kanvas.one').replace(/\/+$/, '');
}

module.exports = { missingEnv, ourSiteUrl };
