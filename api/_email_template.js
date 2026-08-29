/* The "one." branded shell every customer-facing email is built from.
 *
 * Inline styles only, table-based layout - external stylesheets and most
 * modern CSS are unreliable across mail clients (Outlook desktop especially),
 * so everything that matters is repeated per element rather than relying on
 * a <style> block. Matches styles.css: same font stack, same ink/grey tokens,
 * same pill-shaped button as .btn-primary, same "one." wordmark as .logo.
 *
 * html() always needs a plain-text sibling from the caller - sendEmail()
 * sends both, since some clients and spam filters expect a text part to
 * exist even when html is present.
 */

const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif";
const INK = '#1d1d1f';
const INK_2 = '#6e6e73';
const INK_3 = '#86868b';
const BG = '#f5f5f7';
const LINE = '#e8e8ed';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* lines are raw HTML, not escaped here - callers interpolating a dynamic
 * value (a business name, a domain) must esc() that value themselves first,
 * same rule as every other bit of user-supplied text rendered anywhere on
 * the site. A line written entirely by us can use tags like <strong> freely.
 */
function html({ heading, lines = [], ctaText, ctaHref, footer }) {
  const body = lines
    .map((line) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${INK_2};font-family:${FONT};">${line}</p>`)
    .join('');

  const cta = ctaText && ctaHref ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 4px;">
          <tr><td style="border-radius:980px;background:${INK};">
            <a href="${esc(ctaHref)}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:980px;font-family:${FONT};">${esc(ctaText)}</a>
          </td></tr>
        </table>` : '';

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title></title></head>
<body style="margin:0;padding:0;background:${BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:20px;">
        <tr><td style="padding:36px 40px 4px;">
          <div style="font-size:24px;font-weight:700;letter-spacing:-.045em;color:${INK};font-family:${FONT};">one.</div>
        </td></tr>
        <tr><td style="padding:20px 40px 4px;">
          <h1 style="margin:0 0 18px;font-size:22px;font-weight:600;letter-spacing:-.02em;color:${INK};font-family:${FONT};">${esc(heading)}</h1>
          ${body}${cta}
        </td></tr>
        <tr><td style="padding:28px 40px 36px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${LINE};">
            <tr><td style="padding-top:20px;font-size:12.5px;line-height:1.5;color:${INK_3};font-family:${FONT};">${footer || 'one, by Kanvas'}</td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { html, esc };
