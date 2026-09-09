/* The chat icon in the account nav, and the number on it.
 *
 * Counts requests where the newest note is ours and the customer has not
 * opened the thread since - the same idea as the bell, but per thread
 * rather than per notification. Row level security scopes the query to
 * their own requests; the comparison between two columns is done here
 * because PostgREST cannot do it in the filter.
 *
 * Exposed as window.ONE.refreshRequestBadge so the requests page can
 * recount after a thread is opened. */
(function () {
  if (!window.ONE || !ONE.ready) return;

  async function refresh() {
    var icon = document.getElementById('navReq');
    var badge = document.getElementById('navReqCount');
    if (!icon) return;
    try {
      var res = await ONE.db.auth.getSession();
      if (!res.data.session) return;
      icon.hidden = false;
      var q = await ONE.db.from('requests')
        .select('id, last_note_at, customer_seen_at')
        .eq('last_note_by', 'admin')
        .limit(200);
      var n = ((!q.error && q.data) || []).filter(function (r) {
        return !r.customer_seen_at || new Date(r.customer_seen_at) < new Date(r.last_note_at);
      }).length;
      if (!badge) return;
      badge.textContent = String(n);
      badge.hidden = n === 0;
    } catch (e) { /* a badge that cannot count stays quiet */ }
  }

  ONE.refreshRequestBadge = refresh;
  refresh();
})();
