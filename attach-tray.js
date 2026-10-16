/* Files waiting to go with a message.
 *
 * Picking a photo used to send it straight away (support chat) or only show
 * a count (requests), so a wrong pick went out before anyone could stop it.
 * This holds what was picked as thumbnails above the message box, each with
 * a cross to take it off, until the message is sent.
 *
 *   var tray = ONE.attachTray({ input, into | before, say, max });
 *   tray.files()   the File objects to upload, in the order picked
 *   tray.clear()   after a send
 *   tray.busy(on)  dims the tiles and hides the crosses while sending
 *
 * Used by the app's support chat (app/app.js) and by requests.js, in the
 * app and on requests.html.
 */
(function () {
  window.ONE = window.ONE || {};

  var ACCEPT = { 'image/png': 1, 'image/jpeg': 1, 'image/webp': 1, 'application/pdf': 1 };
  var MAX_BYTES = 10 * 1024 * 1024;
  var X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var DOC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';

  ONE.attachTray = function (opts) {
    var input = opts.input;
    var max = opts.max || 5;
    var say = opts.say || function () {};
    var onChange = opts.onChange || function () {};
    var held = []; // { file, url }

    var tray = document.createElement('div');
    tray.className = 'att-tray';
    tray.setAttribute('role', 'list');
    tray.setAttribute('aria-label', 'Files to send');
    tray.hidden = true;
    /* Inside a one-line composer (into: the form) it takes a row of its own
       above the box; in a longer form it goes before a given element. */
    if (opts.into) { opts.into.insertBefore(tray, opts.into.firstChild); opts.into.classList.add('has-att-tray'); }
    else opts.before.parentNode.insertBefore(tray, opts.before);

    function drop(i) {
      if (held[i] && held[i].url) URL.revokeObjectURL(held[i].url);
      held.splice(i, 1);
      render();
    }

    function render() {
      tray.innerHTML = '';
      held.forEach(function (h, i) {
        var tile = document.createElement('div');
        tile.className = 'att-tile' + (h.url ? '' : ' is-doc');
        tile.setAttribute('role', 'listitem');
        if (h.url) {
          var img = document.createElement('img');
          img.src = h.url;
          img.alt = h.file.name;
          tile.appendChild(img);
        } else {
          var doc = document.createElement('div');
          doc.className = 'att-doc';
          doc.innerHTML = DOC + '<span></span>';
          doc.lastChild.textContent = h.file.name;
          tile.appendChild(doc);
        }
        var x = document.createElement('button');
        x.type = 'button';
        x.className = 'att-x';
        x.setAttribute('aria-label', 'Remove ' + h.file.name);
        x.innerHTML = X;
        x.addEventListener('click', function () { drop(i); say(''); });
        tile.appendChild(x);
        tray.appendChild(tile);
      });
      tray.hidden = !held.length;
      onChange(held.length);
    }

    input.addEventListener('change', function () {
      var picked = Array.prototype.slice.call(input.files || []);
      input.value = ''; // so the same file can be picked again after removing it
      var problem = '';
      picked.forEach(function (f) {
        var dupe = held.some(function (h) { return h.file.name === f.name && h.file.size === f.size && h.file.lastModified === f.lastModified; });
        if (dupe) return;
        if (!ACCEPT[f.type]) { problem = f.name + ' is not a photo or PDF.'; return; }
        if (f.size > MAX_BYTES) { problem = f.name + ' is over 10 MB. Try a smaller one.'; return; }
        if (held.length >= max) { problem = 'Up to ' + max + ' files at a time.'; return; }
        held.push({ file: f, url: f.type.indexOf('image/') === 0 ? URL.createObjectURL(f) : null });
      });
      say(problem, problem ? 'bad' : '');
      render();
      if (held.length) tray.scrollLeft = tray.scrollWidth;
    });

    return {
      files: function () { return held.map(function (h) { return h.file; }); },
      count: function () { return held.length; },
      clear: function () {
        held.forEach(function (h) { if (h.url) URL.revokeObjectURL(h.url); });
        held = [];
        render();
      },
      busy: function (on) { tray.classList.toggle('is-sending', !!on); }
    };
  };
})();
