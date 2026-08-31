/* Web address suggestions and availability, for the get-started wizard.
 *
 * Availability comes from RDAP, the registries' own lookup protocol: a 404 for
 * a domain means nobody has registered it, a 200 means somebody has. No API key
 * and no registrar account needed.
 *
 * The important rule here is that anything other than a clear 404 or 200 is
 * reported as "unknown", never as available. Telling someone a name is free and
 * then failing to buy it is a much worse outcome than saying we will check.
 */
const TLDS = ['co.uk', 'com', 'uk'];

/* Registries that RDAP's own bootstrap does not cover, or covers badly. */
const RDAP_HOSTS = {
  'co.uk': 'https://rdap.nominet.uk/uk/domain/',
  'uk':    'https://rdap.nominet.uk/uk/domain/'
};
const RDAP_DEFAULT = 'https://rdap.org/domain/';

const LOOKUP_BUDGET = 8;      // outbound lookups per request, hard cap
const TIMEOUT_MS = 4000;

/* "Copper & Crumb" -> "copperandcrumb". Registrable labels are a-z, 0-9 and
   hyphens, so everything else either maps to a word or goes. */
function slug(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // cafe, not caf
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function isValidDomain(d) {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,63})+$/.test(d) && d.length <= 253;
}

/* Candidate labels, best first: the name itself, then hyphenated, then the
   usual small-business variations. */
function candidates(name, type) {
  const words = slug(name);
  if (!words.length) return [];
  const joined = words.join('');
  const hyphen = words.join('-');
  const trade = slug(type)[0] || '';

  const labels = [joined];
  if (hyphen !== joined) labels.push(hyphen);
  if (trade && !joined.includes(trade)) labels.push(joined + trade);
  labels.push(joined + 'uk', 'the' + joined);

  const out = [];
  for (const tld of TLDS) {
    for (const label of labels) {
      if (label.length >= 3 && label.length <= 63) out.push(label + '.' + tld);
    }
  }
  // Dedupe, keeping order.
  return out.filter((d, i) => out.indexOf(d) === i);
}

/* taken | free | unknown. Never guesses. */
async function lookup(domain) {
  const tld = TLDS.find(t => domain.endsWith('.' + t));
  const base = (tld && RDAP_HOSTS[tld]) || RDAP_DEFAULT;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(base + encodeURIComponent(domain), {
      headers: { Accept: 'application/rdap+json' },
      redirect: 'follow',
      signal: ctrl.signal
    });
    if (res.status === 404) return 'free';
    if (res.status === 200) return 'taken';
    return 'unknown';
  } catch (err) {
    return 'unknown';
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  /* The badge on a free example runs on whatever host that example is on, so
     the availability check has to be reachable from another origin. This
     endpoint has no session, reads nothing private and already answers anyone
     who can send it a POST - CORS only decides whether a browser will show
     them the answer, so opening it costs nothing that was not already open. */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || '');

    if (action === 'check') {
      const domain = String(body.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!isValidDomain(domain)) {
        return res.status(400).json({ error: 'That does not look like a web address.' });
      }
      return res.status(200).json({ domain, state: await lookup(domain) });
    }

    if (action === 'suggest') {
      const list = candidates(body.business, body.business_type).slice(0, LOOKUP_BUDGET);
      if (!list.length) return res.status(200).json({ suggestions: [] });

      // Checked in parallel, then reported in candidate order so the best name
      // is still first.
      const states = await Promise.all(list.map(lookup));
      const free = list.filter((d, i) => states[i] === 'free').slice(0, 3);

      /* If the lookups could not reach a registry, say so rather than showing
         an empty list that reads as "nothing is available". */
      const reachable = states.some(s => s !== 'unknown');
      return res.status(200).json({
        suggestions: free,
        checked: list.length,
        reachable
      });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('domains:', err && err.message);
    return res.status(500).json({ error: 'Could not check just now.' });
  }
};

module.exports.candidates = candidates;
module.exports.slug = slug;
module.exports.isValidDomain = isValidDomain;
/* api/admin.js re-checks a domain when it sends somebody their example, so
   the email can say whether it is still free rather than assume it. */
module.exports.lookup = lookup;
