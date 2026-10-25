/* Who is signed in and what they have: the login, the /api/app "me"
 * payload (their plan, their sites, what is unread), the site the tabs are
 * about, and the counts on the tabs. Every screen reads it through
 * useApp(). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../lib/supabase';
import { api } from '../lib/api';
import { setBadge } from '../lib/phone';

const Ctx = createContext(null);
export function useApp() { return useContext(Ctx); }

export function AppProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined: not known yet
  const [me, setMe] = useState(null);
  const [siteId, setSiteId] = useState(null);
  const [bootError, setBootError] = useState(null);
  const [counts, setCountsState] = useState({ chat: 0, build: 0, messages: 0, money: 0 });
  const [logoVersion, setLogoVersion] = useState(0); // a new logo at the same path: load it afresh
  const meRef = useRef(null);

  useEffect(() => {
    let live = true;
    db.auth.getSession().then(({ data }) => { if (live) setSession(data.session || null); });
    const { data: sub } = db.auth.onAuthStateChange((_event, s) => { setSession(s || null); });
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, []);

  const loadMe = useCallback(async () => {
    setBootError(null);
    try {
      const m = await api({ action: 'me' });
      meRef.current = m;
      setMe(m);
      setSiteId((cur) => (cur && (m.sites || []).some((x) => x.site_id === cur) ? cur : (m.sites && m.sites[0] ? m.sites[0].site_id : null)));
      setBadge((m.unread && m.unread.notifications) || 0);
      return m;
    } catch (err) {
      if (!err.loggedOut) setBootError(err.message);
      return null;
    }
  }, []);

  const userId = session && session.user ? session.user.id : null;
  useEffect(() => {
    if (userId) loadMe();
    else { setMe(null); meRef.current = null; setSiteId(null); }
  }, [userId, loadMe]);

  /* The badges, without a reload. */
  const refreshMe = useCallback(async () => {
    if (!meRef.current) return;
    try {
      const fresh = await api({ action: 'me' });
      const m = Object.assign({}, meRef.current, { unread: fresh.unread, sites: fresh.sites || meRef.current.sites });
      meRef.current = m;
      setMe(m);
      setBadge((fresh.unread && fresh.unread.notifications) || 0);
    } catch (e) { /* the next one will do */ }
  }, []);

  const setCounts = useCallback((part) => setCountsState((c) => {
    const n = Object.assign({}, c, part);
    return Object.keys(n).some((k) => n[k] !== c[k]) ? n : c;
  }), []);

  const value = useMemo(() => {
    const user = me && me.user;
    const sites = (me && me.sites) || [];
    const site = sites.filter((x) => x.site_id === siteId)[0] || sites[0] || null;
    const isAdmin = !!(user && user.is_admin);
    const isStarter = !!(user && !user.is_admin && user.plan === 'starter');
    /* One, while Kane builds their club's site and app: this app is just
       the line to him, so it is Support and nothing else. */
    const isOneClient = !!(user && !user.is_admin && user.plan === 'max');
    const hasChat = !!(site && (site.modules || []).indexOf('chat') >= 0);
    const contactsAllowed = !!site && site.plan !== 'Starter';
    return {
      session, me, user, sites, site, isAdmin, isStarter, isOneClient, hasChat, contactsAllowed,
      bootError, counts, setCounts, loadMe, refreshMe, logoVersion,
      bumpLogo: () => setLogoVersion(Date.now()),
      /* The profile changed here (name or logo): show it without a reload. */
      patchUser: (part) => setMe((m) => { if (!m) return m; const n = Object.assign({}, m, { user: Object.assign({}, m.user, part) }); meRef.current = n; return n; }),
      selectSite: (id) => setSiteId(id),
      logOut: async () => { try { await db.auth.signOut({ scope: 'local' }); } catch (e) { /* cleared regardless */ } }
    };
  }, [session, me, siteId, bootError, counts, setCounts, loadMe, refreshMe, logoVersion]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
