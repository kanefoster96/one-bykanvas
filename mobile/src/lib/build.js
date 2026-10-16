/* The build board's rules, the same as the admin page's (admin.js) and
   the web app's Build tab: what counts as open, late, and how far along. */
import { JOBS } from './shared.generated';

export const PLAN_WORD = { starter: 'Starter', business: 'Business', pro: 'Pro', max: 'One' };
export const JOB_WORD = { site: 'Website', app: 'App', ads: 'Ads' };

export function jobsFor(plan) { return JOBS[plan] || JOBS.business; }
export function keysFor(plan, job) {
  const j = jobsFor(plan).filter((x) => x.job === job)[0];
  const out = [];
  if (j) j.groups.forEach((g) => g.steps.forEach((s) => out.push(s[0])));
  return out;
}

/* ticks: { [userId]: { [job]: { [step]: true } } } */
export function progressOf(ticks, p, job) {
  const keys = keysFor(p.active_plan, job);
  const t = (ticks[p.id] && ticks[p.id][job]) || {};
  return { done: keys.filter((k) => t[k]).length, total: keys.length };
}

/* The site until it is live; on One the app until every step is ticked. */
export function openJobsOf(ticks, p) {
  const out = [];
  if (p.site_status === 'building') out.push('site');
  if (p.active_plan === 'max') { const a = progressOf(ticks, p, 'app'); if (a.total && a.done < a.total) out.push('app'); }
  return out;
}

export function promiseOf(p) { return { starter: '24 hours', max: '8 weeks' }[p.active_plan] || '14 days'; }
export function lateOf(p) {
  const h = (Date.now() - new Date(p.created_at).getTime()) / 36e5;
  return p.site_status === 'building' && h >= ({ starter: 24, business: 14 * 24, max: 56 * 24 }[p.active_plan] || 14 * 24);
}

export function ticksFrom(steps) {
  const t = {};
  (steps || []).forEach((x) => { setTick(t, x.user_id, x.job, x.step, true); });
  return t;
}
export function setTick(t, uid, job, step, on) {
  const u = t[uid] || (t[uid] = {});
  const j = u[job] || (u[job] = {});
  if (on) j[step] = true; else delete j[step];
  return t;
}

/* Requests, the admin's side. */
export const STATUS_WORD = { new: 'New', waiting: 'Waiting on them', in_progress: 'In progress', done: 'Done', declined: 'Cancelled' };
export const STATUS_TAG = { waiting: 'plain', in_progress: 'building', done: 'done', declined: 'cancelled' };
export const KIND_WORD = { edit: 'Change', feature: 'Feature', info: 'Details' };
export function isClosed(r) { return r.status === 'done' || r.status === 'declined'; }
export function needsMe(r) { return r.last_note_by === 'customer' && !isClosed(r); }
export function sentLine(r) {
  const d = new Date(r.created_at);
  return (KIND_WORD[r.kind] || 'Request') + ' · Sent ' + (isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    + ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
}
