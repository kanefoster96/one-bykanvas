/* The "one." branded shell every customer-facing email is built from.
 *
 * Inline styles only, table-based layout - external stylesheets and most
 * modern CSS are unreliable across mail clients (Outlook desktop especially),
 * so everything that matters is repeated per element rather than relying on
 * a <style> block. Matches styles.css: same font stack, same ink/grey tokens,
 * same full-width pill button as .btn, same "one." mark as assets/favicon.svg.
 *
 * html() always needs a plain-text sibling from the caller - sendEmail()
 * sends both, since some clients and spam filters expect a text part to
 * exist even when html is present.
 */

const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";
const INK = '#1d1d1f';
const INK_2 = '#6e6e73';
const INK_3 = '#86868b';
const BG = '#f5f5f7';
const SUNK = '#fafafa';
const LINE = '#e8e8ed';
const WARN_BG = '#fdf6e9';
const WARN_LINE = '#f0e2c4';
const WARN_INK = '#8a5a17';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* The mark from assets/favicon.svg, rebuilt in table cells - an <img> would
   need hosting somewhere reachable and is blocked by default in most clients
   until the reader asks for images, which would leave the email headless. */
function brand() {
  /* The full stop is a drawn circle, not a typed period. SF renders a round
     one, but Helvetica and Arial - what a Windows client falls back to -
     render a square, and the mark on the site is round. A cell with a 50%
     radius is round everywhere except Outlook desktop, which ignores the
     radius and lands on the square it would have drawn anyway. */
  const dot = `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
                 <tr><td width="4" height="4" style="width:4px;height:4px;font-size:0;line-height:4px;background:#ffffff;border-radius:50%;">&nbsp;</td></tr>
               </table>`;

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="40" height="40" align="center" valign="middle" style="width:40px;height:40px;background:${INK};border-radius:11px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                  <tr>
                    <td valign="bottom" style="font-size:15.5px;font-weight:600;letter-spacing:-.045em;color:#ffffff;font-family:${FONT};line-height:20px;">one</td>
                    <td valign="bottom" style="padding:0 0 4px 2px;line-height:0;">${dot}</td>
                  </tr>
                </table>
              </td>
              <td style="padding-left:11px;font-size:16px;font-weight:600;letter-spacing:-.015em;color:${INK};font-family:${FONT};">by Kanvas</td>
            </tr>
          </table>`;
}

/* Label on the left, value on the right - the facts of the email pulled out
   of the prose so they can be checked at a glance. Values are set in mono
   because they are nearly always data: a plan name, a date, an amount, a
   web address. */
function detailCard(details) {
  const rows = details.map((d, i) => {
    const top = i === 0 ? '' : `border-top:1px solid ${LINE};`;
    return `<tr>
      <td style="${top}padding:13px 0;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${INK_3};font-family:${FONT};" align="left" valign="top">${esc(d.label)}</td>
      <td style="${top}padding:13px 0;font-size:13.5px;color:${INK};font-family:${MONO};" align="right" valign="top">${esc(d.value)}</td>
    </tr>`;
  }).join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px;background:${SUNK};border:1px solid ${LINE};border-radius:14px;">
            <tr><td style="padding:4px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
            </td></tr>
          </table>`;
}

/* The line that needs to survive being skimmed - a payment that failed, a
   plan about to end. Deliberately the only colour in the whole shell. */
function calloutBox(callout) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 2px;background:${WARN_BG};border:1px solid ${WARN_LINE};border-radius:12px;">
            <tr>
              <td width="22" valign="top" style="padding:15px 0 15px 16px;font-size:15px;line-height:1.5;color:${WARN_INK};font-family:${FONT};">&#9888;</td>
              <td valign="top" style="padding:15px 18px 15px 9px;font-size:14px;line-height:1.55;color:${WARN_INK};font-family:${FONT};">${callout.text}</td>
            </tr>
          </table>`;
}

/* lines and callout.text are raw HTML, not escaped here - callers
 * interpolating a dynamic value (a business name, a domain) must esc() that
 * value themselves first, same rule as every other bit of user-supplied text
 * rendered anywhere on the site. heading, details and the footer links are
 * escaped here, so callers pass those in raw.
 */
function html({
  preheader, heading, lines = [], details = [],
  ctaText, ctaHref, ctaNote, callout, footer, footerLinks = []
}) {
  /* What the inbox list shows beside the subject. Without it the client
     picks the first text it finds, which is the wordmark. */
  const preview = preheader ? `
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${esc(preheader)}${'&#8203;&nbsp;'.repeat(60)}</div>` : '';

  const body = lines
    .map((line) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${INK_2};font-family:${FONT};">${line}</p>`)
    .join('');

  const facts = details.length ? detailCard(details) : '';

  /* Full width, the way a primary action is set on a phone - the same pill
     radius as .btn on the site. */
  const cta = ctaText && ctaHref ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;">
          <tr><td align="center" style="border-radius:980px;background:${INK};">
            <a href="${esc(ctaHref)}" style="display:block;padding:15px 24px;font-size:15.5px;font-weight:600;color:#ffffff;text-decoration:none;text-align:center;font-family:${FONT};">${esc(ctaText)}</a>
          </td></tr>
        </table>` : '';

  const note = ctaNote ? `
        <p style="margin:12px 0 0;font-size:13px;line-height:1.5;text-align:center;color:${INK_3};font-family:${FONT};">${ctaNote}</p>` : '';

  const warn = callout ? calloutBox(callout) : '';

  const links = footerLinks.length ? `
            <tr><td style="padding-top:10px;font-size:12.5px;line-height:1.6;color:${INK_3};font-family:${FONT};">${
              footerLinks.map((l) => `<a href="${esc(l.href)}" style="color:${INK_3};text-decoration:underline;">${esc(l.text)}</a>`).join(`<span style="color:${LINE};"> &nbsp;&bull;&nbsp; </span>`)
            }</td></tr>` : '';

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title></title></head>
<body style="margin:0;padding:0;background:${BG};">${preview}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:20px;">
        <tr><td style="padding:32px 36px 0;">
          ${brand()}
        </td></tr>
        <tr><td style="padding:26px 36px 0;">
          <h1 style="margin:0 0 16px;font-size:25px;font-weight:600;letter-spacing:-.025em;line-height:1.2;color:${INK};font-family:${FONT};">${esc(heading)}</h1>
          ${body}${facts}${cta}${note}${warn}
        </td></tr>
        <tr><td style="padding:30px 36px 34px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${LINE};">
            <tr><td style="padding-top:20px;font-size:12.5px;line-height:1.55;color:${INK_3};font-family:${FONT};">${footer || 'one, by Kanvas'}</td></tr>${links}
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* The same three links under every customer email - where to manage things,
   where to read how it works, and a real person to reply to. Only pages that
   actually exist; a dead link in a footer reads worse than no footer. */
function standardFooter(site) {
  return [
    { text: 'Your account', href: `${site}/account.html` },
    { text: 'How it works', href: `${site}/how-it-works.html` },
    { text: 'Email us', href: `mailto:${process.env.REPLY_TO_EMAIL || 'kane@kanvas.one'}` }
  ];
}

module.exports = { html, esc, standardFooter };
