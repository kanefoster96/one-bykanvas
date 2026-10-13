/* The two files that let a kanvas.one/app link open the Kanvas One app
 * instead of the browser:
 *
 *   /.well-known/apple-app-site-association   (iOS universal links)
 *   /.well-known/assetlinks.json              (Android app links)
 *
 * Served from here, not as static files, because each needs an identifier
 * we only know once the accounts exist: APPLE_TEAM_ID (developer.apple.com
 * -> Membership details, 10 characters) and ANDROID_CERT_SHA256 (the app
 * signing key's SHA-256, from `eas credentials` or Play Console -> App
 * integrity). Until a value is set, that platform's file answers with an
 * empty list, which phones read as "no app" and keep opening the browser.
 * Rewritten here by vercel.json; ?file=apple or ?file=android.
 */
const BUNDLE = 'one.kanvas.app';

module.exports = function handler(req, res) {
  const file = String((req.query && req.query.file) || '');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (file === 'apple') {
    const team = String(process.env.APPLE_TEAM_ID || '').trim();
    const details = team ? [{ appIDs: [team + '.' + BUNDLE], components: [{ '/': '/app*', comment: 'The Kanvas One app' }] }] : [];
    return res.status(200).send(JSON.stringify({ applinks: { details } }));
  }
  if (file === 'android') {
    const prints = String(process.env.ANDROID_CERT_SHA256 || '').split(',').map((s) => s.trim()).filter(Boolean);
    const out = prints.length ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: BUNDLE, sha256_cert_fingerprints: prints } }] : [];
    return res.status(200).send(JSON.stringify(out));
  }
  return res.status(404).json({ error: 'Not found' });
};
