/* Copies the build checklists (build-steps.js) and the feature catalogue
 * (request-catalogue.js) from the website into the app, so the two never
 * disagree about what a step or a feature is called.
 *
 *   node scripts/sync-shared.js        (from mobile/)
 *
 * Run it after changing either file; `npm run sync` does the same.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['build-steps.js', 'request-catalogue.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });

const plans = ['starter', 'business', 'pro', 'max'];
const jobs = {};
plans.forEach((p) => { jobs[p] = ctx.window.BUILD_STEPS.jobsFor(p); });
const out = '/* Made by scripts/sync-shared.js from build-steps.js and request-catalogue.js.\n   Do not edit by hand: change those files and run `npm run sync`. */\n'
  + 'export const JOBS = ' + JSON.stringify(jobs, null, 1) + ';\n'
  + 'export const CATALOGUE = ' + JSON.stringify(ctx.window.REQUEST_CATALOGUE, null, 1) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'lib', 'shared.generated.js'), out);
console.log('Wrote src/lib/shared.generated.js');
