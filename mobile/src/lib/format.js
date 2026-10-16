/* Times, names and numbers, worded the way the web app words them
   (app/app.js and requests.js), so a screen reads the same in both. */

export function ago(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 86400 * 7) return Math.floor(s / 86400) + 'd';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* "5m ago", "2d ago" or "on 14 Oct": ago() read as a sentence. */
export function since(iso) {
  const a = ago(iso);
  return a === 'now' ? 'just now' : /^\d+[mhd]$/.test(a) ? a + ' ago' : 'on ' + a;
}

/* "2 hours ago", for a customer's thread. */
export function agoLong(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
  const h = Math.floor(m / 60);
  if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
  const days = Math.floor(h / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return days + ' days ago';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: days > 330 ? 'numeric' : undefined });
}

export function clock(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/* A list row's time, mail-app style: 14:05, Yesterday, Mon, 14 Oct. */
export function shortWhen(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.floor((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (days <= 0) return clock(iso);
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: days > 330 ? 'numeric' : undefined });
}

export function fullDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function whenVisit(iso) {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return clock(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + clock(iso);
}

export function secsText(n) { return n < 60 ? n + 's' : Math.floor(n / 60) + 'm ' + (n % 60) + 's'; }
export function minutesText(a, b) {
  const m = Math.round((new Date(b) - new Date(a)) / 60000);
  return m < 1 ? 'under a minute' : m === 1 ? '1 min' : m < 60 ? m + ' mins' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
}

export function fmt(n) { return Number(n || 0).toLocaleString('en-GB'); }
export function pct(part, whole) { return whole ? (part / whole < 0.01 && part ? '<1' : Math.round((part / whole) * 100)) + '%' : '0%'; }

/* Money as a person says it: £1,240, or £12.50 when the pence matter. */
export function pounds(pence, currency) {
  const sym = { gbp: '£', usd: '$', eur: '€' }[String(currency || 'gbp').toLowerCase()] || '';
  const n = Number(pence || 0) / 100;
  const dp = n < 100 && n % 1 ? 2 : 0;
  return sym + n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/* Up, down or the same, against the period before. */
export function delta(now, before) {
  if (!before && !now) return { text: '', dir: '' };
  if (!before) return { text: 'new', dir: 'up' };
  const p = Math.round(((now - before) / before) * 100);
  if (p === 0) return { text: 'same as before', dir: '' };
  return { text: (p > 0 ? '+' : '') + p + '%', dir: p > 0 ? 'up' : 'down' };
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

/* A page path as a person would say it: / is the homepage. */
export function pageName(path) {
  const p = String(path || '').split(/[?#]/)[0].replace(/\/+$/, '');
  if (!p || p === '/index.html' || p === '/index') return 'Homepage';
  let last = p.split('/').filter(Boolean).pop() || '';
  last = last.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ').trim();
  if (/^\/examples\/[^/]/.test(p) && last) return 'Example: ' + last.charAt(0).toUpperCase() + last.slice(1);
  return last ? last.charAt(0).toUpperCase() + last.slice(1) : 'Homepage';
}

/* An anonymous visitor's steady number, from their conversation id. */
export function visitorNo(id) { return String(parseInt(String(id || '').replace(/-/g, '').slice(-6), 16) % 9000 + 1000); }
export function sessionNo(s) { let n = 0; String(s || '').split('').forEach((ch) => { n = (n * 31 + ch.charCodeAt(0)) % 9000; }); return String(1000 + n); }
export function displayName(c) {
  if (c.name) return c.name;
  if (c.channel && c.channel !== 'web' && c.phone) return c.phone;
  return 'Visitor #' + visitorNo(c.id);
}

let regionNames = null;
try { regionNames = new Intl.DisplayNames(['en-GB'], { type: 'region' }); } catch (e) { regionNames = null; }
export function countryName(code) { try { return (regionNames && regionNames.of(code)) || code; } catch (e) { return code; } }

export function telHref(phone) { return 'tel:' + String(phone || '').replace(/[^\d+]/g, ''); }
