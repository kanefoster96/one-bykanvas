/* one — Requests, the customer's side.
 *
 * Three views on one page, picked by the hash: the list (no hash), a new
 * request (#new, #new/feature, #new/edit) and one thread (#r/<id>). It
 * reads with the customer's own session - row level security shows them
 * only their own requests and none of our private notes - and writes
 * through /api/requests, because a note also moves the status and queues
 * the email.
 *
 * It is meant to feel like a slow, friendly chat: our notes on the left,
 * theirs on the right, one box at the bottom.
 */
(function () {
  'use strict';

  var loading = document.getElementById('loading');
  var app = document.getElementById('app');

  if (!window.ONE || !ONE.ready) {
    loading.innerHTML = '<p>Accounts are not connected yet.</p>';
    return;
  }

  var MAX_FILES = 5;
  var MIN_BODY = 10;

  /* What each status is called here. */
  var LABEL = {
    new: 'Sent', accepted: 'Sent', waiting: 'Needs your reply',
    in_progress: 'In progress', done: 'Done', declined: 'Cancelled'
  };
  var STATE_CLASS = { waiting: 'is-waiting', in_progress: 'is-building', done: 'is-done', declined: 'is-cancelled' };
  var KIND = { edit: 'Change', feature: 'Feature', info: 'Details' };

  var user = null;
  var requests = [];        // the list, newest activity first
  var latestByRequest = {}; // request id -> newest note (for the card line)
  var mode = 'feature';     // new-request mode
  var picked = null;        // catalogue item chosen, if any
  var current = null;       // the open request in the detail view
  var plan = null;          // active_plan from their profile
  var profile = null;       // points_reset_at / current_period_end, for Starter's window
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function say(node, message, kind) {
    node.textContent = message || '';
    node.className = 'note' + (kind ? ' ' + kind : '');
  }
  function isDone(r) { return r.status === 'done' || r.status === 'declined'; }
  function who(author) { return author === 'admin' ? 'Kanvas One' : 'You'; }

  /* "2 hours ago" on the page; the full date sits in the title and swaps
     in on tap, since phones have no hover. */
  function ago(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return 'just now';
    var m = Math.floor(s / 60);
    if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
    var h = Math.floor(m / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    var days = Math.floor(h / 24);
    if (days === 1) return 'yesterday';
    if (days < 7) return days + ' days ago';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: days > 330 ? 'numeric' : undefined });
  }
  /* The time on a list row, the way a mail app shows it: 14:05 today,
     Yesterday, a weekday this week, else the date. */
  function shortWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var days = Math.floor((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    if (days <= 0) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: days > 330 ? 'numeric' : undefined });
  }
  function sentLine(r) {
    var d = new Date(r.created_at);
    return (KIND[r.kind] || 'Request') + ' \u00b7 Sent ' + (isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      + ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  }
  function fullDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function timeEl(iso, cls) {
    var t = el('time', cls, ago(iso));
    t.setAttribute('datetime', iso);
    t.title = fullDate(iso);
    t.addEventListener('click', function () {
      var full = t.dataset.full === '1';
      t.textContent = full ? ago(iso) : fullDate(iso);
      t.dataset.full = full ? '0' : '1';
    });
    return t;
  }

  async function token() {
    var sess = await ONE.db.auth.getSession();
    var t = sess.data && sess.data.session && sess.data.session.access_token;
    if (!t) throw new Error('Your session has expired. Log in and try again.');
    return t;
  }

  async function post(payload) {
    var res = await fetch((window.ONE_API_BASE || '') + '/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await token()) },
      body: JSON.stringify(payload)
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Could not send that. Try again.');
    return data;
  }

  /* ---------------- files ---------------- */

  async function upload(files) {
    var batch = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(36).slice(2);
    var paths = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      var path = user.id + '/' + batch + '-' + i + '.' + ext;
      var up = await ONE.db.storage.from('request-attachments').upload(path, f, { contentType: f.type });
      if (up.error) throw new Error('Could not upload ' + f.name + ': ' + ONE.friendlyError(up.error));
      paths.push(path);
    }
    return paths;
  }

  /* ---------------- data ---------------- */

  async function loadList() {
    var q = await ONE.db.from('requests')
      .select('id, kind, title, detail, status, created_at, done_at, last_note_at, last_note_by, customer_seen_at')
      .order('last_note_at', { ascending: false, nullsFirst: false })
      .limit(200);
    if (q.error) throw q.error;
    requests = q.data || [];
    requests.forEach(function (r) {
      if (!r.title) r.title = String(r.detail || '').split('\n')[0].slice(0, 120);
      if (!r.last_note_at) r.last_note_at = r.created_at;
      if (!r.last_note_by) r.last_note_by = 'customer';
    });

    latestByRequest = {};
    if (requests.length) {
      var n = await ONE.db.from('request_notes')
        .select('request_id, author, body, created_at')
        .in('request_id', requests.map(function (r) { return r.id; }))
        .order('created_at', { ascending: false })
        .limit(600);
      ((!n.error && n.data) || []).forEach(function (note) {
        if (!latestByRequest[note.request_id]) latestByRequest[note.request_id] = note;
      });
    }
  }

  function unread(r) {
    return r.last_note_by === 'admin'
      && (!r.customer_seen_at || new Date(r.customer_seen_at) < new Date(r.last_note_at));
  }

  /* ---------------- the list ---------------- */

  /* One row: the title and when it was sent, then its status. A reply
     from us they have not read gets a dot and its first line. */
  function card(r) {
    var a = el('a', 'rq-row' + (unread(r) ? ' is-unread' : ''));
    a.href = '#r/' + r.id;
    var top = el('span', 'rq-row-top');
    top.appendChild(el('span', 'rq-row-title', r.title));
    top.appendChild(el('span', 'rq-row-when', shortWhen(r.created_at)));
    a.appendChild(top);
    var sub = el('span', 'rq-row-sub');
    sub.appendChild(el('span', 'req-state ' + (r.status === 'waiting' ? 'is-reply' : (STATE_CLASS[r.status] || '')), LABEL[r.status] || 'Sent'));
    sub.appendChild(el('span', 'rq-row-who', KIND[r.kind] || 'Request'));
    a.appendChild(sub);
    var latest = latestByRequest[r.id];
    if (unread(r) && latest) a.appendChild(el('span', 'rq-row-snip', 'Kanvas One: ' + String(latest.body).split('\n')[0]));
    return a;
  }

  function renderList() {
    /* Newest first, so the order is the order they were sent. */
    var byNew = requests.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var open = byNew.filter(function (r) { return !isDone(r); });
    var done = byNew.filter(isDone);

    /* Edits are unlimited on every plan, so there is no allowance to show. */
    document.getElementById('starterLeft').hidden = true;

    var openWrap = document.getElementById('openCards');
    openWrap.textContent = '';
    open.forEach(function (r) { openWrap.appendChild(card(r)); });
    document.getElementById('reqEmpty').hidden = !!(open.length || done.length);

    var doneWrap = document.getElementById('doneWrap');
    var doneCards = document.getElementById('doneCards');
    doneCards.textContent = '';
    done.forEach(function (r) { doneCards.appendChild(card(r)); });
    document.getElementById('doneCount').textContent = done.length ? '(' + done.length + ')' : '';
    doneWrap.hidden = !done.length;
    // Nothing open: the closed list is all there is, so leave it open.
    if (done.length && !open.length) doneWrap.open = true;
  }

  /* ---------------- new request ---------------- */

  function renderCatalogue() {
    var list = document.getElementById('catalogue');
    list.textContent = '';
    (window.REQUEST_CATALOGUE || []).forEach(function (item) {
      var b = el('button', 'cat-item' + (picked && picked.key === item.key ? ' is-on' : ''));
      b.type = 'button';
      b.appendChild(el('span', 'cat-title', item.title));
      b.appendChild(el('span', 'cat-line', item.line));
      b.addEventListener('click', function () { pick(item); });
      list.appendChild(b);
    });
  }

  function pick(item) {
    picked = item;
    var body = document.getElementById('newBody');
    body.placeholder = item.eg;
    document.getElementById('pickedTitle').textContent = item.key === 'other' ? 'Something else' : item.title;
    document.getElementById('picked').hidden = false;
    document.getElementById('newLabel').textContent = item.key === 'other'
      ? 'What would you like?'
      : 'Tell us the one thing we need to set it up';
    document.getElementById('catalogue').hidden = true;
    document.getElementById('newForm').hidden = false;
    body.focus();
  }

  /* Inside the Kanvas One app (it sets ONE_API_BASE), Starter does not see
     the Business features to ask about: App Store guideline 3.1.3(f) allows
     no call to buy outside the app. Edits only there; the website keeps both. */
  var inApp = window.ONE_API_BASE !== undefined;
  function starterInApp() { return inApp && plan === 'starter'; }

  function setMode(next) {
    if (next === 'feature' && starterInApp()) next = 'edit';
    document.getElementById('modeFeature').hidden = starterInApp();
    mode = next;
    picked = null;
    document.getElementById('modeFeature').classList.toggle('is-on', mode === 'feature');
    document.getElementById('modeEdit').classList.toggle('is-on', mode === 'edit');
    document.getElementById('modeFeature').setAttribute('aria-selected', String(mode === 'feature'));
    document.getElementById('modeEdit').setAttribute('aria-selected', String(mode === 'edit'));

    var body = document.getElementById('newBody');
    document.getElementById('picked').hidden = true;
    document.getElementById('starterEditNote').hidden = !(plan === 'starter' && mode === 'edit');
    document.getElementById('starterFeatureNote').hidden = !(plan === 'starter' && mode === 'feature');
    if (mode === 'feature') {
      renderCatalogue();
      document.getElementById('catalogue').hidden = false;
      document.getElementById('newForm').hidden = true;
    } else {
      document.getElementById('catalogue').hidden = true;
      document.getElementById('newLabel').textContent = 'What would you like changed?';
      body.placeholder = 'Swap the photo on the homepage for the new shopfront one.';
      document.getElementById('newForm').hidden = false;
      body.focus();
    }
  }

  document.getElementById('modeFeature').addEventListener('click', function () { setMode('feature'); });
  document.getElementById('modeEdit').addEventListener('click', function () { setMode('edit'); });
  document.getElementById('pickedChange').addEventListener('click', function () { setMode('feature'); });

  /* Picked photos wait as thumbnails, removable, until the request is sent. */
  var newTray = ONE.attachTray({
    input: document.getElementById('newFiles'),
    before: document.getElementById('newFilesNote'),
    max: MAX_FILES,
    say: function (m, kind) { say(document.getElementById('newFilesNote'), m, kind); }
  });

  document.getElementById('newForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var note = document.getElementById('newNote');
    var btn = document.getElementById('newBtn');
    var body = document.getElementById('newBody').value.trim();
    if (body.length < MIN_BODY) {
      say(note, 'A sentence is plenty, but tell us a little more than that.', 'bad');
      document.getElementById('newBody').focus();
      return;
    }
    btn.disabled = true;
    say(note, 'Sending…');
    try {
      var files = newTray.files();
      var paths = [];
      newTray.busy(true);
      if (files.length) { say(note, 'Uploading photos…'); paths = await upload(files); say(note, 'Sending…'); }

      var data = await post({
        action: 'create',
        kind: mode === 'feature' ? 'feature' : 'edit',
        title: picked && picked.key !== 'other' ? picked.title : '',
        body: body,
        attachmentPaths: paths
      });
      document.getElementById('newBody').value = '';
      newTray.clear();
      say(document.getElementById('newFilesNote'), '');
      say(note, '');
      await loadList();
      location.hash = '#r/' + data.request.id;
    } catch (err) {
      say(note, ONE.friendlyError(err), 'bad');
    } finally {
      btn.disabled = false;
      newTray.busy(false);
    }
  });

  /* ---------------- one thread ---------------- */

  function bubble(n, isClosing) {
    var wrap = el('div', 'msg ' + (n.author === 'admin' ? 'from-kane' : 'from-you'));
    var head = el('div', 'msg-who');
    head.appendChild(document.createTextNode(who(n.author)));
    if (isClosing) head.appendChild(el('span', 'msg-done', 'Done'));
    wrap.appendChild(head);

    var box = el('div', 'msg-body');
    String(n.body).split(/\n{2,}/).forEach(function (p) {
      var para = el('p');
      p.split('\n').forEach(function (line, i) {
        if (i) para.appendChild(document.createElement('br'));
        /* Links Kane sends (a form to fill in, an account to set up) are
           tappable; in the One app they open in its own browser. */
        line.split(/(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/).forEach(function (bit, j) {
          if (!bit) return;
          if (j % 2 === 0) { para.appendChild(document.createTextNode(bit)); return; }
          var a = el('a', 'msg-link', bit.replace(/^https?:\/\//, ''));
          a.href = bit; a.target = '_blank'; a.rel = 'noopener';
          a.addEventListener('click', function (e) { if (window.ONE_OPEN) { e.preventDefault(); window.ONE_OPEN(bit); } });
          para.appendChild(a);
        });
      });
      box.appendChild(para);
    });
    if (n.attachment_paths && n.attachment_paths.length) box.appendChild(attachmentList(n.attachment_paths));
    wrap.appendChild(box);
    wrap.appendChild(timeEl(n.created_at, 'msg-when'));
    return wrap;
  }

  /* Signed on open: the bucket is private, and the storage policy lets
     the customer read anything under their own folder - ours included,
     since a note from us stores its files under <them>/admin/. */
  function attachmentList(paths) {
    var box = el('div', 'msg-files');
    ONE.db.storage.from('request-attachments').createSignedUrls(paths, 3600).then(function (q) {
      ((!q.error && q.data) || []).forEach(function (s, i) {
        if (!s.signedUrl) return;
        var a = el('a', 'msg-file');
        a.href = s.signedUrl; a.target = '_blank'; a.rel = 'noopener';
        if (/\.pdf($|\?)/i.test(paths[i])) {
          a.textContent = 'PDF ' + (i + 1);
        } else {
          var img = document.createElement('img');
          img.src = s.signedUrl; img.alt = 'Photo ' + (i + 1); img.loading = 'lazy';
          a.appendChild(img);
        }
        box.appendChild(a);
      });
    }).catch(function () { box.appendChild(el('span', 'hint', 'Could not load the photos.')); });
    return box;
  }

  /* The request itself, at the top of its thread: what they asked and
     when, with Edit and Cancel while it is open and Delete once it is
     closed. Every one of those asks first. */
  function summary(r, first) {
    var box = el('div', 'rq-summary');
    box.appendChild(el('p', 'rq-summary-meta', sentLine(r)));
    var text = el('div', 'rq-summary-text');
    function paintText(words) {
      text.textContent = '';
      String(words || '').split(/\n{2,}/).forEach(function (para) {
        var p = el('p');
        para.split('\n').forEach(function (line, i) { if (i) p.appendChild(el('br')); p.appendChild(document.createTextNode(line)); });
        text.appendChild(p);
      });
    }
    paintText(first ? first.body : r.detail);
    box.appendChild(text);
    if (first && first.attachment_paths && first.attachment_paths.length) box.appendChild(attachmentList(first.attachment_paths));
    var note = el('p', 'note'); note.setAttribute('role', 'status');
    var acts = el('div', 'rq-acts');
    box.appendChild(acts);
    box.appendChild(note);

    function button(label, cls, fn) {
      var b = el('button', 'rq-act' + (cls ? ' ' + cls : ''), label);
      b.type = 'button';
      b.addEventListener('click', fn);
      acts.appendChild(b);
      return b;
    }
    async function act(payload, busy) {
      say(note, busy);
      acts.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      try { return await post(payload); }
      catch (err) { say(note, ONE.friendlyError(err), 'bad'); acts.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); return null; }
    }

    function paintActs() {
      acts.textContent = '';
      if (isDone(r)) {
        button('Delete', 'is-danger', async function () {
          var yes = await ONE.confirm({ title: 'Delete this request?', body: 'It and its messages are removed for good.', ok: 'Delete', cancel: 'Keep it', danger: true });
          if (!yes) return;
          if (await act({ action: 'delete', requestId: r.id }, 'Deleting…')) {
            await loadList();
            location.hash = '';
          }
        });
        return;
      }
      button('Edit', '', editMode);
      button('Cancel request', 'is-danger', async function () {
        var yes = await ONE.confirm({ title: 'Cancel this request?', body: 'We’ll stop work on it. You can reply later to reopen it.', ok: 'Yes, cancel it', cancel: 'Keep it', danger: true });
        if (!yes) return;
        if (await act({ action: 'cancel', requestId: r.id }, 'Cancelling…')) {
          await loadList();
          await openThread(r.id);
        }
      });
    }

    function editMode() {
      var field = el('textarea', 'rq-field');
      field.value = first ? first.body : r.detail;
      field.maxLength = 4000;
      field.setAttribute('aria-label', 'Your request');
      text.replaceWith(field);
      field.focus();
      acts.textContent = '';
      say(note, '');
      button('Save', 'is-primary', async function () {
        var words = field.value.trim();
        if (words.length < MIN_BODY) { say(note, 'Add a little more so we know what you need.', 'bad'); field.focus(); return; }
        var yes = await ONE.confirm({ title: 'Save your changes?', body: 'We’ll see the new version straight away.', ok: 'Save changes', cancel: 'Keep editing' });
        if (!yes) return;
        if (await act({ action: 'edit', requestId: r.id, body: words }, 'Saving…')) {
          await loadList();
          await openThread(r.id);
        }
      });
      button('Discard', '', function () { field.replaceWith(text); say(note, ''); paintActs(); });
    }

    paintActs();
    return box;
  }

  async function openThread(id) {
    current = requests.filter(function (r) { return r.id === id; })[0] || null;
    if (!current) {
      var one = await ONE.db.from('requests').select('*').eq('id', id).maybeSingle();
      current = one.data || null;
    }
    if (!current) { location.hash = ''; return; }

    document.getElementById('dTitle').textContent = current.title || String(current.detail || '').split('\n')[0];
    var st = document.getElementById('dStatus');
    st.textContent = LABEL[current.status] || 'Sent';
    st.className = 'req-state ' + (STATE_CLASS[current.status] || '');

    var q = await ONE.db.from('request_notes')
      .select('id, author, body, attachment_paths, created_at')
      .eq('request_id', id).order('created_at', { ascending: true }).limit(500);
    var notes = (!q.error && q.data) || [];
    /* Their first note is the request; it sits in the card, not as a bubble. */
    var first = notes.length && notes[0].author === 'customer' ? notes[0] : null;
    var rest = first ? notes.slice(1) : notes;

    var thread = document.getElementById('thread');
    thread.textContent = '';
    thread.appendChild(summary(current, first));
    var lastAdmin = null;
    rest.forEach(function (n) { if (n.author === 'admin') lastAdmin = n; });
    rest.forEach(function (n) {
      thread.appendChild(bubble(n, current.status === 'done' && n === lastAdmin));
    });
    if (!rest.length) thread.appendChild(el('p', 'rq-convo-empty', 'No replies yet'));
    document.getElementById('doneLine').hidden = true;
    document.getElementById('replyBody').placeholder = isDone(current) ? 'Reply to reopen' : 'Write a reply';

    // Seen: everything we wrote on it is read now, and the badge can drop.
    if (unread(current)) {
      var now = new Date().toISOString();
      await ONE.db.from('requests').update({ customer_seen_at: now }).eq('id', id);
      current.customer_seen_at = now;
      if (ONE.refreshRequestBadge) ONE.refreshRequestBadge();
    }

    // The newest message is what they came for.
    requestAnimationFrame(function () {
      var last = thread.lastElementChild;
      if (last && rest.length > 2) last.scrollIntoView({ block: 'end' });
    });
  }

  var replyTray = ONE.attachTray({
    input: document.getElementById('replyFiles'),
    into: document.getElementById('replyForm'),
    max: MAX_FILES,
    say: function (m, kind) { say(document.getElementById('replyNote'), m, kind); }
  });

  var replyBody = document.getElementById('replyBody');
  function growReply() {
    replyBody.style.height = 'auto';
    replyBody.style.height = Math.min(replyBody.scrollHeight, 160) + 'px';
  }
  replyBody.addEventListener('input', growReply);

  document.getElementById('replyForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!current) return;
    var note = document.getElementById('replyNote');
    var btn = document.getElementById('replyBtn');
    var body = replyBody.value.trim();
    var files = replyTray.files();
    /* Photos can go on their own; words alone need a little more than "ok". */
    if (!files.length && body.length < MIN_BODY) { say(note, 'A little more than that, so we can help.', 'bad'); replyBody.focus(); return; }
    btn.disabled = true;
    replyTray.busy(true);
    say(note, files.length ? 'Uploading ' + (files.length === 1 ? 'your file' : files.length + ' files') + '…' : 'Sending…');
    try {
      var paths = files.length ? await upload(files) : [];
      var data = await post({ action: 'reply', requestId: current.id, body: body, attachmentPaths: paths });
      replyBody.value = '';
      growReply();
      replyTray.clear();
      say(note, '');
      // Keep the list in step so going back shows the new order.
      await loadList();
      current = requests.filter(function (r) { return r.id === data.request.id; })[0] || data.request;
      await openThread(current.id);
    } catch (err) {
      say(note, ONE.friendlyError(err), 'bad');
    } finally {
      btn.disabled = false;
      replyTray.busy(false);
    }
  });

  /* ---------------- routing ---------------- */

  function show(view) {
    ['viewList', 'viewNew', 'viewDetail'].forEach(function (id) {
      document.getElementById(id).hidden = id !== view;
    });
    window.scrollTo(0, 0);
  }

  async function route() {
    var h = location.hash.replace(/^#/, '');
    try {
      if (h === 'new' || h === 'new/feature' || h === 'new/edit') {
        show('viewNew');
        // Starter lands on the box: changes are the plan, features are the conversation.
        setMode(h === 'new/edit' || (h === 'new' && plan === 'starter') ? 'edit' : 'feature');
      } else if (h.indexOf('r/') === 0) {
        show('viewDetail');
        await openThread(h.slice(2));
      } else {
        await loadList();
        renderList();
        show('viewList');
      }
    } catch (err) {
      loading.innerHTML = '<p>Could not load your requests: ' + ONE.friendlyError(err) + '</p>';
      loading.hidden = false;
    }
  }

  async function start() {
    var res = await ONE.db.auth.getSession();
    if (!res.data.session) {
      location.replace('/login.html?next=' + encodeURIComponent(location.pathname + location.hash));
      return;
    }
    user = res.data.session.user;
    var prof = await ONE.db.from('profiles').select('active_plan, points_reset_at, current_period_end').eq('id', user.id).maybeSingle();
    profile = prof.data || null;
    plan = (profile && profile.active_plan) || null;
    await loadList();
    await route();
    loading.hidden = true;
    app.hidden = false;
  }

  window.addEventListener('hashchange', route);
  start();
})();
