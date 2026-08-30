/* Turning optional email off, from a link in an email.
 *
 * GET never changes anything. That is not politeness: mail providers follow
 * links in messages they are filtering, and a GET that unsubscribed would let
 * a spam scanner quietly opt a customer out of email they wanted. The same
 * behaviour already spent one of this site's signup confirmation tokens before
 * the customer could click it. So GET shows a page with a button, and POST -
 * which is also what RFC 8058 one-click sends - does the work.
 */
const { createClient } = require('@supabase/supabase-js');
const { missingEnv } = require('./_env.js');
const { readToken } = require('./_unsubscribe.js');

const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif";

function page({ heading, body, form, token, marketing }) {
  return `<!doctype html>
<html lang="en-GB">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Email settings — one</title><meta name="robots" content="noindex"></head>
<body style="margin:0;background:#f5f5f7;font-family:${FONT};">
  <div style="max-width:460px;margin:0 auto;padding:64px 20px;">
    <div style="background:#fff;border-radius:20px;padding:34px 32px;">
      <div style="font-size:22px;font-weight:600;letter-spacing:-.045em;color:#1d1d1f;">one.</div>
      <h1 style="margin:22px 0 12px;font-size:23px;font-weight:600;letter-spacing:-.02em;color:#1d1d1f;">${heading}</h1>
      <p style="margin:0 0 8px;font-size:16px;line-height:1.55;color:#6e6e73;">${body}</p>
      ${form ? `<form method="POST" action="/api/unsubscribe" style="margin-top:26px;">
        <input type="hidden" name="u" value="${token}">
        <button type="submit" style="width:100%;padding:15px 24px;border:0;border-radius:980px;background:#1d1d1f;color:#fff;font-family:inherit;font-size:15.5px;font-weight:600;cursor:pointer;">Turn these emails off</button>
      </form>` : ''}
      <p style="margin:26px 0 0;font-size:13.5px;line-height:1.55;color:#86868b;">
        ${marketing
          ? 'This only covers marketing. Anything about your plan, a payment or '
            + 'your own website still comes through, because that is your account.'
          : 'This only covers optional updates about your site. Anything about your '
            + 'plan or a payment still comes through, because it is about your account.'}
      </p>
    </div>
    <p style="text-align:center;margin:18px 0 0;font-size:13px;color:#86868b;">
      <a href="/account.html" style="color:#86868b;">Your account</a>
    </p>
  </div>
</body>
</html>`;
}

function html(res, code, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(code).end(body);
}

/* One-click posts application/x-www-form-urlencoded; the page's own form does
   too. Vercel may hand either a parsed object or a raw string. */
function fieldFrom(req, name) {
  const q = req.query && req.query[name];
  if (q) return Array.isArray(q) ? q[0] : q;

  const b = req.body;
  if (!b) return '';
  if (typeof b === 'object' && b[name]) return String(b[name]);
  if (typeof b === 'string') {
    const found = new URLSearchParams(b).get(name);
    if (found) return found;
  }
  return '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end('Method not allowed');
  }

  const token = fieldFrom(req, 'u');
  const claim = readToken(token);

  if (!claim) {
    return html(res, 400, page({
      heading: 'That link has expired',
      body: 'We could not tell whose settings this is for. You can turn these '
          + 'emails off from your account instead, or just reply and ask us.'
    }));
  }

  const marketing = claim.scope === 'marketing';

  if (req.method === 'GET') {
    return html(res, 200, page({
      heading: marketing ? 'Turn off these emails?' : 'Turn off site updates?',
      body: marketing
        ? 'You will stop getting tips, offers and news about what we have added.'
        : 'You will stop getting emails telling you when something new has '
        + 'been added or improved on your site.',
      form: true,
      marketing: marketing,
      token: String(token).replace(/"/g, '&quot;')
    }));
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('unsubscribe: missing environment variables:',
      missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']).join(', ') || '(none named)');
    return html(res, 500, page({
      heading: 'Something went wrong',
      body: 'We could not save that just now. Please reply to the email and we '
          + 'will sort it by hand.'
    }));
  }

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    /* marketing_optin is a yes and notify_optout is a no, so which value
       means "stop" depends on which of the two this link is for. */
    const patch = {};
    patch[claim.column] = !marketing;

    const { error } = await db.from('profiles').update(patch).eq('id', claim.userId);
    if (error) throw new Error(error.message);

    console.log('unsubscribe: %s opted out of %s', claim.userId, claim.scope);
    return html(res, 200, page({
      heading: 'Done',
      body: marketing
        ? 'You will not get marketing emails from us again. Anything about your '
        + 'plan or your site still comes through.'
        : 'You will not get site update emails from us again. Turn them back '
        + 'on any time from your account.'
    }));
  } catch (err) {
    console.error('unsubscribe failed:', err && err.message);
    /* A one-click client shows an error on a non-2xx, and the reader can do
       nothing about it. Say what happened and let them reply to a human. */
    return html(res, 500, page({
      heading: 'Something went wrong',
      body: 'We could not save that just now. Please reply to the email and we '
          + 'will sort it by hand.'
    }));
  }
};
