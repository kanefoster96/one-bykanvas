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
  var MAX_FILE_BYTES = 10 * 1024 * 1024;
  var ACCEPT = { 'image/png': 1, 'image/jpeg': 1, 'image/webp': 1, 'application/pdf': 1 };
  var MIN_BODY = 10;

  /* What each status is called here. Same words as the email subjects. */
  var LABEL = {
    new: 'Open', accepted: 'Open', waiting: 'We’ve got a question for you',
    in_progress: 'Being built', done: 'Done', declined: 'Done'
  };
  var STATE_CLASS = { waiting: 'is-waiting', in_progress: 'is-building', done: 'is-done', declined: 'is-done' };

  var user = null;
  var requests = [];        // the list, newest activity first
  var latestByRequest = {}; // request id -> newest note (for the card line)
  var mode = 'feature';     // new-request mode
  var picked = null;        // catalogue item chosen, if any
  var current = null;       // the open request in the detail view
  var plan = null;          // active_plan from their profile

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
  function who(author) { return author === 'admin' ? 'Kane' : 'You'; }

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
    var res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await token()) },
      body: JSON.stringify(payload)
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Could not send that. Try again.');
    return data;
  }

  /* ---------------- files ---------------- */

  function checkFiles(files, note) {
    if (files.length > MAX_FILES) {
      say(note, 'Up to ' + MAX_FILES + ' files at a time. Pick fewer and try again.', 'bad');
      return false;
    }
    for (var i = 0; i < files.length; i++) {
      if (!ACCEPT[files[i].type]) { say(note, files[i].name + ' is not a photo or PDF.', 'bad'); return false; }
      if (files[i].size > MAX_FILE_BYTES) { say(note, files[i].name + ' is over 10 MB. Try a smaller one.', 'bad'); return false; }
    }
    return true;
  }

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

  function card(r) {
    var a = el('a', 'req-card' + (unread(r) ? ' is-unread' : ''));
    a.href = '#r/' + r.id;

    var top = el('div', 'req-card-top');
    top.appendChild(el('h3', 'req-card-title', r.title));
    top.appendChild(el('span', 'req-state ' + (STATE_CLASS[r.status] || ''), LABEL[r.status] || 'Open'));
    a.appendChild(top);

    var latest = latestByRequest[r.id];
    var line = el('p', 'req-card-line');
    if (latest) {
      line.appendChild(el('span', 'req-card-snippet', String(latest.body).split('\n')[0]));
      var meta = el('span', 'req-card-meta');
      meta.appendChild(document.createTextNode(who(latest.author) + ', '));
      meta.appendChild(timeEl(latest.created_at));
      line.appendChild(meta);
    } else {
      line.appendChild(el('span', 'req-card-snippet', r.detail || ''));
    }
    a.appendChild(line);
    return a;
  }

  function renderList() {
    var open = requests.filter(function (r) { return !isDone(r); });
    var done = requests.filter(isDone);

    /* Starter has no request box: the gate says why, and what Business is. */
    var starter = plan === 'starter';
    document.getElementById('starterGate').hidden = !starter;
    document.querySelector('.req-new-btn').hidden = starter;

    var openWrap = document.getElementById('openCards');
    openWrap.textContent = '';
    open.forEach(function (r) { openWrap.appendChild(card(r)); });
    document.getElementById('reqEmpty').hidden = !!(open.length || done.length) || starter;

    var doneWrap = document.getElementById('doneWrap');
    var doneCards = document.getElementById('doneCards');
    doneCards.textContent = '';
    done.forEach(function (r) { doneCards.appendChild(card(r)); });
    document.getElementById('doneCount').textContent = done.length ? '(' + done.length + ')' : '';
    doneWrap.hidden = !done.length;
    // Nothing open: the done list is all there is, so leave it open.
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

  function setMode(next) {
    mode = next;
    picked = null;
    document.getElementById('modeFeature').classList.toggle('is-on', mode === 'feature');
    document.getElementById('modeEdit').classList.toggle('is-on', mode === 'edit');
    document.getElementById('modeFeature').setAttribute('aria-selected', String(mode === 'feature'));
    document.getElementById('modeEdit').setAttribute('aria-selected', String(mode === 'edit'));

    var body = document.getElementById('newBody');
    document.getElementById('picked').hidden = true;
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

  document.getElementById('newFiles').addEventListener('change', function (e) {
    var note = document.getElementById('newFilesNote');
    var files = Array.prototype.slice.call(e.target.files || []);
    if (!checkFiles(files, note)) { e.target.value = ''; return; }
    say(note, files.length ? files.length + (files.length === 1 ? ' file added.' : ' files added.') : '');
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
      var input = document.getElementById('newFiles');
      var files = Array.prototype.slice.call(input.files || []);
      var paths = [];
      if (files.length) { say(note, 'Uploading photos…'); paths = await upload(files); say(note, 'Sending…'); }

      var data = await post({
        action: 'create',
        kind: mode === 'feature' ? 'feature' : 'edit',
        title: picked && picked.key !== 'other' ? picked.title : '',
        body: body,
        attachmentPaths: paths
      });
      document.getElementById('newBody').value = '';
      input.value = '';
      say(document.getElementById('newFilesNote'), '');
      say(note, '');
      await loadList();
      location.hash = '#r/' + data.request.id;
    } catch (err) {
      say(note, ONE.friendlyError(err), 'bad');
    } finally {
      btn.disabled = false;
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
        para.appendChild(document.createTextNode(line));
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

  async function openThread(id) {
    current = requests.filter(function (r) { return r.id === id; })[0] || null;
    if (!current) {
      var one = await ONE.db.from('requests').select('*').eq('id', id).maybeSingle();
      current = one.data || null;
    }
    if (!current) { location.hash = ''; return; }

    document.getElementById('dTitle').textContent = current.title || String(current.detail || '').split('\n')[0];
    var st = document.getElementById('dStatus');
    st.textContent = LABEL[current.status] || 'Open';
    st.className = 'req-state ' + (STATE_CLASS[current.status] || '');

    var q = await ONE.db.from('request_notes')
      .select('id, author, body, attachment_paths, created_at')
      .eq('request_id', id).order('created_at', { ascending: true }).limit(500);
    var notes = (!q.error && q.data) || [];

    var thread = document.getElementById('thread');
    thread.textContent = '';
    var lastAdmin = null;
    notes.forEach(function (n) { if (n.author === 'admin') lastAdmin = n; });
    notes.forEach(function (n) {
      thread.appendChild(bubble(n, isDone(current) && n === lastAdmin));
    });
    document.getElementById('doneLine').hidden = !isDone(current);
    document.getElementById('replyBody').placeholder = isDone(current) ? 'Reply to reopen this' : 'Write a reply';

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
      if (last && notes.length > 2) last.scrollIntoView({ block: 'end' });
    });
  }

  document.getElementById('replyFiles').addEventListener('change', function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    var count = document.getElementById('replyFilesCount');
    if (!checkFiles(files, document.getElementById('replyNote'))) { e.target.value = ''; count.hidden = true; return; }
    say(document.getElementById('replyNote'), '');
    count.textContent = String(files.length);
    count.hidden = !files.length;
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
    if (body.length < MIN_BODY) { say(note, 'A little more than that, so we can help.', 'bad'); replyBody.focus(); return; }
    btn.disabled = true;
    say(note, 'Sending…');
    try {
      var input = document.getElementById('replyFiles');
      var files = Array.prototype.slice.call(input.files || []);
      var paths = files.length ? await upload(files) : [];
      var data = await post({ action: 'reply', requestId: current.id, body: body, attachmentPaths: paths });
      replyBody.value = '';
      growReply();
      input.value = '';
      document.getElementById('replyFilesCount').hidden = true;
      say(note, '');
      // Keep the list in step so going back shows the new order.
      await loadList();
      current = requests.filter(function (r) { return r.id === data.request.id; })[0] || data.request;
      await openThread(current.id);
    } catch (err) {
      say(note, ONE.friendlyError(err), 'bad');
    } finally {
      btn.disabled = false;
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
      if ((h === 'new' || h === 'new/feature' || h === 'new/edit') && plan === 'starter') {
        location.hash = '';
        return;
      }
      if (h === 'new' || h === 'new/feature' || h === 'new/edit') {
        show('viewNew');
        setMode(h === 'new/edit' ? 'edit' : 'feature');
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
    var prof = await ONE.db.from('profiles').select('active_plan').eq('id', user.id).maybeSingle();
    plan = (prof.data && prof.data.active_plan) || null;
    await loadList();
    await route();
    loading.hidden = true;
    app.hidden = false;
  }

  window.addEventListener('hashchange', route);
  start();
})();
