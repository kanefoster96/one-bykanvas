/* Bundles the app for the native wrapper.
 *
 * The web app at /app/ leans on files one level up (the Supabase client,
 * session helpers, the request catalogue, styles.css). Capacitor wants a
 * self-contained folder, so this copies everything the app needs into
 * app-dist/ with the ../ paths rewritten to ./. Run before `npx cap sync`.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'app-dist');
const SHARED = ['vendor/supabase.js', 'supabase-config.js', 'supabase-client.js', 'session.js', 'request-catalogue.js', 'requests-badge.js', 'requests.js', 'styles.css', 'assets/favicon.svg'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'vendor'), { recursive: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });

SHARED.forEach((f) => fs.copyFileSync(path.join(root, f), path.join(out, f)));
['app.css', 'app.js'].forEach((f) => fs.copyFileSync(path.join(__dirname, f), path.join(out, f)));

let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/"\.\.\//g, '"./');
fs.writeFileSync(path.join(out, 'index.html'), html);

/* Inside the wrapper the app fetches requests.js from the bundle, not
   from kanvas.one, so it cannot go stale against the API it ships with. */
let js = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8')
  .replace("var base = native ? BASE + '/' : '../';", "var base = './';");
fs.writeFileSync(path.join(out, 'app.js'), js);

console.log('app-dist ready: ' + fs.readdirSync(out).length + ' entries');
