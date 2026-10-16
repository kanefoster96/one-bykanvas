/* A customer's requests, read with their own login (row level security
   shows them only theirs, and none of Kane's private notes), written
   through /api/requests, which also moves the status and sends the email.
   The same reads requests.js makes on the website. */
import { db } from './supabase';

export const LABEL = { new: 'Sent', accepted: 'Sent', waiting: 'Needs your reply', in_progress: 'In progress', done: 'Done', declined: 'Cancelled' };
export const TAG = { waiting: 'reply', in_progress: 'building', done: 'done', declined: 'cancelled' };
export const KIND = { edit: 'Change', feature: 'Feature', info: 'Details' };
export function isDone(r) { return r.status === 'done' || r.status === 'declined'; }
export function unread(r) { return r.last_note_by === 'admin' && (!r.customer_seen_at || new Date(r.customer_seen_at) < new Date(r.last_note_at)); }

export async function loadRequests() {
  const q = await db.from('requests')
    .select('id, kind, title, detail, status, created_at, done_at, last_note_at, last_note_by, customer_seen_at')
    .order('last_note_at', { ascending: false, nullsFirst: false })
    .limit(200);
  if (q.error) throw q.error;
  const list = (q.data || []).map((r) => Object.assign({}, r, {
    title: r.title || String(r.detail || '').split('\n')[0].slice(0, 120),
    last_note_at: r.last_note_at || r.created_at,
    last_note_by: r.last_note_by || 'customer'
  }));
  const latest = {};
  if (list.length) {
    const n = await db.from('request_notes').select('request_id, author, body, created_at')
      .in('request_id', list.map((r) => r.id)).order('created_at', { ascending: false }).limit(600);
    ((!n.error && n.data) || []).forEach((note) => { if (!latest[note.request_id]) latest[note.request_id] = note; });
  }
  return { list, latest };
}

export async function loadRequest(id) {
  const one = await db.from('requests').select('*').eq('id', id).maybeSingle();
  if (one.error) throw one.error;
  if (!one.data) return null;
  const q = await db.from('request_notes').select('id, author, body, attachment_paths, created_at')
    .eq('request_id', id).order('created_at', { ascending: true }).limit(500);
  return { request: one.data, notes: (!q.error && q.data) || [] };
}

export async function markSeen(id) {
  const now = new Date().toISOString();
  await db.from('requests').update({ customer_seen_at: now }).eq('id', id);
  return now;
}

export async function myPlan(userId) {
  const p = await db.from('profiles').select('active_plan').eq('id', userId).maybeSingle();
  return (p.data && p.data.active_plan) || null;
}
