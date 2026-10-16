/* The live chat inbox, shared by the Chat tab, a thread and the "on your
 * site now" sheet. New messages arrive two ways, as on the web app:
 * Supabase Realtime on the site's messages while the app is open, and a
 * slow poll regardless (realtime rows are read under the owner's own
 * login, so the admin looking at a customer's site leans on the poll).
 */
import { useEffect, useState } from 'react';
import { db } from '../lib/supabase';
import { api } from '../lib/api';
import { bus } from '../lib/bus';

let store = { siteId: null, convs: [], visitorsNow: [], loaded: false, error: '' };
const subs = new Set();
function set(part) { store = Object.assign({}, store, part); subs.forEach((fn) => fn(store)); }

export function useChats() {
  const [st, setSt] = useState(store);
  useEffect(() => { subs.add(setSt); setSt(store); return () => subs.delete(setSt); }, []);
  return st;
}

export async function loadChats(siteId) {
  if (!siteId) return;
  if (store.siteId !== siteId) set({ siteId, convs: [], visitorsNow: [], loaded: false, error: '' });
  try {
    const res = await api({ action: 'chat_list', site_id: siteId });
    if (store.siteId !== siteId) return;
    const convs = res.conversations || [];
    const visitorsNow = res.visitors_now || [];
    // Someone whose visit the counter still sees is here, widget open or not.
    const sessions = {};
    visitorsNow.forEach((v) => { sessions[v.session] = v; });
    convs.forEach((c) => { if (c.session && sessions[c.session]) { c.online = true; c.now_path = sessions[c.session].path; } });
    set({ convs, visitorsNow, loaded: true, error: '' });
  } catch (e) { set({ loaded: true, error: e.message }); }
}

export function markRead(id) {
  set({ convs: store.convs.map((c) => (c.id === id ? Object.assign({}, c, { unread: false }) : c)) });
}

/* Everyone on the site now: the visitor counter, plus anyone with the
   chat open who the counter missed. */
export function hereNow(st) {
  const seen = {};
  const out = [];
  st.visitorsNow.forEach((v) => { seen[v.session] = true; out.push(v); });
  st.convs.forEach((c) => {
    if (c.online && c.status !== 'closed' && !c.blocked && !(c.session && seen[c.session])) out.push({ session: c.session, conversation_id: c.id, name: c.name, path: c.page, last_at: c.last_at, conv: c });
  });
  return out;
}

let channel = null;
let liveTimer = null;
export function startLive(siteId) {
  stopLive();
  if (!siteId) return;
  const refresh = () => { clearTimeout(liveTimer); liveTimer = setTimeout(() => loadChats(siteId), 1200); };
  try {
    channel = db.channel('site-live-' + siteId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'site_id=eq.' + siteId }, (payload) => {
        if (payload && payload.new) bus.emit('chat:message', payload.new);
        refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: 'site_id=eq.' + siteId }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'page_views', filter: 'site_id=eq.' + siteId }, refresh)
      .subscribe();
  } catch (e) { channel = null; }
}
export function stopLive() {
  clearTimeout(liveTimer);
  if (channel) { try { db.removeChannel(channel); } catch (e) { /* gone */ } channel = null; }
}
