/* one — the What's-new page.
 *
 * Lists everything the server has written about this account - requests
 * moving, features landing, the site going live - newest first, with the
 * ones since the customer last looked highlighted. Looking at this page is
 * what counts as looking: the seen timestamp is stamped after render, so
 * the highlights survive this visit and the next one starts clean.
 */
(function () {
  'use strict';

  var loading = document.getElementById('loading');
  var app = document.getElementById('app');

  if (!window.ONE || !ONE.ready) {
    loading.innerHTML = '<p>Accounts are not connected yet.</p>';
    return;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fmtWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var days = (Date.now() - d.getTime()) / 86400000;
    if (days < 1) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: days > 330 ? 'numeric' : undefined });
  }

  async function start() {
    var res = await ONE.db.auth.getSession();
    if (!res.data.session) { location.replace('/login.html'); return; }
    var userId = res.data.session.user.id;

    var prof = await ONE.db.from('profiles')
      .select('notifications_seen_at').eq('id', userId).maybeSingle();
    var seenAt = prof.data && prof.data.notifications_seen_at
      ? new Date(prof.data.notifications_seen_at) : new Date(0);

    var q = await ONE.db.from('notifications')
      .select('id, title, body, href, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    var list = document.getElementById('notifList');
    var empty = document.getElementById('notifEmpty');
    var rows = (!q.error && q.data) || [];
    var unread = 0;

    rows.forEach(function (n) {
      var isNew = new Date(n.created_at) > seenAt;
      if (isNew) unread++;
      var li = el('li', 'notif-item' + (isNew ? ' is-unread' : ''));
      var top = el('div', 'notif-top');
      top.appendChild(el('p', 'notif-title', n.title));
      top.appendChild(el('span', 'notif-when', fmtWhen(n.created_at)));
      li.appendChild(top);
      if (n.body) li.appendChild(el('p', 'notif-body', n.body));
      /* Only our own pages or the customer's own site ever get written here,
         but a bad row still should not become a javascript: link. */
      if (n.href && /^(\/|https:\/\/)/.test(n.href)) {
        var a = el('a', null, 'Open →');
        a.href = n.href;
        li.appendChild(a);
      }
      list.appendChild(li);
    });

    empty.hidden = rows.length > 0;
    loading.hidden = true;
    app.hidden = false;

    /* Stamped after paint, so a failed write costs nothing and the
       highlights are on screen for this whole visit. */
    if (unread > 0) {
      /* Upsert rather than update: the admin account may never have gone
         through onboarding, so its profile row might not exist yet. */
      ONE.db.from('profiles')
        .upsert({ id: userId, notifications_seen_at: new Date().toISOString() },
                { onConflict: 'id' })
        .then(function () {});
    }
  }

  start();
})();
