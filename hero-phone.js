/* The homepage app phones: One's member app, drawn and animated in the page
   (no screenshots to wait for). The hero has two phones behind a switch:
   for coaches (registers, a notification to a class, medical notes, posts,
   memberships) and for parents (a trial from booking to member, their next
   class and QR code, and a chat with the coach). Everything is drawn at
   720px wide and scaled to fit, so it stays sharp at any size. Pauses when
   off screen; with reduced motion it just steps between finished screens. */
(function () {

  var IC = {
    tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 004 0"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M7.5 11h1M11.5 11h1M15.5 11h1M7.5 15h1M11.5 15h1M15.5 15h1" stroke-linecap="round"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 4c4.7 0 8.5 3.3 8.5 7.5S16.7 19 12 19c-1.2 0-2.3-.2-3.3-.6L4 20l1.4-3.8C4.2 14.9 3.5 13.3 3.5 11.5 3.5 7.3 7.3 4 12 4z"/></svg>',
    shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 9l1.5-4.5h13L20 9M4 9v11h16V9M4 9h16M9.5 20v-5h5v5"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" stroke-linecap="round"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.6 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z"/></svg>',
    heartf: '<svg viewBox="0 0 24 24" fill="#ff3b5c" stroke="#ff3b5c" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.6 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2.8l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.87l-5.5 2.88 1.05-6.12L3.1 9.3l6.15-.9z"/></svg>',
    sig: '<svg width="34" height="22" viewBox="0 0 34 22" fill="currentColor"><rect x="0" y="14" width="6" height="8" rx="1.5"/><rect x="9" y="10" width="6" height="12" rx="1.5"/><rect x="18" y="5" width="6" height="17" rx="1.5"/><rect x="27" y="0" width="6" height="22" rx="1.5"/></svg>',
    wifi: '<svg width="32" height="24" viewBox="0 0 24 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M2 6.5a14 14 0 0120 0M5.5 10a9 9 0 0113 0M9 13.4a4 4 0 016 0"/></svg>',
    bat: '<svg width="48" height="24" viewBox="0 0 48 24" fill="none"><rect x="1.5" y="1.5" width="40" height="21" rx="6" stroke="currentColor" stroke-width="2.4"/><rect x="5" y="5" width="33" height="14" rx="3" fill="currentColor"/><rect x="44" y="8" width="3" height="8" rx="1.5" fill="currentColor"/></svg>'
  };
  var AP = '<span class="hp-ap"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.2 1-4.1 2.5-1.8 3.1-.5 7.6 1.3 10.1.8 1.2 1.8 2.6 3.1 2.5 1.3-.1 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-.9-2.4-4.1zM14 5.2c.7-.8 1.1-1.9 1-3-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.4z"/></svg>Pay</span>';
  var T = IC.tick, CLUB = 'Your Club', LOGO = '<span class="hp-lg">' + IC.star + '</span>';

  function qr(seed, on, off) {
    var N = 25, s = seed, r = function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }, o = '';
    function fin(x, y) { o += '<rect x="' + x + '" y="' + y + '" width="7" height="7" fill="' + on + '"/><rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="5" height="5" fill="' + off + '"/><rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" fill="' + on + '"/>'; }
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { if ((x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16)) continue; if (r() > .52) o += '<rect x="' + x + '" y="' + y + '" width="1.02" height="1.02" fill="' + on + '"/>'; }
    fin(0, 0); fin(18, 0); fin(0, 18);
    return '<svg viewBox="0 0 25 25" shape-rendering="crispEdges">' + o + '</svg>';
  }
  var sbar = function (light) { return '<div class="hp-sb' + (light ? ' hp-l' : '') + '"><b>9:41</b><span>' + IC.sig + IC.wifi + IC.bat + '</span></div>'; };
  var ban = function (id, msg, light) { return '<div class="hp-ban' + (light ? ' hp-banl' : '') + '" id="' + id + '">' + (light ? '<span class="hp-mi">' + IC.mail + '</span>' : LOGO) + '<div><p class="hp-bt"><span>' + CLUB.toUpperCase() + '</span><span>now</span></p><p>' + msg + '</p></div></div>'; };
  var row = function (name, tag, right, id) { return '<div class="hp-row"' + (id ? ' id="' + id + '"' : '') + '><span><span class="hp-t">' + name + (tag || '') + '</span></span>' + right + '</div>'; };
  var ok = function (txt) { return '<b class="hp-ok">' + T + txt + '</b>'; };

  var SCREENS = [
    { id: 'web', full: true, label: 'They book a free trial on your website', html:
      sbar() + '<div class="hp-wnav">' + LOGO + '<span class="hp-hb"><i></i><i></i><i></i></span></div>' +
      '<div class="hp-wproof"><span class="hp-avs"><i style="background:#f59e0b"></i><i style="background:#6366f1"></i><i style="background:#ec4899"></i><i style="background:#10b981"></i></span><div><p class="hp-stars">\u2605\u2605\u2605\u2605\u2605</p><p>Loved by local parents</p></div></div>' +
      '<p class="hp-wh">Book a free trial class.<span>No card needed.</span></p>' +
      '<div class="hp-steps"><b class="on">1</b><i></i><b id="hp-st2">2</b><i></i><b>3</b><i></i><b>4</b></div>' +
      '<div class="hp-wcard"><div class="hp-wst" id="hp-w1"><p class="hp-fl">Child\u2019s name</p><div class="hp-fi" id="hp-fn"><span id="hp-fnt"></span></div><p class="hp-fl">Age</p><div class="hp-fi" id="hp-fa"><span id="hp-fat"></span></div><div class="hp-nx"><span id="hp-nx">Next</span></div></div>' +
      '<div class="hp-wst" id="hp-w2"><p class="hp-fl">Pick a class</p><div class="hp-opt hp-sel"><span>Hip Hop<small>Tuesday \u00b7 5:30pm</small></span><i class="hp-rd">' + T + '</i></div><div class="hp-opt"><span>Hip Hop<small>Thursday \u00b7 5:30pm</small></span><i class="hp-rd"></i></div><div class="hp-okp" id="hp-okp">' + T + 'Free trial booked</div></div></div>' +
      '<div class="hp-url">yourclub.co.uk</div>' },
    { id: 'mail', full: true, light: true, label: 'Their trial pass, emailed for you', html:
      sbar(1) + '<div class="hp-mnav"><span class="hp-bk">\u2039</span><b>Ava\u2019s trial is confirmed \ud83c\udf89</b></div>' +
      '<div class="hp-mail"><div class="hp-mh"><b>YOUR CLUB</b><span>FREE TRIAL PASS</span></div><div class="hp-mb"><h3>You\u2019re booked in! \ud83c\udf89</h3><p>Ava\u2019s free trial is confirmed. We can\u2019t wait to meet her!</p>' +
      '<div class="hp-mbox"><b>\u23f0 Day and time</b>Hip Hop \u00b7 Tuesday \u00b7 5:30pm</div><p>Just show this QR code when you arrive.</p><div class="hp-mqr">' + qr(11, '#000', '#fff') + '</div></div></div>' +
      ban('hp-b-mail', 'Ava\u2019s trial is confirmed \ud83c\udf89', true) },
    { id: 'sms', full: true, light: true, label: 'A reminder text, so they turn up', html:
      sbar(1) + '<div class="hp-snav"><span class="hp-sa">' + IC.star + '</span><b>' + CLUB + ' \u203a</b></div>' +
      '<p class="hp-smeta">Text Message \u00b7 SMS<br>Today 09:00</p>' +
      '<span class="hp-styp" id="hp-sty"><i></i><i></i><i></i></span>' +
      '<p class="hp-sin" id="hp-sin">Hi! Reminder: Ava\u2019s free Hip Hop trial is tomorrow at 5:30pm. Comfy clothes and a water bottle. See you there!</p>' +
      '<p class="hp-sout" id="hp-sout">Thank you, we\u2019ll be there! \ud83d\ude0a</p>' +
      '<div class="hp-sinp"><span>+</span><div>Text Message \u00b7 SMS</div></div>' },
    { id: 'follow', full: true, light: true, label: 'A follow-up, so they join', html:
      sbar(1) + '<div class="hp-mnav"><span class="hp-bk">\u2039</span><b>How was Ava\u2019s first class?</b></div>' +
      '<div class="hp-mail"><div class="hp-mh"><b>YOUR CLUB</b><span>AFTER THE TRIAL</span></div><div class="hp-mb"><h3>Ava was brilliant! \u2b50</h3><p>Thanks for coming to Hip Hop. We\u2019d love Ava to join us every week, and her spot is saved for her.</p>' +
      '<div class="hp-mbox"><b>\ud83d\udcc5 Every Tuesday</b>Hip Hop \u00b7 5:30pm \u00b7 Coach Jess</div><div class="hp-join" id="hp-join"><span id="hp-joint">Join Your Club</span><span class="hp-joined" id="hp-joined">' + T + 'Membership started</span></div><p class="hp-small">Pay monthly by card. Cancel any time.</p></div></div>' +
      ban('hp-b-follow', 'How was Ava\u2019s first class?', true) },
    { id: 'payset', tab: 0, ov: true, label: 'Easy payment setup', html:
      '<p class="hp-ttl">Join Hip Hop</p><p class="hp-sub">Monthly membership \u00b7 cancel any time</p>' +
      '<div class="hp-cd" style="margin-top:26px">' + row('Hip Hop<span class="hp-s">Tuesdays \u00b7 5:30pm</span>', '', ok('Spot saved')) + row('Ava Morgan<span class="hp-s">Age 7</span>', '', '') + '</div>' +
      '<p class="hp-lab">Pay monthly</p>' +
      '<div class="hp-apb" id="hp-apb">' + AP + '</div>' +
      '<p class="hp-sub" style="text-align:center;margin-top:16px!important">or pay by card</p>' +
      '<div class="hp-allok" id="hp-payok">' + T + 'Membership started</div>' +
      '<div class="hp-sheet" id="hp-sheet"><div class="hp-shh">' + AP + '<span>Cancel</span></div>' +
      '<div class="hp-shr"><span class="hp-visa">VISA</span><div><b>Visa \u2022\u2022\u2022\u2022 4242</b><span>Ava\u2019s mum</span></div></div>' +
      '<div class="hp-shr"><span class="hp-shl">' + IC.star + '</span><div><b>Your Club</b><span>Hip Hop membership \u00b7 monthly</span></div></div>' +
      '<div class="hp-shc" id="hp-shc"><span class="hp-fid" id="hp-fid"><i></i></span><b id="hp-sht">Confirm with Side Button</b></div></div>' },
    { id: 'reg', tab: 1, label: 'Live on your registers', html:
      '<p class="hp-ttl">Hip Hop</p><p class="hp-sub">Register \u00b7 Tuesday 5:30pm</p>' +
      '<p class="hp-lab">Members</p><div class="hp-cd hp-pad"><p class="hp-big"><span id="hp-rc">18</span> of 20</p><div class="hp-bar"><i id="hp-rbar"></i></div></div>' +
      '<p class="hp-lab">Register</p><div class="hp-cd">' +
      row('Leo P.', '<span class="hp-tag hp-m">Member</span>', '') +
      row('Isla K.', '<span class="hp-tag hp-m">Member</span>', '') +
      row('Ava M.', '<span class="hp-tag hp-new" id="hp-avt">New member</span>', ok('Added'), 'hp-avr') +
      row('Noah T.', '<span class="hp-tag hp-m">Member</span>', '') + '</div>' +
      ban('hp-b-reg', 'Ava is on the Hip Hop register \ud83c\udf89') },
    { id: 'qrs', tab: 4, label: 'Scan in every class for attendance', html:
      '<div class="hp-av">A<em>' + IC.cam + '</em></div><p class="hp-nm">Ava Morgan</p><p class="hp-mp"><span>Monthly membership</span></p>' +
      '<div class="hp-cd hp-next">' + row('Next class<span class="hp-s">Hip Hop \u00b7 Tuesday 5:30pm \u00b7 Coach Jess</span>', '', '<b class="hp-pill hp-pg">Booked</b>') + '</div>' +
      '<p class="hp-lab" style="text-align:center;margin-top:24px!important">Scan to check in</p><div class="hp-qrc">' + qr(7, '#fff', '#000') + '<i class="hp-scan" id="hp-scan"></i><div class="hp-done" id="hp-done"><span class="hp-ck">' + T + '</span><b>Checked in</b><span>Hip Hop \u00b7 5:30pm</span></div></div>' },
    { id: 'feed', tab: 2, label: 'Community posts and in-app chat', html:
      '<div class="hp-post" style="margin-top:-6px;border-top:0;padding-top:6px"><div class="hp-ph">' + LOGO + '<div><b>' + CLUB + '</b> <span class="hp-tag hp-w">OFFICIAL</span><span class="hp-d">Today \u00b7 07:15</span></div></div>' +
      '<p class="hp-pt">Half term: we\u2019re open all week</p><p class="hp-pb">Every class runs as normal, same days and times. Just come along!</p>' +
      '<div class="hp-re"><span id="hp-hrt">' + IC.heart + '<i id="hp-hc">0</i></span><span>' + IC.chat + '<i id="hp-cc">0</i></span></div>' +
      '<div class="hp-sent" id="hp-sent">' + T + 'Sent to every parent and coach</div></div>' +
      '<p class="hp-lab">Messages</p><div class="hp-chat2">' +
      '<p class="hp-bm" id="hp-m1">Does Ava need anything for the show?</p>' +
      '<div class="hp-bt2" id="hp-m2">' + LOGO + '<p>Just her usual kit. We\u2019ll go through it in class!</p></div></div>' +
      ban('hp-b-feed', 'Half term: we\u2019re open all week') },
    { id: 'notify', tab: 0, label: 'Send a notification to one class', html:
      '<p class="hp-ttl">New notification</p><p class="hp-sub">Straight to parents\u2019 phones</p>' +
      '<p class="hp-lab">Send to</p><div class="hp-cd">' + row('Hip Hop<span class="hp-s">Tuesday 5:30pm \u00b7 19 families</span>', '', ok('Chosen')) + '</div>' +
      '<p class="hp-lab">Message</p><div class="hp-cd hp-pad hp-msg"><span id="hp-nt"></span><i class="hp-car" id="hp-car"></i></div>' +
      '<div class="hp-send" id="hp-send">Send</div>' +
      '<div class="hp-allok" id="hp-nok">' + T + 'Sent to 19 families</div>' },
    { id: 'mem', tab: 0, label: 'Memberships, easy to manage', html:
      '<p class="hp-ttl">Memberships</p><p class="hp-sub">40 active \u00b7 all paid by card</p>' +
      '<p class="hp-lab">Members</p><div class="hp-cd">' +
      row('Ava Morgan<span class="hp-s">Hip Hop \u00b7 monthly</span>', '', '<b class="hp-pill hp-pg">Active</b>') +
      row('Leo Parker<span class="hp-s">Street Dance \u00b7 monthly</span>', '', '<b class="hp-btnw" id="hp-leo">Pause</b>') +
      row('Isla Khan<span class="hp-s">Two classes \u00b7 sibling discount</span>', '', '<b class="hp-pill hp-pg">Active</b>') +
      row('Mia Reid<span class="hp-s">Card expiring</span>', '', '<b class="hp-btnw" id="hp-mia">Send link</b>') + '</div>' +
      '<p class="hp-sub" style="margin-top:22px!important">Pause, change or cancel in a tap. Parents can update their own card.</p>' },
    { id: 'emg', tab: 0, label: 'Emergency contacts on hand', html:
      '<div class="hp-av" style="width:150px;height:150px;font-size:64px">A</div><p class="hp-nm">Ava Morgan</p><p class="hp-sub" style="text-align:center">Hip Hop \u00b7 age 7</p>' +
      '<p class="hp-lab">Emergency contacts</p><div class="hp-cd">' +
      row('Sarah Morgan<span class="hp-s">Mum \u00b7 07700 900123</span>', '', '<b class="hp-call" id="hp-call">' + IC.phone + '</b>') +
      row('James Morgan<span class="hp-s">Dad \u00b7 07700 900456</span>', '', '<b class="hp-call">' + IC.phone + '</b>') + '</div>' +
      '<p class="hp-lab">Medical and consent</p><div class="hp-cd">' +
      row('Asthma<span class="hp-s">Inhaler in her bag</span>', '', '<b class="hp-pill hp-pa">Note</b>') +
      row('Photo consent', '', ok('Given')) + '</div>' }
  ];

  var css = [
    '.hp-box{position:relative;width:100%;aspect-ratio:720/1476}',
    '.hp-in{position:absolute;left:0;top:0;width:720px;height:1476px;transform-origin:0 0}',
    '.hp-phone{position:absolute;inset:0;border-radius:96px;padding:16px;background:#1d1d1f;box-shadow:0 60px 120px -50px rgba(37,99,235,.45),0 30px 60px -30px rgba(0,0,0,.45),inset 0 0 0 2px rgba(255,255,255,.08)}',
    '.hp-scr{position:relative;height:100%;border-radius:82px;background:#0a0a0c;overflow:hidden;color:#f5f5f2;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left;-webkit-font-smoothing:antialiased}',
    '.hp-scr p,.hp-scr h3{margin:0}',
    '.hp-sb{position:relative;z-index:3;height:92px;display:flex;align-items:center;justify-content:space-between;padding:10px 64px 0 76px;background:#141417;color:#f5f5f2}',
    '.hp-sb b{font:600 27px/1 Inter,sans-serif}.hp-sb span{display:flex;gap:12px;align-items:center}',
    '.hp-sb.hp-l{background:#fff;color:#000}',
    '.hp-hd{position:absolute;left:0;right:0;top:92px;height:92px;z-index:3;background:#141417;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;padding:0 30px}',
    '.hp-hd svg{width:34px;height:34px}',
    '.hp-lg{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#60a5fa);flex:none}',
    '.hp-lg svg{width:58%;height:58%}',
    '.hp-tb{position:absolute;left:0;right:0;bottom:0;height:120px;padding:0 40px 26px;z-index:3;background:#141417;border-top:1px solid rgba(255,255,255,.08);display:flex;align-items:center}',
    '.hp-tb i{flex:1;display:grid;place-items:center;color:rgba(245,245,242,.5)}.hp-tb i.on{color:#fff}.hp-tb i svg{width:36px;height:36px}',
    '.hp-tb .hp-qrb{flex:none;width:76px;height:76px;margin-top:-30px;border-radius:50%;background:#e9e9e6;color:#08080a;position:relative}',
    '.hp-tb .hp-qrb::after{content:"";position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#22c55e;border:3px solid #141417}',
    '.hp-v{position:absolute;left:0;right:0;top:184px;bottom:120px;padding:30px 32px 0;opacity:0;overflow:hidden}',
    '.hp-v.hp-full{top:0;bottom:0;padding:0;z-index:6;background:#000}',
    '.hp-v.hp-light{background:#f2f2f2;color:#111}',
    '.hp-ttl{font:700 36px/1.15 Inter,sans-serif;letter-spacing:-.02em}',
    '.hp-sub{font:500 21px/1.35 Inter,sans-serif;color:rgba(245,245,242,.6);margin-top:6px!important}',
    '.hp-lab{margin:30px 0 14px!important;font:500 17px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,245,242,.6)}',
    '.hp-cd{background:#131316;border:1px solid rgba(255,255,255,.1);border-radius:26px}.hp-pad{padding:24px}',
    '.hp-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:22px}',
    '.hp-row+.hp-row{border-top:1px solid rgba(255,255,255,.07)}',
    '.hp-t{font:600 24px/1.2 Inter,sans-serif}',
    '.hp-s{display:block;font:500 18px/1.3 Inter,sans-serif;color:rgba(245,245,242,.55);margin-top:4px}',
    '.hp-tag{display:inline-block;margin-left:8px;padding:3px 11px;border:1px solid rgba(255,255,255,.22);border-radius:999px;font:600 14px/1.3 Inter,sans-serif;letter-spacing:.06em;color:rgba(245,245,242,.75);vertical-align:2px}',
    '.hp-tag.hp-f{border-color:rgba(96,165,250,.45);color:#93c5fd;background:rgba(96,165,250,.14)}',
    '.hp-tag.hp-m{border-color:rgba(34,197,94,.45);color:#22c55e;background:rgba(34,197,94,.12)}',
    '.hp-tag.hp-w{background:#f5f5f2;color:#0a0a0c;border-color:#f5f5f2;font-size:13px}',
    '.hp-ok{display:inline-flex;align-items:center;gap:7px;color:#22c55e;font:700 20px/1 Inter,sans-serif;white-space:nowrap}.hp-ok svg{width:20px;height:20px}',
    '.hp-wait{color:#93c5fd;font:700 20px/1 Inter,sans-serif;white-space:nowrap}',
    '.hp-btnw{padding:9px 18px;border-radius:999px;background:#f5f5f2;color:#0a0a0c;font:700 19px/1 Inter,sans-serif;white-space:nowrap}',
    '.hp-big{font:800 56px/1 Inter,sans-serif;letter-spacing:-.03em}',
    '.hp-bar{height:16px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:18px}',
    '.hp-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#2563eb,#60a5fa);border-radius:999px}',
    '.hp-allok{margin-top:22px;display:flex;align-items:center;gap:14px;padding:22px;border-radius:26px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:#22c55e;font:700 26px/1 Inter,sans-serif;opacity:0}.hp-allok svg{width:30px;height:30px}',
    '.hp-ban{position:absolute;left:18px;right:18px;top:16px;z-index:9;background:rgba(44,44,48,.97);color:#f5f5f2;border-radius:30px;padding:18px 20px;display:flex;gap:16px;align-items:center;box-shadow:0 22px 44px rgba(0,0,0,.5);opacity:0}',
    '.hp-ban .hp-lg{width:52px;height:52px;border-radius:14px}',
    '.hp-ban > div{flex:1;min-width:0}',
    '.hp-bt{display:flex;justify-content:space-between;font:700 17px/1.2 Inter,sans-serif;letter-spacing:.06em;color:rgba(245,245,242,.6)}.hp-bt span+span{letter-spacing:0;font-weight:500}',
    '.hp-ban p+p{font:600 21px/1.3 Inter,sans-serif;margin-top:4px!important}',
    '.hp-banl{top:100px;background:rgba(250,250,252,.98);color:#111;box-shadow:0 22px 44px rgba(0,0,0,.22)}.hp-banl .hp-bt{color:#6e6e73}',
    '.hp-mi{flex:none;width:52px;height:52px;border-radius:13px;background:linear-gradient(#5ac8fa,#007aff);display:grid;place-items:center;color:#fff}.hp-mi svg{width:30px;height:30px}',
    /* website */
    '.hp-wnav{display:flex;align-items:center;justify-content:space-between;padding:14px 32px 18px;border-bottom:1px solid rgba(255,255,255,.12)}',
    '.hp-hb{display:flex;flex-direction:column;gap:8px}.hp-hb i{width:38px;height:3px;border-radius:2px;background:#f5f5f2}',
    '.hp-wproof{display:flex;justify-content:center;align-items:center;gap:18px;margin-top:32px}',
    '.hp-avs{display:flex;padding-left:14px}.hp-avs i{width:54px;height:54px;border-radius:50%;border:3px solid #000;margin-left:-14px}',
    '.hp-stars{color:#f5b301;font-size:22px;letter-spacing:3px;line-height:1}',
    '.hp-wproof p+p{font:500 20px/1.3 Inter,sans-serif;color:rgba(245,245,242,.85);margin-top:6px!important}',
    '.hp-wh{text-align:center;margin-top:32px!important;font:800 54px/1.04 Inter,sans-serif;letter-spacing:-.045em}.hp-wh span{display:block;color:#a1a1a6}',
    '.hp-steps{display:flex;align-items:center;justify-content:center;margin-top:36px}',
    '.hp-steps b{width:58px;height:58px;border-radius:50%;border:1.5px solid rgba(255,255,255,.3);display:grid;place-items:center;font:500 24px/1 Inter,sans-serif}',
    '.hp-steps b.on{background:#f5f5f2;color:#000;border-color:#f5f5f2}.hp-steps i{width:76px;height:2px;background:rgba(255,255,255,.25)}',
    '.hp-wcard{position:relative;margin:36px 32px 0;background:#141416;border:1px solid rgba(255,255,255,.14);border-radius:30px;height:480px;overflow:hidden}',
    '.hp-wst{position:absolute;inset:30px}',
    '.hp-fl{font:500 22px/1 Inter,sans-serif;color:rgba(245,245,242,.7);margin-bottom:12px!important}',
    '.hp-fi{height:70px;border-radius:16px;background:#000;border:1px solid rgba(255,255,255,.12);margin-bottom:24px;padding:0 20px;display:flex;align-items:center;font:500 26px/1 Inter,sans-serif}.hp-fi.on{border-color:#f5f5f2}',
    '.hp-nx{display:flex;justify-content:flex-end}.hp-nx span{padding:20px 46px;border-radius:999px;background:#5a5a5e;color:#111;font:600 25px/1 Inter,sans-serif}',
    '.hp-opt{display:flex;justify-content:space-between;align-items:center;padding:22px 24px;border-radius:20px;border:1.5px solid rgba(255,255,255,.14);margin-top:16px;font:600 24px/1.2 Inter,sans-serif}',
    '.hp-opt small{display:block;font:500 19px/1.3 Inter,sans-serif;color:rgba(245,245,242,.6);margin-top:4px}',
    '.hp-opt.hp-sel{border-color:#60a5fa;background:rgba(96,165,250,.12)}',
    '.hp-rd{width:34px;height:34px;border-radius:50%;border:2px solid rgba(255,255,255,.35);display:grid;place-items:center}',
    '.hp-sel .hp-rd{background:#2563eb;border-color:#2563eb;color:#fff}.hp-rd svg{width:20px;height:20px}',
    '.hp-okp{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:22px;padding:20px;border-radius:999px;background:#22c55e;color:#06140b;font:700 25px/1 Inter,sans-serif}.hp-okp svg{width:26px;height:26px}',
    '.hp-url{position:absolute;left:96px;right:96px;bottom:44px;text-align:center;padding:20px;border-radius:999px;background:rgba(80,80,84,.9);font:500 24px/1 Inter,sans-serif}',
    /* email */
    '.hp-mnav{position:relative;z-index:3;display:flex;align-items:center;gap:18px;padding:8px 24px 18px;background:#fff;border-bottom:1px solid #e3e3e3}',
    '.hp-bk{flex:none;width:62px;height:62px;border-radius:50%;border:1px solid #ddd;display:grid;place-items:center;font:500 34px/1 Inter,sans-serif;color:#111}',
    '.hp-mnav b{font:700 25px/1.2 Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.hp-mail{margin:24px 22px;background:#fff;border-radius:30px;border:1px solid #e3e3e3;overflow:hidden}',
    '.hp-mh{text-align:center;padding:30px 0 24px;border-bottom:1px solid #eee}.hp-mh b{display:block;font:700 26px/1 Inter,sans-serif;letter-spacing:.16em}.hp-mh span{display:block;margin-top:10px;font:500 15px/1 Inter,sans-serif;letter-spacing:.3em;color:#888}',
    '.hp-mb{padding:30px 32px}.hp-mb h3{font:800 38px/1.1 Inter,sans-serif;letter-spacing:-.02em}',
    '.hp-mb p{margin-top:18px!important;font:400 23px/1.5 Inter,sans-serif;color:#333}',
    '.hp-mbox{margin-top:20px;background:#f4f4f2;border:1px solid #e3e3e0;border-radius:22px;padding:20px 24px;font:500 22px/1.45 Inter,sans-serif;color:#333}.hp-mbox b{display:block;color:#111;margin-bottom:6px}',
    '.hp-mqr{margin:20px auto 0;width:290px;height:290px;padding:24px;border-radius:24px;background:#fff;border:10px solid #f0f0f0}.hp-mqr svg{width:100%;height:100%;display:block}',
    '.hp-join{position:relative;margin-top:26px;padding:24px;border-radius:999px;background:#111;color:#fff;text-align:center;font:700 26px/1 Inter,sans-serif;overflow:hidden}',
    '.hp-joined{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:12px;color:#06140b;opacity:0}.hp-joined svg{width:26px;height:26px}',
    '.hp-mb .hp-small{text-align:center;font-size:19px;color:#888}',
    /* feed */
    '.hp-cmp{display:flex;gap:14px;align-items:center}',
    '.hp-cin{flex:1;display:flex;align-items:center;gap:14px;padding:12px 16px;border:1px solid rgba(255,255,255,.18);border-radius:999px;font:500 21px/1 Inter,sans-serif;color:rgba(245,245,242,.6)}',
    '.hp-me{width:46px;height:46px;border-radius:50%;background:#6366f1;display:grid;place-items:center;font:700 18px/1 Inter,sans-serif;color:#fff}',
    '.hp-cam{width:68px;height:68px;border-radius:50%;border:1px solid rgba(255,255,255,.18);display:grid;place-items:center}.hp-cam svg{width:30px;height:30px}',
    '.hp-post{margin:24px -32px 0;padding:24px 32px;border-top:1px solid rgba(255,255,255,.08)}',
    '.hp-ph{display:flex;align-items:center;gap:14px}.hp-ph b{font:700 23px/1.2 Inter,sans-serif}.hp-d{display:block;font:500 18px/1.2 Inter,sans-serif;color:rgba(245,245,242,.55);margin-top:3px}',
    '.hp-pt{margin-top:18px!important;font:700 26px/1.25 Inter,sans-serif}',
    '.hp-pb{margin-top:8px!important;font:500 22px/1.45 Inter,sans-serif;color:rgba(245,245,242,.88)}',
    '.hp-re{display:flex;gap:30px;margin-top:18px;font:600 22px/1 Inter,sans-serif;align-items:center}.hp-re span{display:inline-flex;gap:10px;align-items:center}.hp-re i{font-style:normal}.hp-re svg{width:32px;height:32px}',
    '.hp-sent{display:inline-flex;align-items:center;gap:10px;margin-top:18px;padding:10px 18px;border-radius:999px;background:rgba(34,197,94,.12);color:#22c55e;font:700 19px/1 Inter,sans-serif;opacity:0}.hp-sent svg{width:20px;height:20px}',
    '.hp-cm{display:flex;gap:14px;margin-top:16px;opacity:0}',
    '.hp-a{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font:700 16px/1 Inter,sans-serif;color:#fff}',
    '.hp-cm > div{flex:1;background:#17171a;border-radius:22px;padding:14px 18px}.hp-cm b{display:block;font:700 19px/1.2 Inter,sans-serif}.hp-cm p{font:500 19px/1.35 Inter,sans-serif;color:rgba(245,245,242,.75);margin-top:3px!important}',
    /* class pass */
    '.hp-av{width:190px;height:190px;margin:6px auto 0;border-radius:50%;background:#222225;border:3px solid #9a9a9d;display:grid;place-items:center;font:500 80px/1 Inter,sans-serif;position:relative}',
    '.hp-av em{position:absolute;right:-4px;bottom:6px;width:52px;height:52px;border-radius:50%;background:#f5f5f2;border:3px solid #0a0a0c;display:grid;place-items:center;color:#0a0a0c}.hp-av em svg{width:24px;height:24px}',
    '.hp-nm{text-align:center;margin-top:20px!important;font:700 32px/1.1 Inter,sans-serif}',
    '.hp-mp{display:flex;justify-content:center;margin-top:14px!important}.hp-mp span{display:inline-flex;align-items:center;gap:10px;padding:8px 18px;border:1px solid rgba(255,255,255,.2);border-radius:999px;font:600 19px/1 Inter,sans-serif}',
    '.hp-mp span::before{content:"";width:10px;height:10px;border-radius:50%;background:#22c55e}',
    '.hp-sts{display:flex;justify-content:center;margin-top:26px}.hp-sts div{width:150px;text-align:center}.hp-sts div+div{border-left:1px solid rgba(255,255,255,.15)}',
    '.hp-sts b{display:block;font:700 30px/1 Inter,sans-serif}.hp-sts span{display:block;margin-top:8px;font:500 18px/1 Inter,sans-serif;color:rgba(245,245,242,.6)}',
    '.hp-qrc{position:relative;height:420px;border-radius:30px;background:#000;border:1px solid rgba(255,255,255,.12);display:grid;place-items:center;overflow:hidden}',
    '.hp-qrc > svg{width:300px;height:300px}',
    '.hp-scan{position:absolute;left:150px;right:150px;height:6px;border-radius:6px;background:#60a5fa;box-shadow:0 0 26px 6px rgba(96,165,250,.6);opacity:0}',
    '.hp-done{position:absolute;inset:0;background:#06140b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;opacity:0}',
    '.hp-ck{width:120px;height:120px;border-radius:50%;background:#22c55e;display:grid;place-items:center;color:#06140b}.hp-ck svg{width:64px;height:64px}',
    '.hp-done b{font:700 32px/1 Inter,sans-serif}.hp-done span{font:500 21px/1 Inter,sans-serif;color:rgba(245,245,242,.7)}',
    /* sms */
    '.hp-v.hp-light.hp-white{background:#fff}',
    '.hp-snav{text-align:center;padding:6px 0 20px;border-bottom:1px solid #eee;background:#fff}',
    '.hp-sa{display:grid;place-items:center;width:100px;height:100px;margin:0 auto;border-radius:50%;background:linear-gradient(135deg,#2563eb,#60a5fa)}.hp-sa svg{width:56%;height:56%}',
    '.hp-snav b{display:inline-block;margin-top:12px;padding:10px 22px;border:1px solid #e3e3e3;border-radius:999px;font:700 23px/1 Inter,sans-serif}',
    '.hp-smeta{text-align:center;font:500 18px/1.4 Inter,sans-serif;color:#8e8e93;margin:26px 0 12px!important}',
    '.hp-sin{margin:0 0 0 26px!important;max-width:78%;background:#e9e9eb;border-radius:32px;padding:18px 24px;font:400 25px/1.38 Inter,sans-serif;color:#000;opacity:0;transform-origin:0 0}',
    '.hp-sout{margin:16px 26px 0 auto!important;max-width:66%;background:#34c759;color:#fff;border-radius:32px;padding:18px 24px;font:400 25px/1.38 Inter,sans-serif;opacity:0;transform-origin:100% 0}',
    '.hp-styp{margin-left:26px;display:inline-flex;gap:8px;padding:22px 24px;border-radius:32px;background:#e9e9eb}.hp-styp i{width:12px;height:12px;border-radius:50%;background:#8e8e93}',
    '.hp-sinp{position:absolute;left:24px;right:24px;bottom:44px;display:flex;gap:16px;align-items:center}.hp-sinp span{width:70px;height:70px;border-radius:50%;border:1px solid #ddd;display:grid;place-items:center;font:300 40px/1 Inter,sans-serif;color:#111}.hp-sinp div{flex:1;padding:20px 26px;border:1px solid #ddd;border-radius:999px;font:400 26px/1 Inter,sans-serif;color:#b0b0b5}',
    /* payment setup */
    '.hp-v.hp-ov{overflow:visible;z-index:7}',
    '.hp-ap{display:inline-flex;align-items:center;gap:2px;font:600 34px/1 -apple-system,Inter,sans-serif;letter-spacing:-.01em}.hp-ap svg{width:34px;height:34px;margin-top:-6px}',
    '.hp-apb{display:flex;justify-content:center;align-items:center;height:92px;border-radius:22px;background:#fff;color:#000}',
    '.hp-sheet{position:absolute;left:-32px;right:-32px;bottom:-120px;z-index:8;background:#1c1c1e;border-radius:44px 44px 0 0;padding:30px 34px 60px;box-shadow:0 -20px 60px rgba(0,0,0,.6);transform:translateY(110%)}',
    '.hp-shh{display:flex;justify-content:space-between;align-items:center;padding-bottom:22px;border-bottom:1px solid rgba(255,255,255,.1)}.hp-shh .hp-ap{font-size:38px;color:#fff}.hp-shh > span:last-child{font:500 24px/1 Inter,sans-serif;color:#0a84ff}',
    '.hp-shr{display:flex;gap:20px;align-items:center;padding:22px 0;border-bottom:1px solid rgba(255,255,255,.1)}.hp-shr b{display:block;font:600 24px/1.2 Inter,sans-serif}.hp-shr div span{display:block;font:500 19px/1.3 Inter,sans-serif;color:rgba(245,245,242,.6);margin-top:4px}',
    '.hp-visa{flex:none;width:76px;height:50px;border-radius:8px;background:linear-gradient(135deg,#1a1f71,#2b48c4);color:#fff;display:grid;place-items:center;font:italic 800 17px/1 Inter,sans-serif;letter-spacing:.04em}',
    '.hp-shl{flex:none;width:50px;height:50px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#60a5fa);display:grid;place-items:center}.hp-shl svg{width:60%;height:60%}',
    '.hp-shc{display:flex;flex-direction:column;align-items:center;gap:16px;padding-top:30px}.hp-shc b{font:600 23px/1 Inter,sans-serif;color:rgba(245,245,242,.85)}',
    '.hp-fid{position:relative;width:86px;height:86px;border-radius:50%;border:4px solid rgba(255,255,255,.35);display:grid;place-items:center}',
    '.hp-fid i{width:40px;height:22px;border-left:6px solid #fff;border-bottom:6px solid #fff;transform:rotate(-45deg) translate(3px,-4px);opacity:0}',
    /* register, members */
    '.hp-tag.hp-new{border-color:rgba(96,165,250,.5);color:#93c5fd;background:rgba(96,165,250,.16)}',
    '.hp-pill{padding:8px 16px;border-radius:999px;font:700 18px/1 Inter,sans-serif;white-space:nowrap}.hp-pg{background:rgba(34,197,94,.14);color:#22c55e}.hp-pa{background:rgba(245,158,11,.16);color:#fbbf24}',
    '.hp-call{display:grid;place-items:center;width:58px;height:58px;border-radius:50%;background:#22c55e;color:#06140b}.hp-call svg{width:28px;height:28px}',
    /* chat */
    '.hp-chat2{display:flex;flex-direction:column;gap:12px}',
    '.hp-next{margin-top:26px}.hp-msg{min-height:150px;font:500 24px/1.4 Inter,sans-serif;color:#f5f5f2}',
    '.hp-car{display:inline-block;width:3px;height:28px;margin-left:2px;vertical-align:-5px;background:#f5f5f2}',
    '.hp-send{margin-top:22px;height:84px;border-radius:999px;background:#f5f5f2;color:#0a0a0c;display:grid;place-items:center;font:700 26px/1 Inter,sans-serif}',
    '.hp-bm{align-self:flex-end;max-width:82%;padding:16px 22px;border-radius:30px;background:#f1f1ee;color:#0a0a0c;font:500 22px/1.35 Inter,sans-serif;opacity:0}',
    '.hp-bt2{display:flex;gap:12px;align-items:flex-end;opacity:0}.hp-bt2 .hp-lg{width:44px;height:44px}.hp-bt2 p{max-width:82%;padding:16px 22px;border-radius:26px;background:#131316;border:1px solid rgba(255,255,255,.12);font:500 22px/1.38 Inter,sans-serif}',
    /* caption under the phone */
    '.hp-cap{position:relative;height:1.5em;margin-top:18px;text-align:center;font-weight:600;font-size:15px;color:var(--ink-2,#55555a)}',
    '.hp-cap span{position:absolute;left:0;right:0;transition:opacity .35s,transform .35s;opacity:0;transform:translateY(6px)}.hp-cap span.on{opacity:1;transform:none}'
  ].join('');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* One phone per host: the hero cycles through every screen with a caption;
     each card in the app section ([data-hp-screen]) replays its one screen. */
  function mount(host, list, cap, row, labels) {
    var scr = list.map(function (id) { return SCREENS.filter(function (s) { return s.id === id; })[0]; });
    host.innerHTML = '<div class="hp-box"><div class="hp-in"><div class="hp-phone"><div class="hp-scr">' + sbar() +
      '<div class="hp-hd">' + LOGO + '<span>' + IC.bell + '</span></div>' +
      scr.map(function (s) { return '<div class="hp-v' + (s.full ? ' hp-full' : '') + (s.light ? ' hp-light' : '') + (s.id === 'sms' ? ' hp-white' : '') + (s.ov ? ' hp-ov' : '') + '" id="hp-' + s.id + '">' + s.html + '</div>'; }).join('') +
      '<div class="hp-tb"><i>' + IC.home + '</i><i>' + IC.cal + '</i><i>' + IC.chat + '</i><i>' + IC.shop + '</i><i class="hp-qrb">' + IC.qr + '</i></div>' +
      '</div></div></div></div><p class="hp-cap">' + scr.map(function (s) { return '<span>' + ((labels && labels[s.id]) || s.label) + '</span>'; }).join('') + '</p>';

    host.innerHTML = host.innerHTML.replace(/ id="(hp-[^"]+)"/g, ' data-k="$1"');
    if (!cap) { var cp = host.querySelector('.hp-cap'); if (cp) cp.remove(); }
    var $ = function (id) { return host.querySelector('[data-k="' + id + '"]'); };
    var inner = host.querySelector('.hp-in'), box = host.querySelector('.hp-box');
    var views = scr.map(function (s) { return $('hp-' + s.id); });
    var caps = [].slice.call(host.querySelectorAll('.hp-cap span')), tabs = [].slice.call(host.querySelectorAll('.hp-tb i'));
    function fit() { inner.style.transform = 'scale(' + (box.clientWidth / 720) + ')'; }
    fit(); window.addEventListener('resize', fit);

    function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function eo(x) { x = cl(x); return 1 - Math.pow(1 - x, 3); }
    function pop(x) { x = cl(x); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
    function p(t, a, d) { return cl((t - a) / d); }
    function show(el, o, tr) { if (!el) return; el.style.opacity = o; el.style.transform = tr || ''; }
    function banner(el, u, a, b) { var k = pop(p(u, a, .45)), out = p(u, b, .3); show(el, cl(k * 1.5) * (1 - out), 'translateY(' + (-150 * (1 - k) - 150 * out) + 'px)'); }
    var green = function (g) { return 'rgb(' + Math.round(17 + (34 - 17) * g) + ',' + Math.round(17 + (197 - 17) * g) + ',' + Math.round(17 + (94 - 17) * g) + ')'; };

    var A = {
      web: function (u) {
        var n = Math.floor(cl((u - .3) / .45) * 3 + .001);
        $('hp-fnt').textContent = 'Ava'.slice(0, n); $('hp-fat').textContent = u > 1.05 ? '7' : '';
        $('hp-fn').classList.toggle('on', u < 1); $('hp-fa').classList.toggle('on', u >= 1 && u < 1.4);
        $('hp-nx').style.background = u > 1.15 ? '#f5f5f2' : '#5a5a5e'; $('hp-nx').style.transform = 'scale(' + (u > 1.35 && u < 1.47 ? .94 : 1) + ')';
        var sw = eo(p(u, 1.5, .3)); show($('hp-w1'), 1 - sw, 'translateX(' + (-60 * sw) + 'px)'); show($('hp-w2'), sw, 'translateX(' + (60 * (1 - sw)) + 'px)');
        $('hp-st2').classList.toggle('on', u > 1.5);
        var k = pop(p(u, 2.0, .4)); show($('hp-okp'), cl(k * 1.4), 'scale(' + (.9 + .1 * k) + ')');
      },
      mail: function (u) { banner($('hp-b-mail'), u, .1, 1.0); },
      follow: function (u) {
        banner($('hp-b-follow'), u, .1, 1.0);
        var g = eo(p(u, 1.8, .3)); $('hp-join').style.background = green(g); $('hp-join').style.transform = 'scale(' + (u > 1.65 && u < 1.8 ? .96 : 1) + ')';
        $('hp-joint').style.opacity = 1 - g; $('hp-joined').style.opacity = g;
      },



      qrs: function (u) {
        var sc = $('hp-scan'), a = .5, b = 1.4, k = p(u, a, b - a);
        sc.style.opacity = u > a && u < b + .1 ? 1 : 0; sc.style.top = (60 + 300 * (.5 - .5 * Math.cos(k * Math.PI * 2))) + 'px';
        $('hp-done').style.opacity = eo(p(u, b, .3)); $('hp-done').querySelector('.hp-ck').style.transform = 'scale(' + pop(p(u, b + .05, .45)) + ')';
      },
      sms: function (u) {
        $('hp-sty').style.display = u < .8 ? 'inline-flex' : 'none';
        [].forEach.call($('hp-sty').children, function (d, i) { d.style.opacity = .35 + .65 * (.5 + .5 * Math.sin(u * 10 - i * 1.2)); });
        var a = pop(p(u, .8, .4)); show($('hp-sin'), cl(a * 1.4), 'scale(' + (.92 + .08 * a) + ')');
        var b = pop(p(u, 1.8, .4)); show($('hp-sout'), cl(b * 1.4), 'scale(' + (.92 + .08 * b) + ')');
      },
      payset: function (u) {
        $('hp-apb').style.transform = 'scale(' + (u > .7 && u < .85 ? .95 : 1) + ')';
        var up = eo(p(u, .85, .4)), down = eo(p(u, 2.35, .35));
        $('hp-sheet').style.transform = 'translateY(' + (110 * (1 - up) + 110 * down) + '%)';
        var conf = p(u, 1.5, .5), done = u > 2.0, fid = $('hp-fid');
        fid.style.borderColor = done ? '#30d158' : 'rgba(255,255,255,' + (.35 + .5 * Math.abs(Math.sin(conf * Math.PI * 2))) + ')';
        fid.style.background = done ? '#30d158' : 'transparent';
        fid.firstChild.style.opacity = done ? 1 : 0;
        $('hp-sht').textContent = done ? 'Done' : 'Confirm with Side Button';
        var a = pop(p(u, 2.5, .45)); show($('hp-payok'), cl(a * 1.4), 'scale(' + (.92 + .08 * a) + ')');
      },
      reg: function (u) {
        var k = pop(p(u, .7, .45)); show($('hp-avr'), cl(k * 1.4), 'translateX(' + (60 * (1 - k)) + 'px)');
        $('hp-avr').style.background = 'rgba(96,165,250,' + (.16 * (1 - p(u, 1.8, .7))) + ')';
        var c = u > .7 ? 19 : 18; $('hp-rc').textContent = c; $('hp-rbar').style.width = (c / 20 * 100) + '%';
        banner($('hp-b-reg'), u, .8, 2.3);
      },
      feed: function (u) {
        banner($('hp-b-feed'), u, .1, 1.1);
        var h = Math.round(14 * eo(p(u, .5, 1.3))); $('hp-hc').textContent = h; $('hp-hrt').firstChild.outerHTML = h > 0 ? IC.heartf : IC.heart;
        $('hp-cc').textContent = u > 1.2 ? 3 : 0;
        var s = pop(p(u, .45, .4)); show($('hp-sent'), cl(s * 1.4), 'scale(' + (.9 + .1 * s) + ')');
        [['hp-m1', 1.2], ['hp-m2', 1.9]].forEach(function (c) { var k = eo(p(u, c[1], .35)); show($(c[0]), k, 'translateY(' + (20 * (1 - k)) + 'px)'); });
      },
      mem: function (u) {
        var pz = u > 1.0; $('hp-leo').textContent = pz ? 'Paused' : 'Pause'; $('hp-leo').style.background = pz ? 'rgba(245,245,242,.18)' : '#f5f5f2'; $('hp-leo').style.color = pz ? '#f5f5f2' : '#0a0a0c';
        $('hp-leo').style.transform = 'scale(' + (u > .85 && u < 1.0 ? .92 : 1) + ')';
        var sl = u > 1.8; $('hp-mia').innerHTML = sl ? T + 'Sent' : 'Send link'; $('hp-mia').className = sl ? 'hp-ok' : 'hp-btnw';
        $('hp-mia').style.transform = 'scale(' + (u > 1.65 && u < 1.8 ? .92 : 1) + ')';
      },
      notify: function (u) {
        var msg = 'Photo day on Tuesday! Please come in your full club kit.', n = Math.round(msg.length * cl((u - .25) / 1.2));
        $('hp-nt').textContent = msg.slice(0, n); $('hp-car').style.opacity = u < 1.6 && (u * 3 % 1) < .6 ? 1 : 0;
        $('hp-send').style.transform = 'scale(' + (u > 1.65 && u < 1.8 ? .95 : 1) + ')';
        var k = pop(p(u, 1.85, .45)); show($('hp-nok'), cl(k * 1.4), 'scale(' + (.92 + .08 * k) + ')');
      },
      emg: function (u) {
        var r = (u % 1.1) / 1.1; $('hp-call').style.boxShadow = u > 1.2 ? '0 0 0 ' + (18 * r) + 'px rgba(34,197,94,' + (.45 * (1 - r)) + ')' : 'none';
      }
    };

    var SEG = 3.3, N = scr.length, TOTAL = N === 1 ? SEG + 1.4 : SEG * N, cur = -1;
    function seek(t) {
      scr.forEach(function (s, i) {
        var a = i * SEG, u = t - a;
        var fin = i === 0 ? Math.max(p(t, 0, .25), p(t, TOTAL - .25, .25)) : p(t, a, .25); // the first screen also fades in at the loop's end
        var o = Math.min(fin, i === N - 1 ? 1 - p(t, TOTAL - .25, .25) : 1 - p(t, a + SEG - .2, .25));
        if (i === 0 && t > TOTAL - .3) { u = 0; }
        // A card in the swipe row is one screen: always on, never fading
        // through black, so its first frame is already there before it plays.
        views[i].style.opacity = row ? 1 : o;
        if (u > -.3 && u < SEG + .3) A[s.id](u);
      });
      var c = Math.max(0, Math.min(N - 1, Math.floor(t / SEG)));
      if (c !== cur) {
        cur = c; caps.forEach(function (e, i) { e.classList.toggle('on', i === c); });
        tabs.forEach(function (e, i) { e.classList.toggle('on', i === scr[c].tab && i < 4); });
      }
    }

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var visible = true, start = performance.now(), paused = 0, raf = 0;
    function frame(now) {
      var t = (((now - start) / 1000) % TOTAL + TOTAL) % TOTAL;
      if (reduce) t = Math.floor(t / SEG) * SEG + SEG - .3;
      seek(t); raf = requestAnimationFrame(frame);
    }
    function run(on) {
      if (row) {
        // A row card plays from its first frame each time it reaches the
        // middle, and goes back to that first frame when it leaves.
        if (on && !raf) { start = performance.now(); raf = requestAnimationFrame(frame); }
        else if (!on && raf) { cancelAnimationFrame(raf); raf = 0; if (!reduce) seek(0); }
        return;
      }
      if (on && !raf) { start += performance.now() - paused; raf = requestAnimationFrame(frame); }
      else if (!on && raf) { cancelAnimationFrame(raf); raf = 0; paused = performance.now(); }
    }
    /* In the app section's swipe row only the card nearest the middle
       plays; the others hold still until they are swiped to the centre
       (see centreRow below). */
    var centred = !row;
    function go() { run(visible && centred && !document.hidden); }
    // The hero's Coaches / Parents switch: start the newly shown phone from its first screen.
    host._hpReset = function () { fit(); start = paused = performance.now(); seek(0); };
    host._hpCentre = function (on) { if (on !== centred) { centred = on; go(); } };
    seek(reduce ? SEG - .3 : row ? 0 : 2.6); paused = performance.now();
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; go(); }, { threshold: .05 }).observe(host);
    else { visible = true; go(); }
    document.addEventListener('visibilitychange', go);
  }
  /* The hero shows one side of the app at a time: what coaches use, or what
     parents see. The switch above the phone swaps between the two. */
  var ROLES = {
    coaches: { list: ['reg', 'notify', 'emg', 'feed', 'mem'], labels: {
      reg: 'New members land on your registers', emg: 'Medical notes and contacts, one tap away',
      feed: 'Post to every parent, reply in one place' } },
    parents: { list: ['web', 'mail', 'sms', 'follow', 'payset', 'qrs', 'feed'], labels: {
      payset: 'They join and pay in a tap', qrs: 'Their next class and QR code',
      feed: 'Club news, and a chat with the coach' } }
  };
  var heroes = [].slice.call(document.querySelectorAll('[data-hp-role]'));
  heroes.forEach(function (h) { var r = ROLES[h.getAttribute('data-hp-role')]; mount(h, r.list, true, null, r.labels); });
  var roleBtns = [].slice.call(document.querySelectorAll('[data-hp-show]'));
  roleBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var want = b.getAttribute('data-hp-show');
      roleBtns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      heroes.forEach(function (h) {
        var on = h.getAttribute('data-hp-role') === want;
        if (on === !h.hidden) return;
        h.hidden = !on; if (on) h._hpReset();
      });
    });
  });
  [].forEach.call(document.querySelectorAll('[data-hp-screen]'), function (el) { mount(el, [el.getAttribute('data-hp-screen')], false, el.closest('.ap-row')); });

  /* Exactly one card in each swipe row is "centred": the one whose middle
     is nearest the row's middle. Checked on scroll and resize. */
  [].forEach.call(document.querySelectorAll('.ap-row'), function (row) {
    var hosts = [].slice.call(row.querySelectorAll('[data-hp-screen]'));
    if (!hosts.length) return;
    var queued = false;
    function centreRow() {
      queued = false;
      var r = row.getBoundingClientRect(), mid = r.left + r.width / 2, best = null, bestD = Infinity;
      hosts.forEach(function (h) { var b = h.getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - mid); if (d < bestD) { bestD = d; best = h; } });
      hosts.forEach(function (h) { if (h._hpCentre) h._hpCentre(h === best); });
    }
    function later() { if (!queued) { queued = true; requestAnimationFrame(centreRow); } }
    row.addEventListener('scroll', later, { passive: true });
    window.addEventListener('resize', later);
    centreRow();
  });
})();
