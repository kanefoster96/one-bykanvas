/* A tiny signal board: "something changed, look again". A notification
   arriving or the app coming back to the front says 'refresh'; screens on
   show listen and reload what they show. */
const subs = {};
export const bus = {
  on(name, fn) { (subs[name] = subs[name] || new Set()).add(fn); return () => subs[name].delete(fn); },
  emit(name, data) { (subs[name] || []).forEach((fn) => { try { fn(data); } catch (e) { /* one listener's trouble is its own */ } }); }
};
