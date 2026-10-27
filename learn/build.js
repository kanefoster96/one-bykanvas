/* The Learning Centre: kanvas.one/learn and its guides for club owners.
 *
 * Each guide is plain HTML in GUIDES below, written by a club owner for club
 * owners, and ends with how One does the same thing for you. This file wraps
 * them in the site's head, nav and footer and writes learn/index.html and
 * learn/<slug>.html. `npm run stamp` runs it, then stamps the asset versions.
 * Numbers quoted from our own academy are real; keep them that way.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://kanvas.one';
const UPDATED = '2026-10-19';
const UPDATED_TEXT = '19 October 2026';

const TERMS = require('./terms.js');
const ESC = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘').replace(/&pound;/g, '£').replace(/&amp;/g, '&').replace(/&ndash;/g, '–').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/* A "Business word" box: the word as a heading, what it means underneath,
   from learn/terms.js (the same words glossary.js underlines). On the word
   list itself each box is an anchor instead of a link to it. */
function term(key, onList) {
  const t = TERMS[key];
  if (!t) throw new Error('learn: no business word "' + key + '" in terms.js');
  return `<div class="lc-term"${onList ? ` id="${key}"` : ''} data-no-gl data-gl-shown="${key}"><span class="k">Business word</span><b>${t.title}</b><p>${ESC(t.text)}</p>${onList ? '' : `<a href="/learn/club-business-words#${key}">All the business words &rsaquo;</a>`}</div>`;
}
const WORD_LIST = Object.keys(TERMS).sort((a, b) => TERMS[a].title.localeCompare(TERMS[b].title)).map((k) => term(k, true)).join('\n');

/* ---------- Figures ----------
   Small pictures that explain a point, built here so every guide draws them
   the same way. learn.css styles them; learn.js animates each one once as it
   comes into view (data-lc-in). Numbers in them must be real, like the text. */

const ICONS = {
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01',
  ticket: 'M3 9a3 3 0 0 0 0 6v3h18v-3a3 3 0 0 1 0-6V6H3zM14 6v12',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  shirt: 'M8 3l4 2 4-2 5 3-2 4-2-1v12H7V9L5 10 3 6z',
  gift: 'M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z',
  chart: 'M3 17l6-6 4 4 8-8M14 7h7v7',
  message: 'M21 12a8 8 0 0 1-11.8 7L4 20l1-5.2A8 8 0 1 1 21 12z',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4'
};
const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[k]}"/></svg>`;

/* Rows of [label, value, shown, hot]: bars scaled to the biggest value. */
function bars(title, rows, note) {
  const max = Math.max(...rows.map((r) => r[1]));
  return `<figure class="lc-bars" data-lc-in data-no-gl aria-label="${ESC(plain(title))}">
  <p class="lc-fig-h">${title}</p>
  ${rows.map(([l, v, shown, hot], i) => `<div class="lc-bar${hot ? ' hot' : ''}" style="--i:${i}"><span class="l">${l}</span><b>${shown == null ? v : shown}</b><span class="t"><i style="--w:${(v / max * 100).toFixed(1)}%"></i></span></div>`).join('\n  ')}
  ${note ? `<p class="lc-fig-note">${note}</p>` : ''}
</figure>`;
}

/* Steps of [big, small, hot], each leading to the next. */
function chain(title, steps) {
  return `<figure class="lc-chain" data-lc-in data-no-gl aria-label="${ESC(plain(title))}">
  <p class="lc-fig-h">${title}</p>
  <ol>${steps.map(([b, s, hot], i) => `<li${hot ? ' class="hot"' : ''} style="--i:${i}"><b>${b}</b><span>${s}</span></li>`).join('')}</ol>
</figure>`;
}

/* Two sides of a choice. kind 'fix': a is the problem (crosses), b the fix
   (ticks). kind 'plain': two options side by side. */
function compare(kind, a, b) {
  const side = (x, k) => `<div class="lc-side ${k}"><p class="h">${x.h}</p>${x.sub ? `<p class="s">${x.sub}</p>` : ''}<ul>${x.items.map((t) => `<li>${t}</li>`).join('')}</ul></div>`;
  return `<div class="lc-compare ${kind}" data-lc-in data-no-gl>${side(a, 'a')}${side(b, 'b')}</div>`;
}

/* Cards of [icon, title, text]. */
function grid(items) {
  return `<div class="lc-grid" data-lc-in data-no-gl>${items.map(([ic, t, d], i) => `<div class="lc-gi" style="--i:${i}"><span class="ic">${icon(ic)}</span><b>${t}</b>${d ? `<span>${d}</span>` : ''}</div>`).join('')}</div>`;
}

function valueEquation() {
  return `<figure class="lc-eq" data-lc-in data-no-gl aria-label="The value equation: value equals dream outcome times how sure they are they'll get there, divided by how long it takes times effort and risk">
  <p class="lc-fig-h">The value equation</p>
  <div class="lc-eq-row"><span class="lc-eq-v">Value =</span><div class="lc-eq-frac">
    <div class="top"><span><i>&uarr;</i>Dream outcome</span><em>&times;</em><span><i>&uarr;</i>How sure they are they&rsquo;ll get there</span></div>
    <div class="bar"></div>
    <div class="bot"><span><i>&darr;</i>How long it takes</span><em>&times;</em><span><i>&darr;</i>Effort and risk</span></div>
  </div></div>
  <p class="cap">Make the top bigger and the bottom smaller, and your club is worth more to a parent, whatever the price.</p>
</figure>`;
}

/* A member's first year, with the milestone just before the usual dip. */
function firstYear() {
  return `<figure class="lc-months" data-lc-in data-no-gl aria-label="A new member's first year, with a Level 2 milestone at month five">
  <p class="lc-fig-h">A new member&rsquo;s first year</p>
  <ol>${Array.from({ length: 12 }, (_, i) => `<li${i === 4 ? ' class="mile"' : ''} style="--i:${i}">${i + 1}</li>`).join('')}</ol>
  <div class="lc-months-key">
    <p><b>Months 1 to 4:</b> everything&rsquo;s new, and progress is easy to see.</p>
    <p class="hot"><b>Month 5:</b> when families usually drift, so it&rsquo;s when they become a Level 2 dancer.</p>
    <p><b>After that:</b> the next goal is already in sight, like a show, a competition or Level 3.</p>
  </div>
</figure>`;
}

/* A made-up but QR-looking square: three corner markers and a fixed scatter
   of dots, the same on every build. */
function qrSvg() {
  const n = 21, cells = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let on;
    if (finder(x, y)) {
      const fx = x < 7 ? x : x - (n - 7), fy = y < 7 ? y : y - (n - 7);
      on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
    } else on = rnd() > 0.52;
    if (on) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
  }
  return `<svg viewBox="0 0 ${n} ${n}" fill="#1d1d1f" shape-rendering="crispEdges" aria-hidden="true">${cells.join('')}</svg>`;
}

/* The member's pass when a payment has been missed. */
function missedPaymentPass() {
  return `<figure class="lc-phones" data-lc-in data-no-gl>
  <div class="lc-phone" role="img" aria-label="A member's QR pass with a red box: payment missed, with a Pay now button"><div class="scr"><div class="isl"></div><div class="lc-pass">
    <div class="lc-pass-club">Your club</div>
    <div class="lc-pass-who">Ava&rsquo;s pass</div>
    <div class="qr">${qrSvg()}</div>
    <div class="due"><b>Payment missed</b><small>October&rsquo;s payment didn&rsquo;t go through. Please pay before class.</small><span>Pay now</span></div>
    <div class="next"><i></i><span><small>Next class</small><b>Street Dance &middot; Tue 5:30pm</b></span></div>
  </div></div></div>
  <figcaption>What the parent sees while they wait in the queue. The coach&rsquo;s phone shows an alert too, when they scan.</figcaption>
</figure>`;
}

/* One post, landing on three families' lock screens, drawn the way iOS
   shows it: icon, bold title, "now", and up to four lines. */
function postOnce(title, body) {
  const phone = (i) => `<div class="lc-phone"${i === 1 ? '' : ' aria-hidden="true"'}><div class="scr lc-lock"><div class="isl"></div><div class="dt">Tuesday 21 October</div><div class="tm">15:42</div><div class="lc-note-card" style="--i:${i}"><span class="ico"></span><div class="tx"><div class="r"><b>${title}</b><span class="now">now</span></div><div class="bd">${body}</div></div></div></div></div>`;
  return `<figure class="lc-phones fan" data-lc-in data-no-gl aria-label="The same notification arriving on three parents' phones: ${ESC(plain(title))}">
  ${phone(0)}${phone(1)}${phone(2)}
  <figcaption>Post it once. It lands on every family&rsquo;s lock screen.</figcaption>
</figure>`;
}

/* The topics the front page filters by. */
const TOPICS = { trials: 'Getting trials', members: 'Getting members', keeping: 'Keeping members', money: 'Pricing and payments', ads: 'Ads', software: 'Choosing software', running: 'Running your club', start: 'Starting a club' };

/* Every guide ends here. `lead` says which part of One the guide was about. */
function oneBand(lead, points) {
  return `<section class="lc-one band-dark" data-tone="dark">
  <div class="wrap"><div class="lc-col">
    <p class="lc-kicker" style="color:#ff7a3d">How Kanvas One does this for you</p>
    <h2>${lead}</h2>
    <p>Everything in this guide runs inside Kanvas One, set up around how your club already works. You get your own app with your club&rsquo;s name on it, your website, payments, registers and messages in one place, and me to talk to.</p>
    <ul>${points.map((p) => `<li><span>${p}</span></li>`).join('')}</ul>
    <div class="lc-ctas">
      <a class="btn btn-primary" href="/profit-plan">Get my free profit plan</a>
      <a class="lnk" href="#" data-chat-open="Hi Kane, I&rsquo;ve been reading your guides. Can I ask about my club?">Or ask me a question &rsaquo;</a>
    </div>
  </div></div>
</section>`;
}

const GUIDES = [
  {
    slug: 'get-more-trials-to-show-up',
    topic: 'trials',
    title: 'How to get more free trials to turn up at your kids&rsquo; club',
    short: 'Why trials don&rsquo;t turn up',
    docTitle: 'How to Get More Free Trials to Turn Up at Your Kids’ Club | Kanvas One',
    desc: 'Free trials book, then never arrive. The four messages we send before every trial, and why 15 of our last 22 trial bookings turned up.',
    card: 'Trials book and never arrive. The four messages we send before every trial, and the show-up rate they get us.',
    read: 6,
    body: `
<p>If you run a kids&rsquo; club, you&rsquo;ll know this one. A parent books a free trial on Sunday night. You add the child to the register, you plan for them, and on the day nobody comes. No message, no reason.</p>
<p>It isn&rsquo;t that the parent didn&rsquo;t care. They booked because they wanted their child to try it. Somewhere between booking and the day itself, life got in the way.</p>

<h2>Why free trials don&rsquo;t turn up</h2>
<p>Most no-shows come down to a handful of things, and none of them are about your club:</p>
<ul>
  <li><strong>They booked on a whim.</strong> It felt like a great idea at 9pm on the sofa. By Thursday it&rsquo;s just another thing on the list.</li>
  <li><strong>They forgot.</strong> The booking email went to an inbox they barely open.</li>
  <li><strong>The child got nervous.</strong> A new room full of children they don&rsquo;t know is a big deal at six years old, and parents don&rsquo;t want a battle at the door.</li>
  <li><strong>Free feels like nothing to lose.</strong> Nobody has paid, so skipping it doesn&rsquo;t feel like letting anyone down.</li>
</ul>
<p>You can&rsquo;t fix any of those with a better class. You fix them with what happens between the booking and the door.</p>

<h2>The four messages we send before every trial</h2>
<p>At our own club, every trial booking gets four messages before the class. One confirms it, and three remind them, each timed for a reason.</p>

<figure class="lc-flow" aria-label="The four messages a family gets before a free trial">
  <p class="lc-flow-h">From booking to the door</p>
  <ol data-lc-flow>
    <li><span class="dot">1</span><span><span class="when">Straight after booking</span><span class="bub">You&rsquo;re booked in! Ava&rsquo;s free trial is Tuesday at 5:30pm. Just show this QR code when you arrive.</span><span class="chan">Email, with their trial pass</span></span></li>
    <li><span class="dot">2</span><span><span class="when">The evening before</span><span class="bub">Reminder: Ava&rsquo;s free trial is tomorrow at 5:30pm. Comfy clothes and a water bottle. See you there!</span><span class="chan">Text, or a notification if they have the app</span></span></li>
    <li><span class="dot">3</span><span><span class="when">9am on the day</span><span class="bub">Today&rsquo;s the day! Ava&rsquo;s free trial is at 5:30pm.</span><span class="chan">Text</span></span></li>
    <li><span class="dot">4</span><span><span class="when">An hour before</span><span class="bub">Coach Jess will be at the door to meet Ava at 5:30pm.</span><span class="chan">Text</span></span></li>
    <li class="end"><span class="dot">&#10003;</span><span><span class="when">5:30pm</span><span class="bub">Ava is checked in</span></span></li>
  </ol>
</figure>

<h3>1. The confirmation, straight away</h3>
<p>The moment they book, they get an email with a trial pass and a QR code to show at the door. It makes the booking feel real, and it gives them something to come back to.</p>
<h3>2. The evening before</h3>
<p>A short text the night before. It lands while they&rsquo;re planning tomorrow, which is exactly when they need it. Families who have your app get it as a notification instead, so nobody gets reminded twice.</p>
<h3>3. 9am on the day</h3>
<p>A quick &ldquo;today&rsquo;s the day&rdquo; text, early enough to plan the afternoon around.</p>
<h3>4. An hour before, with the coach&rsquo;s name</h3>
<p>This is the one that matters most, and it does almost nothing. It doesn&rsquo;t remind them of the time or tell the child not to be nervous. It just says a named coach will be waiting at the door.</p>
<div class="lc-msg"><small>Text, 4:30pm</small>Coach Jess will be at the door to meet Ava at 5:30pm.</div>
<p>That turns &ldquo;we might pop along&rdquo; into an appointment with a real person who is expecting them. A spot has been kept for their child, and someone will notice if they don&rsquo;t come. People turn up for people.</p>

<div class="lc-callout"><p>Reminding people helps. Making them feel expected is what gets them through the door.</p></div>

<h2>Our numbers</h2>
<p>Here&rsquo;s how many of our trial bookings have actually turned up since we started sending all four messages.</p>
<div class="lc-stats">
  <div class="lc-stat"><b>4</b><span>messages before every trial</span></div>
  <div class="lc-stat"><b>22</b><span>trial bookings whose date has passed</span></div>
  <div class="lc-stat hot"><b>15</b><span>of them turned up: 68%</span></div>
</div>
<p class="lc-note">Our own club, 1 September to 19 October 2026. Counted from check-ins on the register, not from bookings.</p>
<p>That number has a name in business: your show-up rate. It&rsquo;s worth knowing yours.</p>
${term('showup')}
<p>Two in every three families who book a free trial with us walk through the door. If you&rsquo;re seeing far fewer than that, the gap is usually in the days between booking and the class, not in the class itself.</p>

<h2>What to do when someone still doesn&rsquo;t come</h2>
<p>Some won&rsquo;t, and that&rsquo;s fine. The worst thing you can do is nothing, because a no-show is still a family who wanted to come.</p>
<ul>
  <li><strong>The next day, offer another date.</strong> One friendly message with a link to rebook. No guilt, no &ldquo;we missed you&rdquo;.</li>
  <li><strong>If that goes quiet, ask why.</strong> A one-tap question: was it the day, the time, or something else? You&rsquo;ll learn more from those answers than from any survey.</li>
  <li><strong>After a trial they did come to, follow up within a day.</strong> Ask how it went and send the link to join while it&rsquo;s still fresh.</li>
</ul>

<h2>A quick checklist</h2>
<ol>
  <li>Send a confirmation the moment they book, with something to show at the door.</li>
  <li>Remind them the evening before.</li>
  <li>Remind them on the morning of the class.</li>
  <li>An hour before, tell them who will be waiting for them.</li>
  <li>Rebook no-shows the next day, and ask the quiet ones why.</li>
</ol>
<p>You can do all of this by hand with a phone and a spreadsheet. It just has to happen every time, for every booking, including the ones made at 11pm.</p>`,
    one: ['All four messages go out on their own, for every trial booking, at the right times.', 'The coach&rsquo;s name comes from your timetable, so the hour-before text is always right.', 'No-shows get a rebooking link the next day, then a one-tap &ldquo;what got in the way?&rdquo;.', 'Families who came get a follow-up with the link to join.', 'Texts and calls come out of a &pound;5 monthly allowance that&rsquo;s included.'],
    oneLead: 'Every trial gets all four messages. <span>Automatically.</span>',
    faq: [
      ['How many reminders should I send before a free trial?', 'We send four messages: a confirmation straight after booking, a reminder the evening before, one at 9am on the day, and one an hour before that names the coach who will meet them. 15 of our last 22 trial bookings turned up.'],
      ['Should trial reminders be texts or emails?', 'Both have a job. The confirmation works best as an email, because it carries the trial pass and QR code. The reminders work best as texts, because most people read a text within minutes. Families with your app can get notifications instead.'],
      ['What should I do when a trial doesn&rsquo;t turn up?', 'Message them the next day with a link to pick another date, without any guilt. If that goes quiet, ask with one tap what got in the way. Many families just had a busy week.']
    ],
    related: ['get-more-members-kids-club', 'are-facebook-ads-worth-it-for-kids-clubs']
  },

  {
    slug: 'get-more-members-kids-club',
    topic: 'members',
    title: 'How to get more members in your kids&rsquo; club',
    short: 'Getting more members',
    docTitle: 'How to Get More Members in Your Kids’ Club: 7 Things That Work | Kanvas One',
    desc: 'If your classes aren’t full, it’s rarely because nobody wants them. Seven things that grow a kids’ club, from a club owner who uses them every week.',
    card: 'If your classes aren&rsquo;t full, it&rsquo;s rarely because nobody wants them. Seven things that grow a club.',
    read: 7,
    body: `
<p>If your classes aren&rsquo;t full, it&rsquo;s very rarely because nobody wants what you do. Every street near you has families with children they want to grow in confidence, make friends and be good at something.</p>
<p>When a club stays small, it&rsquo;s nearly always one of three things:</p>
${grid([['search', 'They don&rsquo;t know you exist', 'Word of mouth only reaches people who already know someone.'], ['phone', 'They don&rsquo;t know how to join', 'Or it looks like hard work to find out.'], ['clock', 'There&rsquo;s no reason to start now', 'Nothing nudges them into taking the first step.']])}
<p>Everything below fixes one of those three.</p>

<h2>1. Make the first step free</h2>
<p>Asking a parent to commit to a monthly fee for a class their child has never tried is a big ask. Asking them to come and try it for free is an easy yes.</p>
<p>A free trial takes away the risk. The child gets to see the room and meet the coach, and the parent gets to see their child enjoying it. That&rsquo;s what sells the membership, not anything you could write on a poster.</p>
<p>Then make sure the trial actually happens. We wrote a whole guide on <a href="/learn/get-more-trials-to-show-up">getting more trials to turn up</a>.</p>

<h2>2. Give every new member a free month for a friend</h2>
<p>This sounds generous, and it is. It&rsquo;s also one of the cheapest ways there is to grow.</p>
<p>At our club, every new paying member can invite one friend in their first 30 days. The friend comes to class with them for 30 days, free. At the end, the friend either joins or simply stops coming. There&rsquo;s nothing to cancel and no awkward conversation.</p>
<p>The timing is what makes it work. A new child is at their most nervous in their first few weeks, and bringing a friend they already know makes those weeks easier. By the end of the month they&rsquo;ve made other friends in the class too, so they&rsquo;re far more likely to stay, whether or not their friend does.</p>
<p>And the friend arrives already knowing someone, so they skip the nerves most trials start with.</p>
<p>That&rsquo;s how we run it, and it&rsquo;s only one way. Some clubs prefer a sibling offer, a discount for the member who brings someone, or nothing at all. Whatever suits your club is the right scheme.</p>
<p>Here&rsquo;s what it actually costs you. The friend takes a space in a class that would have been empty anyway. You were already paying for the hall and the coach. If they join at the end of the month, you&rsquo;ve gained a member for the price of a space you couldn&rsquo;t sell.</p>
<div class="lc-stats">
  <div class="lc-stat"><b>&pound;0</b><span>extra cost: the space was empty anyway</span></div>
  <div class="lc-stat hot"><b>&pound;600</b><span>a year if they join at &pound;50 a month</span></div>
</div>

<h2>3. Tell parents who don&rsquo;t know you exist</h2>
<p>Word of mouth is brilliant, and it&rsquo;s slow. It only reaches people who already know someone at your club.</p>
<p>Local Facebook and Instagram ads reach parents within a few miles who have children the right age and have never heard of you. Done well, they don&rsquo;t cost much. Our first four weeks of ads cost &pound;145 and brought in 24 trial bookings. We&rsquo;ve written up <a href="/learn/are-facebook-ads-worth-it-for-kids-clubs">exactly what we spent and what it made</a>.</p>
<p>Two rules make ads work for a club. Advertise a free trial, not your club in general. And only advertise classes that have space, so you never pay to find families you can&rsquo;t take.</p>

<h2>4. Be easy to find on Google and AI search</h2>
<p>Lots of parents start with a search: &ldquo;dance classes for 5 year olds near me&rdquo;. More and more of them ask ChatGPT or Google&rsquo;s AI answers instead.</p>
<ul>
  <li>Have a website with a page for each class, with the ages, days, times and area written out plainly.</li>
  <li>Set up your Google Business Profile and keep your hours and photos up to date.</li>
  <li>Ask every happy family for a Google review. The best moment is just after a great trial.</li>
</ul>
<p>Our own club gets trial bookings from Google and AI search, not just from ads.</p>

<h2>5. Make joining take one tap</h2>
<p>A parent has just watched their child love a class. That&rsquo;s the moment to join. If joining means filling in a paper form, finding the bank details and setting up a standing order, a lot of them will mean to do it later and never quite get round to it.</p>
<p>Send the link to join the same day, and make it take a minute: choose the class, pay by card or Apple Pay, done.</p>

<h2>6. Follow up within a day</h2>
<p>After a trial, send a message the same evening or the next morning: how did they find it, and here&rsquo;s the link to keep their place. Most families who don&rsquo;t join aren&rsquo;t saying no. They just haven&rsquo;t been asked at the right time.</p>
<p>How many trials go on to join is your conversion rate, and following up quickly is one of the easiest ways to raise it.</p>
${term('conversion')}

<h2>7. Keep the members you already have</h2>
<p>Growing is much easier when you aren&rsquo;t losing people out of the back door.</p>
<ul>
  <li>Keep parents in the loop: news, photos, show dates and holiday closures, all in one place.</li>
  <li>Let them pause instead of cancel when they have a busy month or a holiday.</li>
  <li>Make paying effortless, and chase failed payments for them, kindly and automatically.</li>
</ul>

<h2>Put together</h2>
<p>None of these are complicated. The hard part is doing all of them, every week, while also running classes. A club that does all seven usually fills up.</p>`,
    one: ['Free trial booking on your own website, with consent and medical forms.', 'A free month for a friend, sent by each new member from the app, or your own scheme built in instead.', 'Local Facebook and Instagram ads, run for you, with the first 3 months on us.', 'Your website built so Google and AI search understand your classes.', 'Joining in a tap, and the follow-up sent for you after every trial.', 'An app for parents with news, photos, payments and pause instead of cancel.'],
    oneLead: 'All seven, in one system. <span>Run for you.</span>',
    faq: [
      ['How do I get more children to join my club?', 'Make the first step a free trial, reach local parents who don&rsquo;t know you exist with a few pounds of ads, and make joining take one tap. Then follow up within a day of every trial and let your members bring a friend free.'],
      ['Is a free month for a friend too generous?', 'It costs you a space in a class that would otherwise be empty, and it helps your new member settle in, so they are more likely to stay. If one friend joins at &pound;50 a month, that&rsquo;s &pound;600 a year from a space you couldn&rsquo;t sell.'],
      ['How do I get my club found on Google?', 'Have a website with a page for each class that spells out the ages, days, times and area, set up your Google Business Profile, and ask happy families for Google reviews.']
    ],
    related: ['get-more-trials-to-show-up', 'are-facebook-ads-worth-it-for-kids-clubs']
  },

  {
    slug: 'are-facebook-ads-worth-it-for-kids-clubs',
    topic: 'ads',
    title: 'Are Facebook ads worth it for a kids&rsquo; club? Our real numbers',
    short: 'Are ads worth it?',
    docTitle: 'Are Facebook Ads Worth It for a Kids’ Club? Our Real Numbers | Kanvas One',
    desc: 'We spent £145 on Facebook and Instagram ads in four weeks. It brought 24 trial bookings and 8 new members, worth £4,620 a year. Here’s how.',
    card: 'We spent &pound;145 in four weeks. It brought 24 trials and 8 new members, worth &pound;4,620 a year.',
    read: 5,
    body: `
<p>Lots of club owners have tried boosting a post, spent &pound;20, got some likes and decided ads don&rsquo;t work for them. I understand why. But likes aren&rsquo;t members, and a boosted post isn&rsquo;t really an ad campaign.</p>
<p>Here&rsquo;s what happened when we ran proper ads for our own club for four weeks.</p>

<h2>What we spent and what it made</h2>
${chain('Four weeks of ads at our club', [['&pound;145', 'spent on ads'], ['24', 'free trial bookings'], ['8', 'new paying members'], ['&pound;4,620', 'a year in new fees', true]])}
<p class="lc-note">Our own academy, 21 September to 17 October 2026. Seven members at &pound;50 a month and a sibling at our 30% family rate. These are our numbers, not a promise of yours.</p>
<p>That works out at about &pound;6 for each trial booking and about &pound;18 for each new member. That first number is your cost per trial, and it&rsquo;s the one to watch.</p>
${term('costper')}

<div class="lc-callout"><p>If you could spend &pound;145 and get &pound;4,620 a year back, how many times would you spend it?</p></div>

<p>And the &pound;4,620 is only the first year. Children who enjoy a class tend to stay for years, and they bring their brothers, sisters and friends.</p>

<h2>Why it worked</h2>
<h3>We advertised a free trial, not the club</h3>
<p>&ldquo;Come and try a free class&rdquo; is something a parent can say yes to in ten seconds. &ldquo;Check out our dance school&rdquo; isn&rsquo;t.</p>
<h3>We only advertised classes with space</h3>
<p>When a class filled, its ads stopped. There&rsquo;s no point paying to find families you can&rsquo;t take.</p>
<h3>We kept it local</h3>
<p>Parents drive a few miles for a children&rsquo;s class, not twenty. The ads only showed to families close enough to come every week.</p>
<h3>We showed the class, not a poster</h3>
<p>Real photos and short videos of real children having fun, with the age group and the day it runs.</p>
<h3>Every booking was looked after</h3>
<p>This is the part most people miss. An ad only gets you a booking. What happens next decides whether it becomes a member: the confirmation, the reminders, the coach at the door and the follow-up afterwards. That&rsquo;s why <a href="/learn/get-more-trials-to-show-up">15 of our last 22 trials turned up</a>.</p>

<h2>When ads aren&rsquo;t worth it</h2>
<p>Ads aren&rsquo;t magic. They don&rsquo;t work well if:</p>
<ul>
  <li>your classes are already full (spend the money when you open a new class instead)</li>
  <li>nobody replies to enquiries for days</li>
  <li>trial bookings get no reminders, so half of them never arrive</li>
  <li>joining afterwards means paperwork and bank transfers</li>
</ul>
<p>Fix those first, and the same money goes much further.</p>

<h2>How much should a kids&rsquo; club spend?</h2>
<p>You don&rsquo;t need a big budget. We spent about &pound;35 a week. Start small, watch what each trial booking costs you, and spend more on the classes that have space and fill well.</p>`,
    one: ['Your Facebook and Instagram ads, written, built and run for you.', 'The first 3 months of ad spend on us, up to &pound;100 a month.', 'The 10-Trial Promise: 10 trials in 3 months, or your next 3 months free.', 'Ads pause on their own when a class fills.', 'Every booking gets the confirmation, the reminders and the follow-up.', 'A monthly report: what ran, what it cost, what came in.'],
    oneLead: 'Ads run for you. <span>The first 3 months on us.</span>',
    faq: [
      ['Do Facebook ads work for kids&rsquo; clubs?', 'They can work very well if they advertise a free trial, stay local, only run for classes with space, and every booking is followed up. Our club spent &pound;145 in four weeks and got 24 trial bookings and 8 new members.'],
      ['How much should I spend on ads for my club?', 'Start small. We spent about &pound;35 a week. Watch what each trial booking costs you and put more into the classes that have space.'],
      ['What should a kids&rsquo; club ad say?', 'Offer a free trial, show real children in a real class, and say the age group, the day and the area. Make booking take a minute.']
    ],
    related: ['get-more-members-kids-club', 'get-more-trials-to-show-up']
  },

  {
    slug: 'classforkids-alternative',
    topic: 'software',
    title: 'A ClassForKids alternative for clubs that want to grow',
    short: 'ClassForKids alternative',
    docTitle: 'ClassForKids Alternative: Your Own App, Website and Ads | Kanvas One',
    desc: 'ClassForKids is a solid booking system. If you want your own app, your own website and ads that bring new families in, here’s how Kanvas One compares.',
    card: 'ClassForKids is a solid booking system. If you want your own app, website and ads too, here&rsquo;s how we compare.',
    read: 5,
    body: `
<p>Lots of kids&rsquo; clubs in the UK use ClassForKids, and for good reason. It&rsquo;s a solid booking and membership system, it&rsquo;s been around a long time, and thousands of clubs rely on it every week.</p>
<p>If you want a booking system you can set up yourself, it does that job well. This page is for clubs who want more than that: their own app, their own website, new families coming in every month, and someone helping them grow.</p>

<h2>What both do</h2>
<p>Both handle the everyday running of a club:</p>
<ul>
  <li>class bookings and monthly memberships, paid by card</li>
  <li>failed payments retried automatically</li>
  <li>registers, waiting lists and online trial bookings</li>
  <li>emergency contacts, medical notes and consent collected at booking</li>
  <li>sibling discounts</li>
</ul>
<p>If that&rsquo;s all you need, either will do it.</p>

<h2>Where Kanvas One is different</h2>
<div class="lc-table"><table>
  <thead><tr><th></th><th>ClassForKids</th><th>Kanvas One</th></tr></thead>
  <tbody>
    <tr><td>How you get started</td><td>You set it up yourself, with help guides</td><td>We build it for you around how your club runs</td></tr>
    <tr><td>Your app</td><td>Parents book through ClassForKids</td><td>Your own app in the App Store and Google Play, with your club&rsquo;s name and logo, for parents and coaches</td></tr>
    <tr><td>Your website</td><td>Booking pages you can brand</td><td>Your own website on your own web address, built around your timetable</td></tr>
    <tr><td>New families</td><td>Up to you</td><td>Facebook and Instagram ads run for you, 3 months on us, with the 10-Trial Promise</td></tr>
    <tr><td>Google and AI search</td><td>Up to you</td><td>Done for you, worked on every month</td></tr>
    <tr><td>Selling extras</td><td>Classes, terms and camps</td><td>Plus uniform, kit, show tickets and event fees</td></tr>
    <tr><td>Talking to parents</td><td>Email and texts</td><td>Push notifications, live chat, a community feed, email, and &pound;5 of texts and calls a month included</td></tr>
    <tr><td>Something missing</td><td>Use what&rsquo;s there</td><td>Tell me what your club needs and I&rsquo;ll do my best to build it, at no extra cost</td></tr>
    <tr><td>Price</td><td>From &pound;34.99 a month, plus a fee on each payment (from 2.5% including card fees)</td><td>&pound;250 a month, flat. We take 0% of your payments</td></tr>
  </tbody>
</table></div>
<p class="lc-note">ClassForKids details from their own website, checked October 2026. Prices and features change, so check theirs for the latest.</p>

<h2>Which costs more?</h2>
<p>For a small club, ClassForKids will usually cost less each month. That&rsquo;s worth saying plainly.</p>
<p>The difference is that our price doesn&rsquo;t grow as you do. With a fee on every payment, the more members you have, the more you pay. At 2.5%, a club taking &pound;5,000 a month pays about &pound;125 a month in payment fees on top of the subscription, and that fee includes the card processing.</p>
<p>With Kanvas One, members pay into your own Stripe account, you pay Stripe&rsquo;s own card fees directly, and we add nothing on top. Card fees grow with your takings whichever system you use. Our &pound;250 doesn&rsquo;t.</p>
<p>And what you&rsquo;re paying for is different. Kanvas One is your app, your website and your ads, with someone running them for you. It&rsquo;s built to bring new families in, not just to look after the ones you have.</p>

<h2>Who should stay with ClassForKids</h2>
<ul>
  <li>Clubs that are happy with their size and just need bookings and payments handled.</li>
  <li>Clubs who like to set everything up and run it themselves.</li>
  <li>Very small clubs where the monthly cost matters most.</li>
</ul>

<h2>Who Kanvas One is for</h2>
<ul>
  <li>Clubs with empty spaces they want filled.</li>
  <li>Owners who want their own app and website, with their own name on it.</li>
  <li>Owners who&rsquo;d rather coach than spend evenings on admin and marketing.</li>
  <li>Clubs that charge their own way and want a system shaped around them.</li>
</ul>

<h2>Switching over</h2>
<p>We move your members, memberships and timetable across for you. Between terms is the easiest time, and your parents get one message with the link to your new app.</p>`,
    one: ['Your own app and website, with your club&rsquo;s name on them.', 'Bookings, memberships, registers and payments, like you have now.', 'Ads run for you, the first 3 months on us, with the 10-Trial Promise.', 'We take 0% of your payments, so your bill stays &pound;250 as you grow.', 'Free switch-over: your members, memberships and timetable moved for you.', 'Me on the other end of a message, not a ticket queue.'],
    oneLead: 'Everything you have now. <span>Plus the bit that grows your club.</span>',
    faq: [
      ['Is Kanvas One cheaper than ClassForKids?', 'Not for a small club. ClassForKids starts lower each month. Kanvas One is a flat &pound;250 a month with no cut of your payments, and it includes your own app, website and ads run for you, so it suits clubs that want to grow.'],
      ['Can I move from ClassForKids to Kanvas One?', 'Yes. We move your members, memberships and timetable across for you. Between terms is easiest, and your parents get one message with the link to your new app.'],
      ['Does Kanvas One take a percentage of my payments?', 'No. Members pay into your own Stripe account at Stripe&rsquo;s own card rates, and we take 0%.']
    ],
    related: ['easiest-software-for-dance-schools', 'easiest-software-for-martial-arts-clubs']
  },

  {
    slug: 'easiest-software-for-dance-schools',
    topic: 'software',
    title: 'The easiest software to run a dance school',
    short: 'Software for dance schools',
    docTitle: 'The Easiest Software to Run a Dance School in the UK | Kanvas One',
    desc: 'Terms, shows, costumes, tickets, trials and parents who want to know everything. What a dance school actually needs from its software, from a dance school owner.',
    card: 'Terms, shows, costumes, tickets and trials. What a dance school actually needs from its software.',
    read: 5,
    body: `
<p>I&rsquo;ve run a dance school in Newcastle since 2017. Kanvas One started as the system I built for us, because nothing else did what a dance school actually needs without five different logins.</p>
<p>Here&rsquo;s what to look for, whichever software you choose.</p>
${grid([['tag', 'Fees your way', 'Monthly, termly or a mix, by card.'], ['ticket', 'Shows and tickets', 'Tickets and costumes paid in one place.'], ['star', 'Trials that turn up', 'Confirmed and reminded.'], ['chart', 'Registers on your phone', 'QR check-in and medical notes.'], ['message', 'Parents in the loop', 'Every family gets every update.'], ['phone', 'Your own name on it', 'Your app and website, with your club&rsquo;s name.']])}

<h2>Fees the way you already charge</h2>
<p>Some schools charge monthly, some by the term, some a mix. Your software should fit how you charge, not make you change. Look for monthly memberships taken by card, termly invoices on the first day of term, sibling discounts that apply themselves, and failed payments chased for you.</p>

<h2>Shows, tickets and costumes</h2>
<p>Show season is when dance schools are busiest and admin goes through the roof. You want:</p>
<ul>
  <li>show tickets sold online and checked in at the door from a phone</li>
  <li>costume and uniform orders paid for in the same place as fees</li>
  <li>event fees and deposits for competitions and exams</li>
</ul>
<p>Every separate payment link and spreadsheet is another thing to chase.</p>

<h2>Trials that turn up</h2>
<p>New starters come from trials, and lots of trials never arrive. A good system confirms every booking straight away and reminds families before the class. We send four messages before every trial, and <a href="/learn/get-more-trials-to-show-up">15 of our last 22 turned up</a>.</p>

<h2>Parents who want to be in the loop</h2>
<p>Dance parents want to know what&rsquo;s happening: rehearsal changes, show dates, what to wear, photos from class. Group chats get chaotic. One app with news, photos, notifications and messages keeps it all in one place.</p>

<h2>Registers and safety on the coach&rsquo;s phone</h2>
<p>Teachers need registers, emergency contacts and medical notes in their pocket, not in a folder in the office. QR check-in at the door makes registers take seconds.</p>

<h2>Your own name on it</h2>
<p>Parents trust your school. An app and website with your name and logo feel like part of your school, not a third party&rsquo;s.</p>

<h2>A checklist</h2>
<ol>
  <li>Charges monthly, termly or both, with sibling discounts.</li>
  <li>Sells show tickets, costumes and uniform.</li>
  <li>Confirms and reminds every trial booking.</li>
  <li>Keeps parents up to date in one app.</li>
  <li>Puts registers and medical notes on teachers&rsquo; phones.</li>
  <li>Carries your school&rsquo;s name, not the software&rsquo;s.</li>
</ol>`,
    one: ['Monthly memberships or termly invoices, set up the way you already charge.', 'Show tickets, costumes and uniform sold in the same app.', 'Every trial confirmed and reminded four times.', 'News, photos, notifications and messages for parents.', 'Registers, QR check-in and medical notes on teachers&rsquo; phones.', 'Your own app and website, with your school&rsquo;s name.'],
    oneLead: 'Built in a dance school. <span>Shaped around yours.</span>',
    faq: [
      ['What is the best software for a dance school?', 'One that charges the way you already do, sells show tickets and costumes, reminds every trial booking, keeps parents up to date in one app and puts registers on teachers&rsquo; phones. Ideally with your school&rsquo;s own name on it.'],
      ['Can dance school software take termly payments?', 'Kanvas One can take monthly memberships or send termly invoices on the first day of term, or both, set up to match how your school charges.']
    ],
    related: ['easiest-software-for-martial-arts-clubs', 'classforkids-alternative']
  },

  {
    slug: 'easiest-software-for-martial-arts-clubs',
    topic: 'software',
    title: 'The easiest software to run a martial arts club',
    short: 'Software for martial arts clubs',
    docTitle: 'The Easiest Software to Run a Martial Arts Club in the UK | Kanvas One',
    desc: 'Family memberships, gradings, kit, trials and attendance. What a martial arts club needs from its software, and how to keep it simple.',
    card: 'Family memberships, gradings, kit, trials and attendance. What a martial arts club needs from its software.',
    read: 5,
    body: `
<p>A martial arts club has its own rhythm: regular sessions, families training together, gradings every few months, and kit to sort out for every new starter. The right software makes all of that quieter, so you can spend your time on the mat.</p>
${grid([['tag', 'Family memberships', 'Sibling discounts and pause, taken by card.'], ['chart', 'Attendance for gradings', 'Every session counted by QR check-in.'], ['trophy', 'Gradings and events', 'Booked and paid with the fees.'], ['shirt', 'Kit and licences', 'Ordered before they arrive.'], ['phone', 'Medical notes', 'On every instructor&rsquo;s phone.'], ['star', 'Trials that turn up', 'Confirmed and reminded.']])}

<h2>Family memberships that work themselves out</h2>
<p>Martial arts is often a family thing: brothers and sisters, sometimes a parent too. Look for memberships taken by card every month, family and sibling discounts applied automatically, and the option to pause instead of cancel during exams or injury.</p>

<h2>Attendance you can actually use</h2>
<p>Attendance matters for gradings. Registers on your phone, with QR check-in at the door, mean every session is counted without paperwork, and you can see who has trained enough to grade.</p>

<h2>Gradings and events</h2>
<p>Gradings, competitions and seminars all need booking and paying for. Taking those payments in the same place as memberships saves a lot of chasing. Every club runs gradings differently, so this is something we set up around your club&rsquo;s own syllabus.</p>

<h2>Kit, licences and uniform</h2>
<p>New starters need a suit, and sometimes a licence and sparring kit. An online shop in your own app means it&rsquo;s ordered and paid for before they arrive.</p>

<h2>Consent and medical information</h2>
<p>It&rsquo;s a contact sport. Emergency contacts, medical notes and consent should be collected at booking and be on the instructor&rsquo;s phone in every session.</p>

<h2>Trials that turn up</h2>
<p>Most new members start with a free trial, and many trial bookings never arrive. Confirm every booking and remind families before the session. We send four messages before every trial, and <a href="/learn/get-more-trials-to-show-up">15 of our last 22 turned up</a>.</p>

<h2>A checklist</h2>
<ol>
  <li>Family memberships with discounts and pause.</li>
  <li>Attendance tracked automatically, ready for gradings.</li>
  <li>Grading and event payments in the same place as fees.</li>
  <li>Kit and licences sold online.</li>
  <li>Consent and medical notes on the instructor&rsquo;s phone.</li>
  <li>Every trial confirmed and reminded.</li>
</ol>`,
    one: ['Family memberships with sibling discounts, pause and failed payments chased.', 'Registers and QR check-in that count every session.', 'Gradings and events set up around your syllabus.', 'Suits, kit and licences sold in your own app.', 'Consent and medical notes on every instructor&rsquo;s phone.', 'Every trial confirmed and reminded four times.'],
    oneLead: 'Less admin. <span>More time on the mat.</span>',
    faq: [
      ['What software do martial arts clubs use?', 'Many use a general booking system. Look for family memberships, attendance tracking for gradings, grading and kit payments in the same place, and consent and medical notes on the instructor&rsquo;s phone.'],
      ['Can I track attendance for gradings?', 'Yes. With registers and QR check-in on your phone, every session a student attends is counted automatically, so you can see who is ready to grade.']
    ],
    related: ['easiest-software-for-dance-schools', 'classforkids-alternative']
  },
  {
    slug: 'how-much-to-charge-for-kids-classes',
    topic: 'money',
    title: 'How much should you charge for kids’ classes?',
    short: 'How much to charge',
    docTitle: 'How Much to Charge for Kids’ Classes: Pricing Your Club | Kanvas One',
    desc: 'Most kids’ clubs undercharge. How we went from £16 a month to £50 and filled our classes, and a simple sum to find your own price.',
    card: 'Most clubs undercharge. How we went from £16 a month to £50 and filled our classes, and the sum to find your price.',
    read: 6,
    body: `
<p>Most club owners set their price the same way. They look at what the club down the road charges, and go a little lower. I did exactly that.</p>
<p>It feels safe, but it nearly always means undercharging. And undercharging doesn’t just cost you money. It can cost you members too.</p>

<h2>What happened when I raised my prices</h2>
<p>When I started, I charged &pound;16 a month. It was very quiet. When I went up to &pound;30 a month, more families joined, not fewer. When I raised it to &pound;50 a month, we became close to fully booked.</p>
<div class="lc-stats">
  <div class="lc-stat"><b>&pound;16</b><span>a month: very quiet</span></div>
  <div class="lc-stat"><b>&pound;30</b><span>a month: more members</span></div>
  <div class="lc-stat hot"><b>&pound;50</b><span>a month: close to fully booked</span></div>
</div>
<p class="lc-note">Our own club. Plenty else changed over those years too, so I won&rsquo;t pretend price was the only thing. But raising it never emptied a class.</p>
<p>It sounds backwards, but it makes sense when you think about it from a parent&rsquo;s side.</p>
<ul>
  <li><strong>Price tells parents what to expect.</strong> A very cheap class can look like something to fill an hour. A properly priced one looks like something taken seriously.</li>
  <li><strong>People value what they pay for.</strong> Families who pay a fair price tend to turn up, every week.</li>
  <li><strong>Limited spaces are worth more.</strong> If your classes have a set number of places, a fuller class with a waiting list is a reason to join now.</li>
  <li><strong>More money makes a better club.</strong> Better coaches, smaller groups, costumes, shows. Parents notice all of it.</li>
</ul>
<p>One honest warning: this only works if the class is genuinely good. A higher price makes a great class look great. It won&rsquo;t rescue a poor one.</p>

<h2>A simple sum to find your price</h2>
<p>Instead of starting with what others charge, start with what you need. Work it out for <strong>80% full, over 10 months</strong>.</p>
<ol>
  <li><strong>Add up what you want for a year.</strong> What you want to take home, plus every cost: hall hire, coaches, insurance, licences, kit, software.</li>
  <li><strong>Divide it by 10.</strong> That&rsquo;s what you need each month.</li>
  <li><strong>Count your spaces and take 80%.</strong> Every class, every space, then 80% of that.</li>
  <li><strong>Divide the monthly figure by those spaces.</strong> That&rsquo;s your price per child, per month.</li>
</ol>

<h3>An example</h3>
<div class="lc-sum"><table>
  <tbody>
    <tr><td>What you want to take home</td><td>&pound;24,000 a year</td></tr>
    <tr><td>Hall hire</td><td>&pound;4,000</td></tr>
    <tr><td>A coach</td><td>&pound;6,000</td></tr>
    <tr><td>Insurance and licences</td><td>&pound;600</td></tr>
    <tr><td>Software, website and app</td><td>&pound;3,000</td></tr>
    <tr class="tot"><td><strong>Total for the year</strong></td><td><strong>&pound;37,600</strong></td></tr>
    <tr><td>Divided by 10 months</td><td>&pound;3,760 a month</td></tr>
    <tr><td>6 classes of 15 spaces, 80% full</td><td>72 children</td></tr>
    <tr class="hot"><td><strong>Your price</strong></td><td><strong>about &pound;52 a month</strong></td></tr>
  </tbody>
</table></div>
<p>If a lot of your children come to more than one class, do the same sum per class space instead of per child.</p>

<h3>Why 80%?</h3>
<p>You&rsquo;ll rarely be 100% full. Children start and leave, siblings come and go, and a class running at about 80% still feels busy and lively. If your price only works when every space is full, it doesn&rsquo;t work.</p>
${term('capacity')}

<h3>Why 10 months, not 12?</h3>
<p>Ten months is easier to track, and it gives you room for the summer dip, holidays and the odd quiet month. If you hit your number in 10 months, the other two are a bonus. In the example above, those two months are worth about &pound;7,500.</p>

<div class="lc-callout"><p>Price for 80% full over 10 months. Anything above that is a bonus, not a bill you were counting on.</p></div>

<h2>Termly or monthly?</h2>
<p>It matters far less than the number itself. Charge the way the families near you are used to paying. If you charge by the term, it&rsquo;s the same sum: work out the year, then divide by your terms instead of by 10.</p>

<h2>When to put your price up</h2>
<ul>
  <li><strong>When your classes are full</strong>, or you have a waiting list.</li>
  <li><strong>When your costs go up</strong>, such as a new hall or another coach.</li>
  <li><strong>When you&rsquo;ve added something</strong>, like a show, new kit or extra sessions.</li>
</ul>
<p>Give families at least a month&rsquo;s notice, and say plainly what the money goes on. Most parents are fine with a fair rise from a club their child loves.</p>

<h2>A quick checklist</h2>
<ol>
  <li>Stop pricing from the club down the road.</li>
  <li>Add up what you want for a year, costs included.</li>
  <li>Divide by 10 months, then by 80% of your spaces.</li>
  <li>Charge termly or monthly, whichever your families expect.</li>
  <li>Review your price whenever classes fill up.</li>
</ol>`,
    one: ['Your free profit plan works out your price and your break-even before you start.', 'Monthly, termly or a mix, paid by card in your own app.', 'Sibling and family discounts worked out automatically.', 'Payments go straight to your own Stripe account. We take 0%.', 'A flat &pound;250 a month, however many members you have.'],
    oneLead: 'Work out your price. <span>Then get paid it, automatically.</span>',
    faq: [
      ['How much should I charge for a kids’ class?', 'Work it out from what you need, not from what others charge. Add up what you want to take home plus every cost for the year, divide by 10 months, then divide by 80% of your class spaces. That gives you a price per child per month. Our own club charges £50 a month.'],
      ['Will I lose members if I put my prices up?', 'Not usually, if the class is good and you give notice. When we went from £16 to £30 a month, and later to £50, more families joined, not fewer.'],
      ['Should I charge termly or monthly?', 'Either works. The price matters far more than how it is collected. Charge the way families near you are used to paying.']
    ],
    related: ['stop-chasing-late-payments', 'make-more-money-from-your-kids-club']
  },

  {
    slug: 'stop-chasing-late-payments',
    topic: 'money',
    title: 'How to stop chasing late payments at your kids’ club',
    short: 'Stop chasing payments',
    docTitle: 'How to Stop Chasing Late Payments at Your Kids’ Club | Kanvas One',
    desc: 'Cash, bank transfers and awkward chats at the door. How we stopped chasing parents for money, and the polite message to send when a payment fails.',
    card: 'Cash, bank transfers and awkward chats at the door. How we stopped chasing parents for money.',
    read: 5,
    body: `
<p>Chasing money is the part of running a club nobody enjoys. Working out who has paid, sending reminders, then having an awkward word at the door, sometimes in front of the child.</p>
<p>Most late payments aren&rsquo;t anyone being difficult. A card expired, there wasn&rsquo;t quite enough in the account that day, or a standing order was never set up. Fix the system and most of the chasing goes away.</p>

<h2>1. Take payments automatically</h2>
<p>Cash, bank transfers and standing orders all rely on the parent remembering, and on you checking. Card payments taken automatically on the same date every month don&rsquo;t.</p>
<p>The parent adds their card once when they join, by card or Apple Pay. From then on it just happens, and you can see at a glance who has paid.</p>

<h2>2. Let the reminders do the chasing</h2>
<p>When a payment fails, send a reminder straight away, with a link to pay or update the card. Keep it friendly and assume it&rsquo;s a mistake, because it nearly always is.</p>
<div class="lc-msg"><small>A message you can copy</small>Hi Sarah, Ava&rsquo;s payment for October didn&rsquo;t go through. It&rsquo;s usually an old card. You can pay or update it here, it only takes a minute: [link]. Thanks!</div>
<p>No &ldquo;overdue&rdquo;, no &ldquo;final notice&rdquo;, no guilt. Just what happened and the quickest way to fix it.</p>
<p>Members lost to payments that never got sorted have a name: involuntary churn. They didn&rsquo;t want to leave. Nobody chased the card.</p>
${term('involuntary')}

<h2>3. Show it at the door, without saying a word</h2>
<p>This is the one that has helped us most. Every member at our club has a QR pass in the app that they scan when they arrive.</p>
<p>If a payment has been missed, two things happen:</p>
<ul>
  <li><strong>The member&rsquo;s own pass turns bright red</strong>, with a <em>Pay now</em> button. It stays there until it&rsquo;s paid.</li>
  <li><strong>The coach&rsquo;s phone shows an alert</strong> when they scan, with an important note to show the parent.</li>
</ul>
${missedPaymentPass()}
<p>Parents open their pass while they wait in the queue. When they see red, their first thought is to tap <em>Pay now</em> before they reach the coach. Most of the time it&rsquo;s sorted before anyone has to have the conversation.</p>
<div class="lc-callout"><p>The best reminder is the one a parent sees at the exact moment they can fix it.</p></div>

<h2>4. Let people pause instead of cancel</h2>
<p>Some missed payments are really people who meant to stop for a while: exams, an injury, a long holiday. Give them an easy way to pause, and they won&rsquo;t simply let a payment fail. Most come back when the pause ends.</p>

<h2>5. Agree it all when they join</h2>
<p>Put it in your terms, and have families accept them when they sign up: when payments are taken, what happens if one fails, and how to pause or cancel. It saves arguments later, and it means you never have to make up a rule on the spot.</p>

<h2>A quick checklist</h2>
<ol>
  <li>Move every family to automatic card payments.</li>
  <li>Send a friendly reminder the moment a payment fails, with a link to fix it.</li>
  <li>Make a missed payment visible on their pass, at the door.</li>
  <li>Offer pause instead of cancel.</li>
  <li>Have families accept your payment terms when they join.</li>
</ol>`,
    one: ['Card and Apple Pay payments taken automatically, monthly or by the term.', 'Failed payments chased for you with friendly reminders and a link to pay.', 'A bright red pass with a Pay now button until it&rsquo;s paid.', 'An alert on the coach&rsquo;s phone when that member scans in.', 'Pause instead of cancel, and your terms accepted at sign-up.'],
    oneLead: 'No more chasing. <span>It sorts itself out at the door.</span>',
    faq: [
      ['How do I get parents to pay on time?', 'Take payments automatically by card on the same date each month, so nobody has to remember. When one fails, send a friendly reminder straight away with a link to pay, and show it on their pass when they arrive.'],
      ['What should I say when a payment is late?', 'Keep it short and kind, and assume it is a mistake: tell them the payment didn’t go through, that it’s usually an old card, and give them a link to fix it in a minute.'],
      ['Should a child still train if a payment is missed?', 'That is your call. What helps most is making the missed payment visible before you get to that point. At our club the member’s pass turns red with a Pay now button, so most parents pay in the queue.']
    ],
    related: ['how-much-to-charge-for-kids-classes', 'stop-children-dropping-out-of-your-club']
  },

  {
    slug: 'stop-children-dropping-out-of-your-club',
    topic: 'keeping',
    title: 'How to stop children dropping out of your club',
    short: 'Stop children dropping out',
    docTitle: 'How to Stop Children Dropping Out of Your Club | Kanvas One',
    desc: 'Children rarely leave because they dislike the class. They leave when they stop feeling like they’re getting somewhere. How we keep members past the month-five dip.',
    card: 'Children leave when they stop feeling they’re getting somewhere. How we keep members past the month-five dip.',
    read: 6,
    body: `
<p>&ldquo;She&rsquo;s lost interest.&rdquo; Every club owner has heard it. It rarely means the child stopped liking the class. Usually it means they stopped noticing that they were getting better.</p>
<p>In the first few weeks everything is new: new friends, new skills, a new kit. Then the progress gets slower and harder to see, the novelty wears off, and something else starts competing for that evening.</p>

<h2>Watch for month five</h2>
<p>At our club, month five is when families are most likely to drift away. The excitement of starting has worn off, and the next big thing feels a long way off.</p>
<p>Members leaving is called churn. Every child who stays a few months longer adds to their lifetime value, which is why keeping members is worth so much effort.</p>
${term('churn')}
${term('lifetimevalue')}
<p>Whenever it is at your club, the fix is the same: make sure there&rsquo;s always something coming up, and put something worth staying for just before the point people usually leave.</p>

<h2>1. Always be working towards something</h2>
<p>A class is about learning, but it&rsquo;s also their hobby and something they should look forward to. Children stay when there&rsquo;s a goal they can see:</p>
<ul>
  <li>a team routine they&rsquo;re close to finishing</li>
  <li>a show or a competition coming up</li>
  <li>a grading, badge or new level</li>
  <li>a new skill the whole group is working on</li>
</ul>
<p>If a child is three weeks from finishing a routine with their friends, they don&rsquo;t want to miss it.</p>

<h2>2. Put a milestone just before the dip</h2>
<p>If most people drift at month five, give them something to earn at the end of month five. For example, every dancer who reaches five months becomes a <strong>Level 2 dancer</strong>, with a badge to go with it.</p>
<p>Tell them it&rsquo;s coming. A child who knows they&rsquo;ll be Level 2 at the end of this month talks about it at home, and a parent thinking about stopping usually waits until they&rsquo;ve got it. By then the next goal is already in sight.</p>
${firstYear()}
<div class="lc-callout"><p>Give them something to stay for, just before the point they&rsquo;d usually leave.</p></div>

<h2>3. Make them feel part of something</h2>
<p>Children stay for their friends and for the feeling of belonging to something important. Team names, club kit, shows, photos of the group and celebrating each other&rsquo;s wins all help. So does a coach who knows every child&rsquo;s name and what they&rsquo;re working on.</p>

<h2>4. Show parents the progress too</h2>
<p>Parents pay, so parents need to see it working. They aren&rsquo;t in the room every week. Send photos, news, milestones and show dates, so they can see their child growing in confidence and getting better.</p>

<h2>5. Notice the quiet ones early</h2>
<p>Most children don&rsquo;t leave in one go. They miss a week, then two, then the parent cancels. Keep an eye on your registers, and when a child has missed a couple of sessions, send a short, kind message. No guilt, just &ldquo;we&rsquo;ve missed her, hope all is well.&rdquo;</p>

<h2>6. Offer pause instead of cancel</h2>
<p>Exams, injuries and busy months happen. A pause keeps their place and their progress, and makes coming back easy. A cancellation usually means they&rsquo;re gone for good.</p>

<h2>A quick checklist</h2>
<ol>
  <li>Find the month your members usually leave.</li>
  <li>Put a milestone, badge or level just before it.</li>
  <li>Always have the next routine, show or goal in sight.</li>
  <li>Make children feel part of a team, and show parents the progress.</li>
  <li>Message children who go quiet, and offer pause instead of cancel.</li>
</ol>`,
    one: ['Rewards and milestones built around your club&rsquo;s own levels and badges.', 'A community feed for photos, news and celebrating wins.', 'Shows and events with tickets booked in the app.', 'A kind &ldquo;we haven&rsquo;t seen you&rdquo; message when a child hasn&rsquo;t been in for four weeks.', 'Pause instead of cancel, so a busy month isn&rsquo;t goodbye.'],
    oneLead: 'Keep the members you&rsquo;ve worked to get. <span>Automatically.</span>',
    faq: [
      ['Why do children quit clubs?', 'Usually not because they dislike the class. They stop noticing their own progress, the novelty wears off, and something else competes for that evening. A clear next goal and a sense of belonging keep most children coming.'],
      ['When are members most likely to leave?', 'At our club it is month five, when the excitement of starting has worn off. Look at your own records to find yours, then put a milestone just before it.'],
      ['How do I keep members for longer?', 'Always have something to work towards, like a routine, show, grading or new level. Put a milestone just before the point people usually leave, show parents the progress, and offer pause instead of cancel.']
    ],
    related: ['get-more-members-kids-club', 'stop-chasing-late-payments']
  },

  {
    slug: 'get-your-club-found-on-google-and-chatgpt',
    topic: 'members',
    title: 'How to get your kids’ club found on Google and ChatGPT',
    short: 'Found on Google and ChatGPT',
    docTitle: 'How to Get Your Kids’ Club Found on Google and ChatGPT | Kanvas One',
    desc: 'More parents now ask Google or ChatGPT for a club near them. What decides who gets recommended, and why 7 of our last 29 trial bookings came from search.',
    card: 'Parents now ask Google or ChatGPT for a club near them. What decides who gets recommended.',
    read: 6,
    body: `
<p>A parent wants a dance class for their five year old. A few years ago they&rsquo;d have asked other parents at the school gate. Now plenty of them type &ldquo;dance classes for 5 year olds near me&rdquo; into Google, or ask ChatGPT to recommend one.</p>
<p>Whoever shows up in that answer gets the booking. And unlike ads, it costs nothing each time.</p>

<h2>Our numbers</h2>
<div class="lc-stats">
  <div class="lc-stat"><b>29</b><span>trial bookings in four weeks</span></div>
  <div class="lc-stat"><b>5</b><span>came from Google</span></div>
  <div class="lc-stat hot"><b>2</b><span>came from ChatGPT</span></div>
</div>
<p class="lc-note">Our own club, 21 September to 18 October 2026, from where each booking came from.</p>
<p>Nearly one in four of our trial bookings came from search, with no ad behind it. Two came from families who asked ChatGPT.</p>
${bars('Where our 29 trial bookings came from', [['Facebook and Instagram ads', 8], ['Google search', 5, null, true], ['Came straight to our website', 5], ['ChatGPT', 2, null, true], ['Facebook and Instagram posts', 2], ['Our app', 2], ['Not recorded', 5]], 'Our own club, 21 September to 18 October 2026. Search is highlighted.')}

<h2>How Google and AI search decide</h2>
<p>Google and AI tools like ChatGPT are trying to answer one question: which club is the best answer for this parent? They work it out from what they can read about you online. If they can&rsquo;t find clear answers, they recommend someone else.</p>
<p>That means everything below is about making it easy for them to understand who you are, what you run, for which ages, where and when.</p>

<h2>1. A page for every class</h2>
<p>One page that says &ldquo;we run classes for all ages&rdquo; doesn&rsquo;t answer anyone&rsquo;s question. A page for each class does: <em>Street Dance for ages 5 to 7, Tuesdays 5:30pm, in Gosforth</em>.</p>
<p>Write out the ages, days, times, price and area in plain words, as text rather than inside an image, so search engines can read it.</p>

<h2>2. Set up your Google Business Profile</h2>
<p>It&rsquo;s free, and it&rsquo;s what puts you on the map when someone searches near you. Add your classes, opening hours, photos and a link to book a trial. Keep it up to date, especially over holidays.</p>

<h2>3. Ask for Google reviews at the right moment</h2>
<p>Reviews are one of the strongest signals for local search, and AI answers read them too. The best moment to ask is just after a great trial or a show, when the family is happiest. Ask every time, not now and then.</p>

<h2>4. Answer the questions parents ask</h2>
<p>Parents ask the same things: what should my child wear, is there parking, can I watch, what if they&rsquo;re shy, how much is it? Put the answers on your website in plain language. AI search loves a clear answer to a real question.</p>

<h2>5. Use the same details everywhere</h2>
<p>Your club name, address and phone number should match exactly on your website, Google profile, Facebook page and any local listings. Mismatches make it harder for search engines to be sure you&rsquo;re the same club.</p>

<h2>6. Get mentioned locally</h2>
<p>Local news, school newsletters, community pages and &ldquo;things to do with kids&rdquo; lists all help. Every mention is another place that says you exist and where you are.</p>

<h2>7. Make it fast and easy to book</h2>
<p>Being found is only half of it. If the page is slow on a phone, or the parent can&rsquo;t see how to book a trial, they go back and try the next club. A clear &ldquo;book a free trial&rdquo; button on every class page turns searches into bookings.</p>

<div class="lc-callout"><p>Nobody honest can promise you a ranking. But a club that answers parents&rsquo; questions clearly gives Google and AI search every reason to recommend it.</p></div>

<h2>Check how you look</h2>
<p>Try it yourself. Search Google for your type of class near you, and ask ChatGPT &ldquo;what&rsquo;s a good kids&rsquo; dance class in [your area]?&rdquo;. If you don&rsquo;t appear, or the details are wrong, work through the list above.</p>

<h2>A quick checklist</h2>
<ol>
  <li>A page for each class with ages, days, times, price and area.</li>
  <li>A Google Business Profile, kept up to date.</li>
  <li>A review asked for after every great trial.</li>
  <li>Plain answers to the questions parents ask.</li>
  <li>The same name, address and phone number everywhere.</li>
  <li>A free trial button on every class page.</li>
</ol>`,
    one: ['Your website built with a page for each class, written so Google and AI search understand it.', 'The details search engines read, added behind the scenes on every page.', 'Your Google Business Profile set up and kept up to date.', 'A Google review asked for automatically after every trial.', 'Free trial booking on every page, in a couple of taps.'],
    oneLead: 'Be the club they recommend. <span>Without paying per click.</span>',
    faq: [
      ['How do I get my club to show up on Google?', 'Have a page for each class with the ages, days, times and area written out plainly, set up and keep your Google Business Profile up to date, and ask happy families for a Google review after every trial.'],
      ['How do I get ChatGPT to recommend my club?', 'AI search reads the same things Google does: your website, your Google profile, reviews and local mentions. Clear pages for each class and plain answers to parents’ questions give it something to recommend. 2 of our last 29 trial bookings came from ChatGPT.'],
      ['Can anyone guarantee a top ranking on Google?', 'No. Be wary of anyone who promises one. You can make it as easy as possible for Google and AI search to understand and trust your club, and that is what works.']
    ],
    related: ['get-more-members-kids-club', 'are-facebook-ads-worth-it-for-kids-clubs']
  },

  {
    slug: 'does-my-kids-club-need-an-app',
    topic: 'software',
    title: 'Does your kids’ club need its own app?',
    short: 'Does your club need an app?',
    docTitle: 'Does Your Kids’ Club Need Its Own App? | Kanvas One',
    desc: 'We think every club should have its own app, and we run one. The honest reasons why: messages parents actually see, less admin, and everything in one place.',
    card: 'We think every club should have one. The honest reasons why, and what to look for.',
    read: 5,
    body: `
<p>We think every club should have its own app. We would say that, because we build them. So here are the reasons we have one at our own club, and the honest downsides too.</p>

<h2>1. Messages parents actually see</h2>
<p>Emails get buried. Texts cost money. WhatsApp groups mean sharing your personal number, messages at 11pm and a hundred &ldquo;thank you&rdquo;s every time you post.</p>
<p>A notification from your app lands on the parent&rsquo;s lock screen, costs nothing to send and goes to exactly the right families: one class, one age group, or everyone. Class cancelled because of snow? Everyone knows in seconds.</p>
${postOnce('Classes off tonight', 'The snow&rsquo;s too heavy, so tonight&rsquo;s classes are off. Stay safe, see you next week!')}

<h2>2. Less admin for you</h2>
<p>Registers on your phone, with QR check-in at the door. Medical notes and emergency contacts in your pocket during every class. Payments taken and chased for you. No paper, no spreadsheets, no cash tin.</p>

<h2>3. Everything in one place for parents</h2>
<p>Parents juggle a lot. An app gives them one place for everything to do with your club:</p>
<ul>
  <li>the timetable and holiday dates</li>
  <li>their child&rsquo;s pass to scan in</li>
  <li>payments, receipts and pausing</li>
  <li>uniform, kit and show tickets</li>
  <li>photos, news and messages from you</li>
</ul>
<p>When everything is easy to find, you get fewer &ldquo;what time is it again?&rdquo; messages.</p>

<h2>4. Your name on their home screen</h2>
<p>Some booking systems put your club inside a shared app, next to lots of other clubs. Your own app has your name and logo, sits on the parent&rsquo;s home screen, and is about nobody but you. It makes a small club look established.</p>

<h2>5. A community, not just a timetable</h2>
<p>A feed for photos, news and celebrating wins makes families feel part of something. That sense of belonging is a big part of why children stay.</p>

<h2>The honest downsides</h2>
<ul>
  <li><strong>Apple and Google charge for developer accounts.</strong> &pound;79 a year for Apple and a one-off $25 for Google, paid to them.</li>
  <li><strong>Getting into the stores takes time.</strong> Apple and Google review every app, which usually takes 1 to 4 weeks.</li>
  <li><strong>Parents have to download it.</strong> The trick is making the app the place where things happen: the pass to scan in, the payments, the photos. Then they open it every week.</li>
</ul>

<h2>What to look for</h2>
<ol>
  <li>Your own name and logo, in the App Store and Google Play.</li>
  <li>Notifications you can send to one class or everyone.</li>
  <li>QR check-in and registers for your coaches.</li>
  <li>Payments, pause and failed-payment chasing built in.</li>
  <li>A shop for kit and tickets.</li>
  <li>Everything also working on your website, for parents who don&rsquo;t download it.</li>
</ol>`,
    one: ['Your own app with your club&rsquo;s name and logo, in the App Store and Google Play.', 'Free notifications to one class, one age group or everyone.', 'QR passes, registers and medical notes on every coach&rsquo;s phone.', 'Payments, pause, shop, tickets and a community feed in one place.', 'Every feature works on your website too, while the app is in review.'],
    oneLead: 'Your club, on every parent&rsquo;s phone. <span>With your name on it.</span>',
    faq: [
      ['Does a small club need an app?', 'It helps small clubs most, because it takes the admin off your plate and makes you look established. Messages are free and seen, registers and payments run themselves, and parents find everything in one place.'],
      ['How much does it cost to have your own app?', 'Apple charges £79 a year and Google a one-off $25 for the developer accounts your app is published under. Kanvas One includes the app itself in its £250 a month.'],
      ['Will parents actually download it?', 'They will if the app is where things happen: the pass to scan in at the door, payments, photos and news. Everything should still work on your website for anyone who doesn’t.']
    ],
    related: ['easiest-software-for-dance-schools', 'classforkids-alternative']
  },

  {
    slug: 'make-more-money-from-your-kids-club',
    topic: 'money',
    title: 'How to make more money from your club without adding classes',
    short: 'Make more without more classes',
    docTitle: 'How to Make More Money From Your Kids’ Club Without Adding Classes | Kanvas One',
    desc: 'Classes full and no more evenings to give? Five ways to earn more from the club you already have: pricing, showcases, workshops, uniform and parties.',
    card: 'Classes full and no more evenings to give? Five ways to earn more from the club you already have.',
    read: 5,
    body: `
<p>At some point you run out of room. The classes are full, the hall is booked and there are no more evenings to give. That&rsquo;s a great problem to have, and it doesn&rsquo;t mean your income has to stop growing.</p>
<p>Extras raise your revenue. Because the hall, the coaches and the families are already there, most of what they bring in is profit.</p>
${term('revenue')}

${grid([['tag', 'Review your price', 'A waiting list means you&rsquo;re charging too little.'], ['ticket', 'Extra showcases', 'Tickets for families, a goal for every child.'], ['star', 'Guest workshops', 'A one-off fee, open to non-members too.'], ['shirt', 'Uniform each term', 'Pre-ordered, so you only buy what&rsquo;s sold.'], ['gift', 'Parties', 'Every guest is a local child of the right age.']])}

<h2>1. If you&rsquo;re full, look at your price</h2>
<p>A waiting list is the clearest sign you&rsquo;re charging too little. When demand is bigger than your spaces, a fair rise won&rsquo;t empty your classes. It just means each space earns what it&rsquo;s worth. We went from &pound;16 to &pound;50 a month over the years and filled up as we went. Here&rsquo;s <a href="/learn/how-much-to-charge-for-kids-classes">how to work out your price</a>.</p>

<h2>2. Put on extra showcases</h2>
<p>Families love watching their children perform, and grandparents, aunts and friends will come too. A showcase sells tickets, gives every child something to work towards, and helps keep members for longer. If one show a year sells out, try one a term.</p>

<h2>3. Run pop-up workshops with guest instructors</h2>
<p>Bring in an outside instructor for a one-off workshop: a new style, a special skill, someone well known in your world. Charge a separate fee, and agree either a set fee or a split with the instructor.</p>
<p>Open them to non-members too. A workshop is an easy first step for families who aren&rsquo;t ready for a weekly class, and some of them will book a trial afterwards.</p>

<h2>4. Release new uniform each term</h2>
<p>A new hoodie, T-shirt or bag each term gives families something to look forward to, and children love matching their friends. Take pre-orders before you order the stock, so you only buy what&rsquo;s already sold. Hand it out at class.</p>

<h2>5. Host parties</h2>
<p>Weekend birthday parties run by your coaches, in your hall, are popular with members. Every guest is a local child of the right age, and their parents get to see what your club is like. A party can be your best trial.</p>

<div class="lc-callout"><p>Every extra you offer should either earn money, bring in new families, or give members a reason to stay. The best ones do all three.</p></div>

<h2>Make buying easy</h2>
<p>Whatever you add, it only earns if it&rsquo;s easy to pay for. Paper slips and cash in envelopes get lost. Selling tickets, workshops and kit in the same place parents already pay their fees, by card in a couple of taps, makes a big difference.</p>

<h2>A quick checklist</h2>
<ol>
  <li>Got a waiting list? Review your price.</li>
  <li>Add a showcase, and sell tickets.</li>
  <li>Bring in a guest instructor for a pop-up workshop.</li>
  <li>Release new uniform each term, on pre-order.</li>
  <li>Offer birthday parties at weekends.</li>
</ol>`,
    one: ['Show and event tickets sold in your app.', 'Workshops and one-off sessions added to your timetable, booked and paid in a tap.', 'A shop for uniform and kit, collected at class.', 'Everything paid into your own Stripe account. We take 0%.', 'Want to sell something else, like parties? Tell me and we build it in.'],
    oneLead: 'More from every member. <span>Sold in your own app.</span>',
    faq: [
      ['How can a kids’ club make more money?', 'If your classes are full, review your price first. Then add extras: showcases with tickets, pop-up workshops with guest instructors, new uniform each term and weekend birthday parties.'],
      ['Should workshops be open to non-members?', 'Yes, it often works well. A one-off workshop is an easy first step for a family who isn’t ready for a weekly class, and some will book a free trial afterwards.']
    ],
    related: ['how-much-to-charge-for-kids-classes', 'stop-children-dropping-out-of-your-club']
  },

  {
    slug: 'how-to-start-a-kids-club',
    topic: 'start',
    title: 'How to start a kids’ club: pricing, rent and your first members',
    short: 'Starting a kids’ club',
    docTitle: 'How to Start a Kids’ Club in the UK: Pricing, Rent and First Members | Kanvas One',
    desc: 'Thinking of starting a kids’ club? The basics you need in place, how to price it so the rent and coaches are covered, and how to get your first members.',
    card: 'The basics to put in place, how to price it so the rent is covered, and how to get your first members.',
    read: 7,
    body: `
<p>I started Kanvas Academy in 2017. If you&rsquo;re thinking about starting a club of your own, this is what I&rsquo;d want someone to tell me: what to sort out first, how to make sure the rent and coaches are covered, and how to get your first families through the door.</p>

${chain('From idea to first members', [['1', 'One class, one age group'], ['2', 'Check what you need'], ['3', 'Find a hall'], ['4', 'Set your price'], ['5', 'Free trials', true]])}

<h2>1. Decide what and who</h2>
<p>Start narrow. One style, one age group, one evening. &ldquo;Street dance for 5 to 8 year olds, Tuesdays&rdquo; is far easier to fill and to explain than &ldquo;dance for everyone&rdquo;. You can add classes once the first one is full.</p>

<h2>2. Check what you need to work with children</h2>
<p>Insurance, background checks and policies for working with children all need sorting before your first class. I&rsquo;m not the expert on the rules, so ask your sport&rsquo;s governing body what applies to you.</p>

<h2>3. Find a hall</h2>
<p>School halls, community centres, church halls and leisure centres are all worth asking. Most charge by the hour. Start with one or two evenings, and ask about holidays and whether you can store kit.</p>

<h2>4. Work out your price before day one</h2>
<p>This is where a lot of new clubs go wrong. They pick a low price to get started, then find the rent and the coach take most of it.</p>
<p>Work it out the other way round: add up your rent, your coaches, your insurance and what you want to take home for the year. Divide by 10 months, then by 80% of your spaces. That&rsquo;s your price. We&rsquo;ve written up <a href="/learn/how-much-to-charge-for-kids-classes">exactly how to do the sum</a>, with an example.</p>
<p>And don&rsquo;t be afraid of a proper price. When I charged &pound;16 a month, it was very quiet. At &pound;50 we were close to fully booked.</p>

<h2>5. Get your first members</h2>
<ul>
  <li><strong>Offer a free trial.</strong> It&rsquo;s the easiest yes for a parent who has never heard of you.</li>
  <li><strong>Make it easy to find you.</strong> A simple website with your class, ages, day, time and area, and a Google Business Profile.</li>
  <li><strong>Reach local parents.</strong> A small budget of local Facebook and Instagram ads goes a long way. Our first four weeks cost &pound;145 and brought in 24 trial bookings.</li>
  <li><strong>Make sure trials turn up.</strong> Confirm and remind every booking. We send <a href="/learn/get-more-trials-to-show-up">four messages before every trial</a>.</li>
  <li><strong>Make joining take one tap.</strong> Send the link to join the same day as the trial.</li>
</ul>

<h2>6. Start the way you mean to go on</h2>
<p>It&rsquo;s tempting to start with cash, paper forms and a WhatsApp group, and sort it out later. Later never comes, and by then you have fifty families to move. Card payments, online booking and proper registers from day one save you hours every week.</p>

<h2>If you&rsquo;re about to start, talk to me</h2>
<p>This is the bit I enjoy most. If you&rsquo;re planning a club, message me and I&rsquo;ll help you work out your price, what you can afford for rent and coaches, and how many members you need to break even.</p>
${term('breakeven')}
<p>If you&rsquo;d like, we can then set everything up for you on Kanvas One: your website, your own app, trial bookings and payments, run for you. Your first 3 months of ads are on us, up to &pound;100 a month, so free trials come in while you get going. If those ads bring fewer than 10 trial bookings, your next 3 months of One are free.</p>
<p>It&rsquo;s &pound;250 a month, with no contract. At &pound;50 a month, five members cover it. Your ads start once your website and app are live, which is usually 4 to 8 weeks after you join, so it&rsquo;s worth starting before your first class.</p>`,
    one: ['Help working out your price, rent and coach costs before you open.', 'Your website and your own app, set up for you.', 'Free trial bookings, consent and medical forms from day one.', 'Your first 3 months of ads on us, up to &pound;100 a month.', '10 trial bookings in those 3 months, or your next 3 months free.'],
    oneLead: 'Starting a club? <span>Let&rsquo;s get you going.</span>',
    faq: [
      ['What do I need to start a kids’ club?', 'Decide what you’ll teach and to which ages, check with your sport’s governing body what you need for working with children, find a hall, and work out your price before your first class. Then offer free trials to get your first members.'],
      ['How much should I charge when I start?', 'Work it out from your costs. Add up rent, coaches, insurance and what you want to take home for the year, divide by 10 months, then divide by 80% of your spaces. Don’t start too low: we were very quiet at £16 a month and close to full at £50.'],
      ['How do I get my first members?', 'Offer a free trial, set up a simple website and Google Business Profile, reach local parents with a small budget of local ads, and confirm and remind every trial booking so they turn up.']
    ],
    related: ['how-much-to-charge-for-kids-classes', 'get-more-members-kids-club']
  },
  {
    slug: 'should-kids-clubs-charge-in-the-holidays',
    topic: 'money',
    title: 'Should your club charge during the school holidays?',
    short: 'Charging in the holidays',
    docTitle: 'Should Your Kids’ Club Charge During the School Holidays? | Kanvas One',
    desc: 'Closed for the holidays, but the bills aren’t. How to decide whether to charge over the school holidays, and how to price it so you still earn what you need over the year.',
    card: 'Closed for the holidays, but the bills aren’t. How to decide, and how to price it so you still earn what you need.',
    read: 5,
    body: `
<p>It&rsquo;s one of the questions club owners ask most, and one of the most argued about. Should you charge families during the school holidays?</p>

<h2>What we do</h2>
<p>We run our classes through the school holidays, so we charge every month, the same as always. Families get their classes, and the club has a steady income all year round.</p>
<p>Not every club can do that, or wants to. If you close for the holidays, the answer is still simple. It just has to be decided before you set your price, not after.</p>

<h2>Your bills don&rsquo;t take a holiday</h2>
<p>The holidays might be a week off for the children, but your rent, your coaches, your insurance and your own bills keep coming. This is your income. You can&rsquo;t just stop getting paid for a week, or for six.</p>
<p>So the real question isn&rsquo;t &ldquo;should I charge in the holidays?&rdquo;. It&rsquo;s &ldquo;how do I make sure the club brings in what I need over the whole year?&rdquo;. That yearly total is your revenue, and it&rsquo;s the number to plan around.</p>
${term('revenue')}

<h2>Two ways to do it</h2>
${compare('plain', { h: '1. Keep charging', sub: 'to hold their space', items: ['The same fee every month, open or closed', 'A steady income all year', 'Families who stop free up their space'] }, { h: '2. Only charge while open', sub: 'and price for it', items: ['Divide your yearly figure by the months you&rsquo;re open', 'A higher monthly price', 'Nothing to pay while you&rsquo;re closed'] })}
<h3>1. Keep charging, to hold their space</h3>
<p>Charge the same every month, open or closed. The monthly fee pays for their child&rsquo;s place in the class across the whole year, holidays included. A family who stops paying over the summer frees up their space for someone else.</p>
<p>It keeps your income steady, and it makes the space feel valuable. A place in a popular class is worth keeping.</p>

<h3>2. Only charge while you&rsquo;re open, and price for it</h3>
<p>If you&rsquo;d rather not charge while you&rsquo;re closed, that&rsquo;s fine, as long as your price takes it into account. Work out what you need for the year, then divide it by the months you&rsquo;re actually open, not by 12.</p>
<p>That&rsquo;s why our <a href="/learn/how-much-to-charge-for-kids-classes">pricing guide</a> works out your price over 10 months. Close for part of the year and take 10 payments, and you still make what you need. Stay open all year, or charge all 12 months to hold the space, and the other two months are a bonus.</p>
<div class="lc-stats">
  <div class="lc-stat"><b>&pound;37,600</b><span>what the club in our pricing example needs a year</span></div>
  <div class="lc-stat"><b>10</b><span>payments of &pound;52 while it&rsquo;s open covers it</span></div>
  <div class="lc-stat hot"><b>12</b><span>payments of &pound;52 leaves about &pound;7,500 spare</span></div>
</div>

<h2>Why some parents push back</h2>
<p>Some parents feel it&rsquo;s unfair to pay for weeks when the club is closed, and a few will cancel for a month and rejoin afterwards. Depending on how your club works, that can cost you a lot over a summer.</p>
<p>Most of it goes away when it&rsquo;s clear from the start. If families know when they join that the fee covers the year and holds their place, holidays included, there&rsquo;s nothing to argue about later. If you only charge while you&rsquo;re open, they know that too, and your price already covers it.</p>
<p>Losing families every summer and winning them back in September is churn, and it&rsquo;s expensive. Some never come back.</p>
${term('churn')}

<div class="lc-callout"><p>Decide whether you&rsquo;re open or closed in the holidays first. Then set a price that still pays you what you need over the whole year.</p></div>

<h2>A quick checklist</h2>
<ol>
  <li>Decide whether you&rsquo;ll run classes in the holidays.</li>
  <li>If you close, either keep charging to hold the space, or divide your yearly figure by the months you&rsquo;re open.</li>
  <li>Tell families how holidays work when they join, not when the holidays arrive.</li>
  <li>Put your holiday dates where parents can see them, early.</li>
</ol>`,
    one: ['Monthly, termly or a mix, set up the way your club charges.', 'Holiday closures added once, and shown in the app and on your website.', 'Families told automatically when a class is off.', 'Your terms accepted when they join, so everyone knows how holidays work.', 'Pause instead of cancel, so a summer away isn&rsquo;t goodbye.'],
    oneLead: 'Paid all year. <span>Without the awkward conversations.</span>',
    faq: [
      ['Should a kids’ club charge during the school holidays?', 'If you run classes through the holidays, yes, as normal. If you close, either keep charging to hold each child’s space, or only charge while you’re open and set your price so the open months cover the whole year.'],
      ['Is it fair to charge when the club is closed?', 'It is if families know from the start. Your rent, coaches and bills don’t stop in the holidays, and a monthly fee that holds a child’s place all year is a fair and common way to cover them.'],
      ['How do I stop parents cancelling over the summer?', 'Make it clear when they join how holidays work, and offer pause instead of cancel. If the fee holds their place, families who cancel free up the space for someone else.']
    ],
    related: ['how-much-to-charge-for-kids-classes', 'stop-children-dropping-out-of-your-club']
  },

  {
    slug: 'how-to-find-and-keep-good-coaches',
    topic: 'running',
    title: 'How to find and keep good coaches for your club',
    short: 'Finding and keeping coaches',
    docTitle: 'How to Find and Keep Good Coaches for Your Kids’ Club | Kanvas One',
    desc: 'Good coaches are hard to find and harder to keep. Where I found mine, and why giving them their own class to run matters more than anything.',
    card: 'Where I found mine, and why giving coaches their own class to run matters more than anything.',
    read: 5,
    body: `
<p>Your coaches are your club. Parents choose you because of the coach their child loves, and when a good coach leaves, families often follow.</p>

<h2>Finding them</h2>
<p>I found all of ours online. Good dancers are easy to spot on social media. You can see how they move, how they teach and how they come across before you ever speak to them.</p>
<ul>
  <li>Look where people in your world share their work, like Instagram, TikTok and local groups.</li>
  <li>Look for someone who is great at what they do <em>and</em> great with children. You need both.</li>
  <li>Watch them take a class before you agree anything. How the children respond tells you more than a CV.</li>
</ul>

<h2>Keeping them: make it their class</h2>
<p>The biggest thing I&rsquo;ve learned is to give coaches real ownership. Not just turning up to teach, but their class, with their students.</p>
<ul>
  <li><strong>They plan their classes.</strong></li>
  <li><strong>They choreograph the routines.</strong></li>
  <li><strong>They take their students to competitions.</strong></li>
  <li><strong>They build the relationships</strong> with the children and their families.</li>
</ul>
<p>When it&rsquo;s their class, they don&rsquo;t feel like an employee clocking in. They care whether it&rsquo;s full, whether the children are improving and whether families stay, because it&rsquo;s theirs.</p>
${compare('fix', { h: 'Covering a class', items: ['Teaches someone else&rsquo;s plan', 'The students feel like the club&rsquo;s, not theirs', 'Nothing to build, so nothing to stay for'] }, { h: 'Owning a class', items: ['Plans the classes and choreographs the routines', 'Takes their students to competitions', 'Cares whether it&rsquo;s full and families stay'] })}
<div class="lc-callout"><p>People look after what they feel is theirs. Give your coaches a class to own, not just a class to cover.</p></div>

<h2>Reward what you want more of</h2>
<p>We give coaches incentives for growing their classes. When a new student joins their class, they get a bonus. It costs us a little, and it gives them a real reason to make every trial brilliant.</p>
<p>And when the club does better than expected, a surprise bonus here and there goes a long way. It doesn&rsquo;t have to be big. It shows them you noticed.</p>

<h2>Make them feel part of something</h2>
<p>More than any bonus, coaches stay when they feel like an important part of the club. You want them to care about the business and the students, and to feel looked after in return.</p>
<ul>
  <li>Thank them for the work nobody sees: the planning, the late nights on routines, the messages to parents.</li>
  <li>Ask for their ideas, and use them.</li>
  <li>Tell them how the club is doing.</li>
  <li>Keep their admin as light as possible, so their time goes on teaching.</li>
</ul>

<h2>A quick checklist</h2>
<ol>
  <li>Look for coaches online, where their work is easy to see.</li>
  <li>Watch them teach before you agree anything.</li>
  <li>Give them a class of their own to plan, choreograph and grow.</li>
  <li>Reward new students joining their class, and surprise them now and then.</li>
  <li>Make them feel looked after, appreciated and part of the club.</li>
</ol>`,
    one: ['Each coach sees their own classes, registers and students in the app.', 'Messages and notifications to their class&rsquo;s families, from their phone.', 'Medical notes and emergency contacts on every coach&rsquo;s phone.', 'Registers and QR check-in that take seconds, so their time goes on teaching.', 'Reward your coaches your way? Tell me and we build it in.'],
    oneLead: 'Less admin for your coaches. <span>More time with their students.</span>',
    faq: [
      ['Where can I find coaches for my club?', 'Online is a great place to start. Coaches share their work on Instagram, TikTok and local groups, so you can see how they move, teach and come across before you speak to them. Watch them take a class before agreeing anything.'],
      ['How do I keep good coaches?', 'Give them real ownership: their own class to plan, choreograph, take to competitions and grow. Reward new students joining their class, give a surprise bonus now and then, and make them feel an important part of the club.'],
      ['Should coaches get a bonus for new students?', 'It works well for us. A small bonus when a new student joins their class gives coaches a real reason to make every trial brilliant, and it costs far less than the new member brings in.']
    ],
    related: ['stop-children-dropping-out-of-your-club', 'how-to-start-a-kids-club']
  },

  {
    slug: 'what-should-a-kids-club-website-have',
    topic: 'members',
    title: 'What should a kids’ club website have on it?',
    short: 'What your website needs',
    docTitle: 'What Should a Kids’ Club Website Have on It? | Kanvas One',
    desc: 'Your website has one job: answer every question a parent has before they book a free trial. What to put on it, and the difference between good and bad friction.',
    card: 'One job: answer every question before they book a trial. What to put on it, and good and bad friction.',
    read: 6,
    body: `
<p>A parent lands on your website from Google, an ad or a friend&rsquo;s recommendation. They&rsquo;re interested, but they have questions. If your website answers them, they book a trial. If it doesn&rsquo;t, most won&rsquo;t ask. They go back and try the next club.</p>

<h2>The one job your website has</h2>
<p>Answer every question a parent might have before they book a free trial, so nothing stands in the way. That&rsquo;s it. Everything on the site should either answer a question or make booking easier.</p>
<p>We built our own academy&rsquo;s website this way, and it&rsquo;s the model we use for every club.</p>

<h2>The questions parents ask</h2>
<ul>
  <li>What ages is it for?</li>
  <li>What day, what time, and how long is it?</li>
  <li>Where is it, and is there parking?</li>
  <li>How much is it after the free trial?</li>
  <li>What should they wear and bring?</li>
  <li>Who are the coaches?</li>
  <li>Can I stay and watch?</li>
  <li>What if my child is shy, or has never done it before?</li>
  <li>Do they have to do shows or competitions?</li>
  <li>How do we join after the trial?</li>
</ul>
<p>Answer them where parents look: on each class page, and in a short list of questions and answers.</p>

<h2>What to put on it</h2>
<h3>A page for each class</h3>
<p>Ages, day, time, place and price, with a button to book. It answers the big questions at a glance, and it helps you get <a href="/learn/get-your-club-found-on-google-and-chatgpt">found on Google and ChatGPT</a>.</p>
<h3>Your prices</h3>
<p>Show them. A parent who has to ask the price often doesn&rsquo;t bother. And families who book already know what it costs, so there are no surprises after the trial.</p>
<h3>Real photos</h3>
<p>Your classes, your coaches, your children enjoying it. Stock photos tell a parent nothing. Real ones show them exactly what their child would be walking into.</p>
<h3>Your coaches</h3>
<p>Names, photos and a line about each. Parents are trusting you with their child, and they want to know who will be in the room.</p>
<h3>Reviews</h3>
<p>Real Google reviews from real parents say more than anything you could write about yourself.</p>
<h3>One clear button</h3>
<p>&ldquo;Book a free trial&rdquo;, on every page, easy to find with a thumb.</p>

<h2>Friction: what stands between a parent and a booking</h2>
<p>In business, anything that stands between a customer and the next step is called friction. On a club website, it&rsquo;s every step, form, wait and unanswered question between a parent landing on your page and booking a trial.</p>
${term('friction')}
<p>Not all friction is bad. The trick is knowing the difference.</p>

${compare('fix', { h: 'Bad friction', sub: 'Turns families away', items: ['Emailing to ask for a trial, then waiting for a reply', 'No prices, so they have to ask', 'Making an account before they can see the times', 'A long form asking for things you don&rsquo;t need yet', 'A booking page that&rsquo;s hard to use on a phone'] }, { h: 'Good friction', sub: 'Makes bookings serious', items: ['Asking what they want their child to get out of it', 'Choosing a specific date', 'A mobile number for reminders', 'The details you need to look after their child'] })}

<h3>Bad friction</h3>
${term('badfriction')}
<p>Every one of those steps loses you families who were ready to come. Most never tell you. They just leave.</p>

<h3>Good friction</h3>
${term('goodfriction')}
<p>Some steps are worth adding on purpose. When families book a trial at our club, we ask what they want their child to get out of classes with us: more confidence, new skills, new friends. It takes a few seconds, and it means the people who book are serious about coming.</p>
<p>Good friction makes a booking feel like a commitment, so more families turn up. It also tells you something useful about every family before they walk in.</p>
<div class="lc-callout"><p>Remove every step that doesn&rsquo;t help. Keep the ones that make a booking serious.</p></div>

<h2>Fast, and made for phones</h2>
<p>Most parents will see your website on their phone, often in a spare minute. It needs to load quickly and work with one thumb. If it doesn&rsquo;t, they won&rsquo;t wait.</p>

<h2>A quick checklist</h2>
<ol>
  <li>Answer every question a parent asks before they book.</li>
  <li>A page for each class, with ages, times, place and price.</li>
  <li>Real photos, your coaches and real reviews.</li>
  <li>A free trial button on every page.</li>
  <li>Remove bad friction, and keep the good friction that makes bookings serious.</li>
  <li>Fast on a phone.</li>
</ol>`,
    one: ['A website built around the questions your parents ask.', 'A page for each class, with ages, times, place and price.', 'Free trial booking in a couple of taps, asking the questions you want asked.', 'Live chat and missed-call text back, so questions get answered.', 'Fast on every phone, and built so Google and AI search understand it.'],
    oneLead: 'A website that answers every question. <span>And books the trial.</span>',
    faq: [
      ['What should a kids’ club website include?', 'Everything a parent wants to know before booking a trial: ages, days, times, place, price, what to wear, who the coaches are and how joining works. A page for each class, real photos, reviews and a free trial button on every page.'],
      ['Should I put my prices on my club website?', 'Yes. Many parents won’t ask, they’ll just move on. Showing your price also means the families who book already know the cost, so there are no surprises after the trial.'],
      ['What is good friction and bad friction?', 'Bad friction is a step that turns families away for no reason, like emailing to ask or a long form. Good friction is a step you add on purpose, like asking why they want to join, so the families who book are serious and more of them turn up.']
    ],
    related: ['get-your-club-found-on-google-and-chatgpt', 'get-more-trials-to-show-up']
  },

  {
    slug: 'free-trial-or-paid-trial',
    topic: 'trials',
    title: 'Free trial or paid trial: which is better for a kids’ club?',
    short: 'Free or paid trials?',
    docTitle: 'Free Trial or Paid Trial: Which Is Better for a Kids’ Club? | Kanvas One',
    desc: 'Every decision a parent makes comes down to how risky it feels. Why we use free trials, and when a paid trial can work instead.',
    card: 'Every decision a parent makes comes down to how risky it feels. Why we use free trials, and when paid ones work.',
    read: 4,
    body: `
<p>It&rsquo;s one of the first decisions every club makes. Do you let children try a class for free, or charge for the first one?</p>
<p>Both can work. Which is right for you comes down to one thing: how much risk the parent feels.</p>

<h2>Every decision comes down to risk</h2>
<p>Whenever a parent is deciding whether to try your club, they&rsquo;re quietly asking themselves how much is at stake. What if my child hates it? What if it&rsquo;s not as good as it looks? What if I&rsquo;ve paid and we never go back?</p>
<p>The bigger that feels, the fewer parents take the first step. It&rsquo;s called perceived risk, and it decides more bookings than your price, your photos or your timetable.</p>
${term('perceivedrisk')}

<h2>Why we choose free trials</h2>
<p>A free trial takes the risk away. The parent has paid nothing. If their child doesn&rsquo;t like it, they don&rsquo;t have to join, and nobody has lost anything. That makes it an easy yes.</p>
<p>And once a child has been in the room, met the coach and had a great time, the class does the selling for you.</p>

<h2>When a paid trial can work</h2>
<p>Paid trials aren&rsquo;t wrong. They can work well for a club with a very strong reputation and a waiting list, where parents have already decided they want to join. For them, paying for the first class is just a formality.</p>
<p>The problem is everyone else. A parent who isn&rsquo;t set on your club yet is comparing options. If the club down the road offers a free trial and you charge, they&rsquo;ll often try the free one first, because paying for something their child might not like is a risk they don&rsquo;t have to take.</p>
${compare('plain', { h: 'Free trial', sub: 'The parent risks nothing', items: ['An easy yes, even for parents still comparing clubs', 'The class does the selling', 'Right for most clubs'] }, { h: 'Paid trial', sub: 'The parent risks money', items: ['Puts off parents who aren&rsquo;t sure yet', 'Fine when parents have already decided', 'Suits clubs with a waiting list'] })}
<div class="lc-callout"><p>Take away the risk, and more families say yes. Then let the class do the selling.</p></div>

<h2>Free doesn&rsquo;t have to mean careless</h2>
<p>The worry with free trials is people booking with no intention of coming. You can keep the risk low for parents and still get serious bookings:</p>
<ul>
  <li><strong>Ask a question when they book.</strong> We ask what they want their child to get out of classes. It takes seconds, and it filters out casual bookings. That&rsquo;s <a href="/learn/what-should-a-kids-club-website-have">good friction</a>.</li>
  <li><strong>Have them pick a date</strong>, rather than &ldquo;come along some time&rdquo;.</li>
  <li><strong>Remind them before the class.</strong> We send <a href="/learn/get-more-trials-to-show-up">four messages before every trial</a>, and 15 of our last 22 turned up.</li>
</ul>

<h2>A quick checklist</h2>
<ol>
  <li>Think about how risky the first step feels to a parent.</li>
  <li>Use free trials unless parents are already queuing to join.</li>
  <li>Ask a question at booking so the trials you get are serious.</li>
  <li>Remind every family before their trial.</li>
</ol>`,
    one: ['Free trial booking on your website, in a couple of taps.', 'The question you want asked at booking, like what they want their child to get out of it.', 'Four messages before every trial, sent for you.', 'A follow-up after every trial with the link to join.', 'Prefer paid trials? We can set those up instead.'],
    oneLead: 'Low-risk trials that turn up. <span>Automatically.</span>',
    faq: [
      ['Should my club offer a free trial or a paid trial?', 'For most clubs, a free trial. It takes the risk away for parents, so more of them take the first step. Paid trials can work for clubs with a strong reputation and a waiting list, where parents have already decided to join.'],
      ['Won’t people book a free trial and not turn up?', 'Some will. Asking a question at booking, having them pick a date and sending reminders all help. 15 of our last 22 free trial bookings turned up.']
    ],
    related: ['how-to-turn-trials-into-members', 'get-more-trials-to-show-up']
  },

  {
    slug: 'how-to-turn-trials-into-members',
    topic: 'trials',
    title: 'How to turn free trials into members',
    short: 'Turning trials into members',
    docTitle: 'How to Turn Free Trials Into Members at Your Kids’ Club | Kanvas One',
    desc: 'The best moment to sign a family up is straight after a trial their child loved. What to ask, what to say, and why you shouldn’t feel guilty asking.',
    card: 'The best moment to sign a family up is straight after a trial their child loved. What to ask and what to say.',
    read: 5,
    body: `
<p>The trial has finished. The child is grinning, the parent is smiling, and you say &ldquo;hope to see you next week!&rdquo; as they head out of the door. Then you never hear from them again.</p>
<p>It happens at every club. Not because the family didn&rsquo;t enjoy it, but because nobody asked them to join while they were still feeling it.</p>

<figure class="lc-flow" aria-label="From booking a trial to joining">
  <p class="lc-flow-h">From booking to joining</p>
  <ol data-lc-flow>
    <li><span class="dot">1</span><span><span class="when">When they book</span><span class="bub">Ask what they want their child to get out of classes.</span><span class="chan">Booking form</span></span></li>
    <li><span class="dot">2</span><span><span class="when">During the trial</span><span class="bub">Give them a small win: joining in, a first move nailed, a new friend.</span><span class="chan">In class</span></span></li>
    <li><span class="dot">3</span><span><span class="when">At the end</span><span class="bub">Ask the child if they had fun, and the parent how it went.</span><span class="chan">In person</span></span></li>
    <li><span class="dot">4</span><span><span class="when">At the door</span><span class="bub">&ldquo;Would she like to come back?&rdquo; &ldquo;Yes!&rdquo; &ldquo;Shall we set it up now?&rdquo;</span><span class="chan">In person</span></span></li>
    <li><span class="dot">5</span><span><span class="when">The same day</span><span class="bub">Anyone who didn&rsquo;t join gets a follow-up with the link.</span><span class="chan">Text or email</span></span></li>
    <li class="end"><span class="dot">&#10003;</span><span><span class="when">Next week</span><span class="bub">A new member, back for their first class</span></span></li>
  </ol>
</figure>

<h2>Know why they came</h2>
<p>When families book a trial with us, we ask what they want their child to get out of classes: more confidence, new skills, new friends. That answer is their dream outcome, and it&rsquo;s what they&rsquo;re really there for.</p>
${term('dreamoutcome')}
<p>Make it clear to the parent and the child that your classes will get them there. Then, during the trial, let them feel a little of it straight away: a shy child who joins in, a first move they nail, a new friend by the end.</p>
<p>Before they leave, make a note of what they want, so whoever teaches them next time knows too.</p>

<h2>Ask how it went</h2>
<p>At the end, ask the child if they had fun, and ask the parent how they felt it went. Listen to the answers. Then build on every good thing you can: the friend they made, the thing they got right, how well they joined in.</p>
<p>The more good feelings a family connects with your club, the easier the next step becomes.</p>

<h2>Ask them to come back, then set it up</h2>
<p>This is the bit most clubs skip. Ask a simple question while they&rsquo;re still buzzing:</p>
<div class="lc-msg"><small>At the door</small>You: &ldquo;Would she like to come back next week?&rdquo;<br>Parent: &ldquo;Yes!&rdquo;<br>You: &ldquo;Great, shall we set it up now?&rdquo;</div>
<p>After a good experience, very few people say no. It takes a minute on their phone, and they leave as members instead of maybes.</p>

<h2>Don&rsquo;t feel guilty asking</h2>
<p>Lots of club owners hate this part because it feels like selling. But if you know your class will help their child, signing them up on the spot is helping them. You&rsquo;re not pushing anything. You&rsquo;re making the thing they already want easy.</p>
<div class="lc-callout"><p>If you believe your class will help their child, asking them to join is part of the job.</p></div>

<h2>Follow up with every trial</h2>
<p>Some families will want to think about it, and some will simply forget. Send a message the same evening or the next morning: how did they find it, and here&rsquo;s the link to keep their place.</p>
<p>How many trials go on to join is your conversion rate. Asking at the door and following up quickly are the two easiest ways to raise it.</p>
${term('conversion')}

<h2>A quick checklist</h2>
<ol>
  <li>Ask what they want their child to get out of it when they book.</li>
  <li>Show them, in the trial, that you&rsquo;ll get them there.</li>
  <li>Ask the child and the parent how it went, and build on the good bits.</li>
  <li>Ask if they&rsquo;d like to come back, then set it up there and then.</li>
  <li>Follow up with every family who doesn&rsquo;t join on the day.</li>
</ol>`,
    one: ['What each family wants from classes, asked when they book.', 'Joining in a tap, by card or Apple Pay, before they leave the hall.', 'A follow-up after every trial with the link to join, sent for you.', 'No-shows rebooked, and quiet ones asked what got in the way.', 'See how many of your trials join, every month.'],
    oneLead: 'From trial to member. <span>Before they leave the hall.</span>',
    faq: [
      ['How do I get more trials to join?', 'Know why they came, show them in the trial that you’ll get them there, then ask if they’d like to come back and set it up there and then. Follow up the same day with everyone who doesn’t join on the spot.'],
      ['What should I say at the end of a trial?', 'Ask the child if they had fun and the parent how they felt it went. Then ask if they’d like to come back next week, and when they say yes, offer to set it up now.']
    ],
    related: ['free-trial-or-paid-trial', 'get-more-trials-to-show-up']
  },

  {
    slug: 'should-kids-clubs-offer-discounts',
    topic: 'money',
    title: 'Should your kids’ club offer discounts?',
    short: 'Should you offer discounts?',
    docTitle: 'Should Your Kids’ Club Offer Discounts? Siblings, Friends and the Rules | Kanvas One',
    desc: 'Discounts can help families or quietly eat your profit. The only two we give, why they make sense, and the rules that keep it fair.',
    card: 'The only two discounts we give, why they make sense, and the rules that keep it fair.',
    read: 4,
    body: `
<p>Parents ask for discounts, and it&rsquo;s tempting to say yes. A little off here, a deal there. But every discount comes straight out of what you take home, and once you start, it&rsquo;s hard to stop.</p>

<h2>We don&rsquo;t discount regular members</h2>
<p>Our regular membership is our regular price, for everyone. We give just two discounts, and both are there for a reason.</p>

<h2>1. Siblings</h2>
<p>Some families want two or three children in a hobby, and the full price for all of them can be too much. A sibling discount helps those families do it.</p>
<p>It also makes good business sense. It costs money and effort to win a new member: ads, trials, your time. That&rsquo;s your customer acquisition cost, or CAC. A brother or sister is already through the door, so they cost you almost nothing to win. Think of it as two dancers for the cost of finding one.</p>
${term('cac')}
${compare('plain', { h: 'A brand new member', sub: 'What it takes to win them', items: ['Ads to reach them', 'A free trial and reminders', 'Your time following up'] }, { h: 'A brother or sister', sub: 'What it takes to win them', items: ['Already through the door', 'Already knows the club', 'Close to nothing'] })}

<h2>2. A friend&rsquo;s first month</h2>
<p>Every new member can bring a friend free for their first month. The friend arrives already knowing someone, and the new member settles in faster. We&rsquo;ve written up <a href="/learn/get-more-members-kids-club">how our friend&rsquo;s free month works</a>.</p>

<h2>Never discount because it&rsquo;s &ldquo;too expensive&rdquo;</h2>
<p>When a parent says your price is too much, the easy answer is a discount. Don&rsquo;t. Word gets around, it isn&rsquo;t fair on families paying full price, and it tells everyone your price is up for negotiation.</p>
<p>Instead, talk about what they get for it. We&rsquo;ve written about <a href="/learn/how-to-compete-with-a-cheaper-club">competing on value, not price</a>.</p>

<h2>Have rules, and stick to them</h2>
<ul>
  <li>Decide who gets a discount, how much, and when.</li>
  <li>Write it down, and make it the same for everyone.</li>
  <li>Keep it to one or two. Lots of overlapping discounts are hard to track and easy to argue about.</li>
</ul>
<div class="lc-callout"><p>A discount should have a reason and a rule. If it has neither, it&rsquo;s just a lower price.</p></div>

<h2>A quick checklist</h2>
<ol>
  <li>Keep one price for regular members.</li>
  <li>Use discounts that cost you little, like siblings and a friend&rsquo;s first month.</li>
  <li>Never discount because someone says it&rsquo;s too expensive.</li>
  <li>Write your rules down and apply them to everyone.</li>
</ol>`,
    one: ['Sibling discounts worked out and applied automatically.', 'A friend&rsquo;s free month, sent by each new member from the app.', 'Your rules set once, and applied the same for every family.', 'Your own scheme instead? Tell me and we build it in.'],
    oneLead: 'Fair discounts. <span>Applied for you.</span>',
    faq: [
      ['Should I offer a sibling discount?', 'It’s one of the few discounts that makes sense. It helps families who want more than one child in a hobby, and a sibling costs you almost nothing to win as a new member.'],
      ['What should I do when a parent says my club is too expensive?', 'Don’t discount. Talk about the value they get for the price: the classes, the coaches, the shows and what their child will achieve. Discounting for one family isn’t fair on the others.']
    ],
    related: ['how-to-compete-with-a-cheaper-club', 'how-much-to-charge-for-kids-classes']
  },

  {
    slug: 'how-to-compete-with-a-cheaper-club',
    topic: 'money',
    title: 'How to compete with a cheaper club down the road',
    short: 'Competing with a cheaper club',
    docTitle: 'How to Compete With a Cheaper Kids’ Club: Value, Not Price | Kanvas One',
    desc: 'There’s always someone cheaper. Why you shouldn’t compete on price, and how to compete on value so you attract the parents who want the best.',
    card: 'There’s always someone cheaper. Why you shouldn’t compete on price, and how to compete on value instead.',
    read: 4,
    body: `
<p>Sooner or later a parent mentions the club down the road that&rsquo;s cheaper. It&rsquo;s tempting to drop your price to match. Please don&rsquo;t.</p>

<h2>Don&rsquo;t compare yourself on price</h2>
<p>Your price should come from what you need to cover your bills and pay yourself, not from what someone else charges. We&rsquo;ve written up <a href="/learn/how-much-to-charge-for-kids-classes">how to work that out</a>. Drop below it to match a cheaper club, and you&rsquo;re running your club at a loss to win a race to the bottom.</p>

<h2>Compare the value instead</h2>
<p>Look at what families actually get from you compared with the cheaper club. Very often, cheaper means less:</p>
<ul>
  <li>fewer classes, or shorter ones</li>
  <li>less experienced coaches</li>
  <li>fewer shows and chances to perform</li>
  <li>no competitions or workshops</li>
  <li>fewer chances for children to really excel</li>
</ul>
<p>If you offer more, the price difference starts to look small.</p>

<h2>Think about it the way parents do</h2>
<p>A useful way to think about value is the value equation. Parents value your club more when the dream outcome is bigger and they&rsquo;re more confident their child will get there, and less when it takes longer or feels like more effort or risk.</p>
${term('valueequation')}
<p>So show them the outcome: the confident performer on stage, the medal, the friendships. Show them why they can trust you to get there: your coaches, your results, your reviews. And make it easy: simple booking, easy payments, everything in one app.</p>
${valueEquation()}

<h2>Show it, don&rsquo;t just have it</h2>
<p>None of this helps if parents can&rsquo;t see it. Put your shows, competitions, results and coaches on your website and social media. Talk about them at every trial. Make the value obvious before anyone mentions price.</p>
<div class="lc-callout"><p>Don&rsquo;t compete on price. Compete on value, and you get the parents who don&rsquo;t want the cheapest. They want the best.</p></div>

<h2>Our own story</h2>
<p>When we charged &pound;16 a month, we were very quiet. At &pound;50 a month, we were close to fully booked. The parents who join us aren&rsquo;t looking for the cheapest class. They&rsquo;re looking for the best one for their child.</p>

<h2>A quick checklist</h2>
<ol>
  <li>Set your price from your own numbers, not someone else&rsquo;s.</li>
  <li>List everything families get from you that they wouldn&rsquo;t get elsewhere.</li>
  <li>Show the outcome, the proof and how easy it is.</li>
  <li>Make your value obvious on your website and at every trial.</li>
</ol>`,
    one: ['A website that shows everything you offer: classes, coaches, shows, results.', 'Shows, competitions and workshops booked and paid in your app.', 'Reviews asked for after every trial, so parents can see the proof.', 'Your own app with your name on it, so you look like the established choice.'],
    oneLead: 'Show parents your value. <span>Before they ask the price.</span>',
    faq: [
      ['How do I compete with a cheaper dance school?', 'Don’t lower your price to match. Compare the value you give instead: more classes, experienced coaches, shows, competitions and workshops. Make that value obvious, and you attract parents who want the best, not the cheapest.'],
      ['Should I lower my prices to get more members?', 'Usually not. Your price should cover your costs and pay you. We were very quiet at £16 a month and close to fully booked at £50.']
    ],
    related: ['how-much-to-charge-for-kids-classes', 'should-kids-clubs-offer-discounts']
  },

  {
    slug: 'how-to-get-more-google-reviews',
    topic: 'members',
    title: 'How to get more Google reviews for your club',
    short: 'Getting more Google reviews',
    docTitle: 'How to Get More Google Reviews for Your Kids’ Club | Kanvas One',
    desc: 'Getting more reviews is simple: ask. The trick is asking at the right moment. When we ask, and more ways to ask that work.',
    card: 'Getting more reviews is simple: ask, at the right moment. When we ask, and more ways that work.',
    read: 5,
    body: `
<p>Google reviews help parents trust you, and they help you show up when parents search. Most clubs have far fewer than they should, and the reason is simple: they don&rsquo;t ask.</p>
<p>Most happy parents would gladly leave one. They just don&rsquo;t think of it unless you ask.</p>

<h2>Ask right after a good experience</h2>
<p>Timing is everything. Ask when a family has just had a great experience, while they&rsquo;re still feeling it.</p>
<p>Our favourite moment is straight after a dancer&rsquo;s first competition. The parent has just watched their child perform for the very first time. They have a story to tell, and they want to share it. Ask then, and the review almost writes itself.</p>

<h2>Other great moments to ask</h2>
${grid([['trophy', 'A first competition', 'Our favourite. They&rsquo;ve just watched their child perform.'], ['star', 'After a trial they loved', 'Their child came out grinning.'], ['ticket', 'After a show', 'The whole family is buzzing.'], ['chart', 'A new level or badge', 'Progress they can be proud of.'], ['message', 'When a parent thanks you', 'They&rsquo;ve already said it. Ask them to share it.'], ['clock', 'The end of a term', 'Looking back at how far their child has come.']])}

<h2>Ways to ask</h2>
<ul>
  <li><strong>Send a direct link.</strong> A message with a link that opens straight onto your Google review box. One tap, no searching.</li>
  <li><strong>Ask in person, then send the link.</strong> &ldquo;Would you mind leaving us a review? I&rsquo;ll send you the link now.&rdquo;</li>
  <li><strong>Put a QR code up</strong> at your door or reception that opens your review page.</li>
  <li><strong>Add it to your messages</strong>: an end-of-term note, a show recap, or the bottom of your emails.</li>
  <li><strong>Ask your coaches to mention it</strong> whenever a parent tells them how much their child loves the class.</li>
  <li><strong>Reply to every review</strong>, so parents can see you read them and care.</li>
</ul>
<p>Keep it honest. Ask for an honest review, not a five-star one, and don&rsquo;t offer anything in return. Google&rsquo;s own rules don&rsquo;t allow rewards for reviews.</p>
<div class="lc-callout"><p>The best time to ask for a review is the moment a family is proudest of their child.</p></div>

<h2>The same goes for referrals</h2>
<p>Asking families to recommend you works exactly the same way. Ask after a good experience: when their child has just got top marks, or performed in front of a huge crowd. That&rsquo;s when they&rsquo;re most likely to think of a friend who&rsquo;d love it too.</p>
${term('referral')}

<h2>A quick checklist</h2>
<ol>
  <li>Ask every happy family, not just now and then.</li>
  <li>Ask right after a good experience, like a first competition or show.</li>
  <li>Send a direct link so it takes one tap.</li>
  <li>Reply to every review.</li>
  <li>Ask for referrals at the same moments.</li>
</ol>`,
    one: ['A Google review asked for automatically after every trial.', 'Another asked for after a dancer&rsquo;s first competition.', 'A direct link straight to your Google review box.', 'A friend&rsquo;s free month each new member can send from the app.'],
    oneLead: 'Reviews asked for at the right moment. <span>Every time.</span>',
    faq: [
      ['How do I get more Google reviews for my club?', 'Ask every happy family, right after a good experience, with a direct link that opens your review box. Great moments are after a trial their child loved, a first competition or a show.'],
      ['Can I offer a reward for a Google review?', 'No. Google’s rules don’t allow rewards for reviews. Ask for an honest review at the right moment instead.']
    ],
    related: ['get-your-club-found-on-google-and-chatgpt', 'how-to-turn-trials-into-members']
  },

  {
    slug: 'get-members-to-take-a-second-class',
    topic: 'money',
    title: 'How to get members to take a second class',
    short: 'Getting a second class',
    docTitle: 'How to Get Members to Take a Second Class at Your Club | Kanvas One',
    desc: 'A member taking two classes gets twice the experience every week, and you grow without finding a new family. How to make it easy.',
    card: 'Twice the experience for them, more income for you, without finding a new family. How to make it easy.',
    read: 3,
    body: `
<p>Every member who takes a second class gets twice as much experience every week, and you grow your income without having to find a new family. In business, offering an existing customer more like this is called an upsell.</p>
${term('upsell')}

<h2>Make other classes easy to find and join</h2>
<p>Most of the time, the biggest thing is simply making your other classes visible and easy to join. Families can&rsquo;t sign up for a class they don&rsquo;t know about, or one that takes a form and an email to join. Show the full timetable where parents already look, and let them add a class in a tap.</p>

<h2>Let members try another class free</h2>
<p>Now and then, open free trials of other classes to your existing members. They can see if it&rsquo;s a good fit, with no risk. If they love it, offer them the chance to carry on there and then, and get twice as much every week.</p>
${chain('A second class, without the hard sell', [['1', 'One class a week'], ['2', 'A free try of another'], ['3', 'They love it'], ['2&times;', 'the experience every week', true]])}
<div class="lc-callout"><p>A free try of another class is the easiest second class you&rsquo;ll ever sell.</p></div>

<h2>A quick checklist</h2>
<ol>
  <li>Show your whole timetable where parents already look.</li>
  <li>Let members add a class in a tap.</li>
  <li>Open free trials of other classes to members now and then.</li>
  <li>After a member&rsquo;s free try, offer to sign them up there and then.</li>
</ol>`,
    one: ['Your full timetable in the app, where parents already look.', 'A second class added in a tap.', 'Sibling and family discounts applied automatically.', 'Want members to try another class free? Tell me and we set it up.'],
    oneLead: 'More from every member. <span>In a tap.</span>',
    faq: [
      ['How do I get members to do more than one class?', 'Make your other classes easy to see and join, and now and then let members try another class free. If they love it, offer to sign them up straight away.']
    ],
    related: ['make-more-money-from-your-kids-club', 'how-to-turn-trials-into-members']
  },

  {
    slug: 'cancel-any-time-or-minimum-contract',
    topic: 'money',
    title: 'Cancel any time or a minimum contract: which is better?',
    short: 'Cancel any time or a contract?',
    docTitle: 'Should Kids’ Club Members Cancel Any Time or Sign a Contract? | Kanvas One',
    desc: 'Should members sign up for a term, or be free to cancel any time? Why we let families cancel any time, and how it gets more people to join.',
    card: 'Should members sign up for a term, or cancel any time? Why we let families cancel any time.',
    read: 3,
    body: `
<p>Lots of clubs ask families to sign up for a term, or give a month&rsquo;s notice to leave. It feels safer: the money is guaranteed. But it can cost you more members than it keeps.</p>

<h2>It comes back to risk</h2>
<p>When a parent is deciding whether to join, a contract is one more thing to worry about. What if she hates it after three weeks? What if we move? What if money gets tight? The more a decision feels like a commitment, the more people put it off.</p>
${term('perceivedrisk')}

<h2>Why we let families cancel any time</h2>
<p>We let members cancel any time. It takes the risk away, and that means more families are willing to try joining in the first place.</p>
${compare('fix', { h: 'A minimum contract', sub: 'What the parent thinks', items: ['&ldquo;What if she hates it after three weeks?&rdquo;', '&ldquo;What if money gets tight?&rdquo;', '&ldquo;Let&rsquo;s think about it.&rdquo;'] }, { h: 'Cancel any time', sub: 'What the parent thinks', items: ['&ldquo;We can try it and stop if it&rsquo;s not for her.&rdquo;', '&ldquo;There&rsquo;s nothing to lose.&rdquo;', '&ldquo;Let&rsquo;s sign up.&rdquo;'] })}
<p>It fits the value equation too. The less effort and risk involved, the more your club is worth to a parent.</p>
${term('valueequation')}

<h2>What keeps members isn&rsquo;t a contract</h2>
<p>A family who wants to leave will find a way, contract or not, and a parent who feels trapped isn&rsquo;t going to recommend you. What keeps members is the value they get every week: progress, friends, something to work towards. We&rsquo;ve written about <a href="/learn/stop-children-dropping-out-of-your-club">how we keep members past month five</a>.</p>
<p>And give them a pause button. A busy month or an injury doesn&rsquo;t have to mean goodbye.</p>
<div class="lc-callout"><p>Make joining feel safe, and earn the right to keep them every month.</p></div>

<h2>A quick checklist</h2>
<ol>
  <li>Think about how risky joining feels to a parent.</li>
  <li>Let members cancel any time, so more families try.</li>
  <li>Keep members with value, not contracts.</li>
  <li>Offer pause instead of cancel.</li>
</ol>`,
    one: ['Monthly memberships families can pause or cancel in a tap.', 'A kind &ldquo;we haven&rsquo;t seen you&rdquo; message when a child hasn&rsquo;t been in for four weeks.', 'Your terms accepted when they join, so everyone knows where they stand.', 'We practise it too: One has no contract.'],
    oneLead: 'Easy to join. <span>A reason to stay.</span>',
    faq: [
      ['Should members have to sign a contract at my club?', 'We don’t think so. Letting families cancel any time makes joining feel safe, so more of them try. What keeps members is the value they get every week, not a contract.'],
      ['Won’t more people leave if they can cancel any time?', 'Families who want to leave usually find a way regardless. Keep them with progress, friends and goals, and offer pause instead of cancel for busy months.']
    ],
    related: ['stop-children-dropping-out-of-your-club', 'free-trial-or-paid-trial']
  },

  {
    slug: 'stop-your-club-taking-over-your-life',
    topic: 'running',
    title: 'How to stop your club taking over your life',
    short: 'Getting your evenings back',
    docTitle: 'How to Stop Your Kids’ Club Taking Over Your Life | Kanvas One',
    desc: 'Teaching is the fun part. It’s the late-night messages, chasing leads and not knowing who’s paid that take over. Where the time goes, and how to get it back.',
    card: 'Teaching is the fun part. It’s the messages, chasing and paperwork that take over. How to get your evenings back.',
    read: 6,
    body: `
<p>Ask any club owner why they started, and they&rsquo;ll talk about the teaching: the choreography, the classes, watching a shy child come out of their shell. That&rsquo;s the fun part, and nobody wants less of it.</p>
<p>It&rsquo;s everything around it that takes over. The parent messaging at 10pm to ask what time class starts. Following up the family who enquired last week. Chasing the trial who said they&rsquo;d join. Scrolling your bank app to work out who&rsquo;s paid. Posting the same notice in four places and still hearing &ldquo;I didn&rsquo;t know&rdquo;.</p>
<p>None of that has to be you. Here&rsquo;s where the time goes, and how to get it back.</p>

<h2>1. Finding new families</h2>
<p>Posting on social media and hoping takes hours and brings in a trickle. Local Facebook and Instagram ads that advertise a free trial reach parents near you who have never heard of you, and keep running while you teach. We&rsquo;ve shared <a href="/learn/are-facebook-ads-worth-it-for-kids-clubs">exactly what ours cost and what they brought in</a>.</p>
<p>Send those parents to a page where they can book a trial straight away, so a new family never has to message you to get started.</p>

<h2>2. Answering the same questions</h2>
<p>Most messages from new parents ask the same things: what time, what age, what to wear, how much, where to park. If your website answers every one of them before they book, they don&rsquo;t need to ask. Fewer questions, fewer late-night messages. Here&rsquo;s <a href="/learn/what-should-a-kids-club-website-have">what a club website needs</a>.</p>

<h2>3. Following up with every lead</h2>
<p>Every family who shows an interest is a lead, and each one needs something different. The one who booked a trial needs reminding. The one who didn&rsquo;t turn up needs asking what happened and offering another date. The one who loved it needs asking to join. Doing that by hand, for every family, every week, is where evenings disappear.</p>
${term('lead')}
<p>It doesn&rsquo;t have to be done by hand. When trials check in with a QR code at the door, or the coach ticks them off on the register, the system knows exactly who came. Families who didn&rsquo;t come are asked what got in the way and offered another date. Families who did are sent the link to join. Nobody has to remember.</p>
${term('automation')}

<h2>4. Forms and paperwork before the first class</h2>
<p>Chasing consent forms, medical details and emergency contacts is one of the most tiresome jobs in any club. So don&rsquo;t chase them.</p>
<p>At our club, new members register themselves before their first class. They accept the terms and conditions, give photo consent, pay, add emergency contacts, and anything else we need. Only then does their class pass unlock.</p>
<p>That means every child who walks through the door has everything sorted. You can rest easy, and you never chase a form again.</p>

<h2>5. Knowing who&rsquo;s paid</h2>
<p>Card payments taken automatically mean you can see who has paid at a glance. Missed payments are chased for you, and show up in red on the member&rsquo;s pass at the door. Here&rsquo;s <a href="/learn/stop-chasing-late-payments">how we stopped chasing payments</a>.</p>

<h2>6. Telling everyone everything</h2>
<p>A class is cancelled. You post it on Instagram, then Facebook, then the WhatsApp group, then send an email, then text the families you think might have missed it. Someone still turns up.</p>
<p>With your own app, you post it once and it lands on every family&rsquo;s lock screen as a notification. You can be certain every member got the message. Parents message the club through the app too, instead of your personal number, so you can answer in your own time.</p>
${postOnce('Photo day on Saturday', 'Full club kit and hair tied back please. Photos start at 9am in the main hall.')}

<figure class="lc-flow" aria-label="How a new family joins without you lifting a finger">
  <p class="lc-flow-h">A new family, without you lifting a finger</p>
  <ol data-lc-flow>
    <li><span class="dot">1</span><span><span class="when">They see your ad</span><span class="bub">They book a free trial on your website, with every question already answered.</span><span class="chan">Ad and website</span></span></li>
    <li><span class="dot">2</span><span><span class="when">Before the trial</span><span class="bub">Reminders the evening before, the morning of and an hour before.</span><span class="chan">Texts</span></span></li>
    <li><span class="dot">3</span><span><span class="when">At the door</span><span class="bub">They check in with a QR code, so you know they came.</span><span class="chan">Coach&rsquo;s phone</span></span></li>
    <li><span class="dot">4</span><span><span class="when">The same day</span><span class="bub">They join in a tap. If they didn&rsquo;t come, they&rsquo;re offered another date.</span><span class="chan">Text and email</span></span></li>
    <li><span class="dot">5</span><span><span class="when">Before their first class</span><span class="bub">They register: terms, photo consent, payment, emergency contacts.</span><span class="chan">Their app</span></span></li>
    <li class="end"><span class="dot">&#10003;</span><span><span class="when">First class</span><span class="bub">Their pass unlocks. Everything&rsquo;s sorted.</span></span></li>
  </ol>
</figure>

<div class="lc-callout"><p>Keep the teaching. Hand over everything else.</p></div>

<h2>A quick checklist</h2>
<ol>
  <li>Let ads and a booking page find your new families.</li>
  <li>Answer every common question on your website.</li>
  <li>Check trials in, so follow-ups go to the right people automatically.</li>
  <li>Have members register and pay before their first class.</li>
  <li>Take payments automatically, and let the system chase.</li>
  <li>Post once in your own app, instead of everywhere.</li>
</ol>`,
    one: ['Local ads that find you trials, with the first 3 months on us.', 'Trials that book themselves, reminded and followed up for you.', 'QR check-in that knows who came, and chases up who didn&rsquo;t.', 'Members who register, consent and pay before their first class.', 'One app: post once, every family sees it on their lock screen.', 'Your own website and app, with your club&rsquo;s name on them.'],
    oneLead: 'All of it, built in. <span>With your own app and website.</span>',
    faq: [
      ['How do I stop my club taking over my life?', 'Hand over everything that isn’t teaching: let ads and a booking page find new families, answer common questions on your website, follow up trials automatically, have members register and pay before their first class, and post updates once in your own app.'],
      ['How can I cut the admin at my dance school?', 'Most admin is following up, chasing forms and payments, and telling everyone everything. Automatic follow-ups, registration before the first class, card payments and one app for all your messages take most of it away.'],
      ['How do I stop parents messaging me late at night?', 'Answer the common questions on your website so they don’t need to ask, post updates in your own app so everyone sees them, and have parents message the club through the app instead of your personal number.']
    ],
    related: ['what-should-a-kids-club-website-have', 'get-more-trials-to-show-up']
  },

  {
    slug: 'club-business-words',
    topic: 'running',
    title: 'Club business words, explained',
    short: 'Business words',
    docTitle: 'Club Business Words Explained: Churn, Friction, Conversion and More | Kanvas One',
    desc: 'Churn, CAC, friction, conversion rate, the value equation. The business words behind running a club, in plain English, with examples from a real kids’ club.',
    card: 'Churn, friction, conversion rate, lifetime value. The business words behind running a club, in plain English.',
    read: 4,
    body: `
<p>Running a club is running a business, and business comes with its own words. You don&rsquo;t need them to run a great club. But knowing them makes it much easier to spot what&rsquo;s working, what isn&rsquo;t, and what to fix.</p>
<p>Here they are in plain English, with examples from a real club. Wherever you see a word with a dotted line in our guides, tap it for the same explanation.</p>
${WORD_LIST}`,
    one: ['Trials, show-ups and new members counted for you.', 'See who&rsquo;s joined, who&rsquo;s paused and who&rsquo;s left.', 'Failed payments chased, so involuntary churn stays low.', 'Your website and booking built with as little bad friction as possible.', 'A flat &pound;250 a month. We take 0% of your payments.'],
    oneLead: 'The numbers that matter. <span>Kept for you.</span>',
    faq: [
      ['What is churn?', 'Churn is how many members leave over a period, usually counted each month. If 3 of your 60 members leave in a month, your churn is 5%.'],
      ['What is lifetime value?', 'What one member is worth over the whole time they stay. At £50 a month, a child who stays two years is worth £1,200.']
    ],
    related: ['stop-children-dropping-out-of-your-club', 'what-should-a-kids-club-website-have']
  }
];

const bySlug = Object.fromEntries(GUIDES.map((g) => [g.slug, g]));

/* ---------------- Page shell ---------------- */

const NAV = `<header class="nav" id="nav">
  <div class="nav-inner">
    <a class="logo" href="/" aria-label="Kanvas One — home">one<span class="wm-dot">.</span></a>
    <button class="nav-chat" id="navChat" type="button" aria-label="Chat with us" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12.5a7.5 7.5 0 0 1-11.1 6.6L4 20l1-4.5A7.5 7.5 0 1 1 20 12.5z"/></svg></button>
    <button class="burger" id="burger" aria-label="Menu" aria-expanded="false" aria-controls="menu">
      <span></span><span></span>
    </button>
  </div>
</header>

<div class="menu" id="menu" hidden></div>
<div class="scrim" id="scrim" hidden></div>
`;

/* The site footer, tidied: the Learning Centre as a big way in, then three
   short columns. index.html carries the same markup. */
const FOOTER = `<footer class="foot" data-tone="light">
  <div class="wrap">
    <div class="ft-top">
      <p class="foot-logo">one<span class="wm-dot">.</span></p>
      <p class="foot-by">by Kanvas</p>
    </div>
    <p class="ft-tag">Everything you need to fill your club and run it. Built in our own kids&rsquo; club, running since 2017.</p>
    <a class="ft-learn" href="/learn"><span class="k">Free guides for club owners</span><b>Kanvas One Learning Centre</b><span class="d">How to get more trials, more members and more from every class.</span><span class="arr" aria-hidden="true">&rsaquo;</span></a>

    <div class="ft-cols ft-cols3">
      <nav class="ft-col" aria-label="One">
        <h4>One</h4>
        <a href="/#one">How it works</a><a href="/#results">Results</a><a href="/#everything">Pricing</a><a href="/#faq">Questions</a><a href="/profit-plan">Free profit plan</a><a href="/login.html">Log in</a>
      </nav>
      <nav class="ft-col" aria-label="Learn">
        <h4>Learn</h4>
        <a href="/learn">Learning Centre</a><a href="/learn/get-more-trials-to-show-up">Trials that turn up</a><a href="/learn/get-more-members-kids-club">Getting more members</a><a href="/learn/are-facebook-ads-worth-it-for-kids-clubs">Are ads worth it?</a>
      </nav>
      <nav class="ft-col" aria-label="Kanvas">
        <h4>Kanvas</h4>
        <a href="/clubs">Kids&rsquo; clubs</a><a href="/trades">Trades</a><a href="/websites">Websites from &pound;9.99</a><a href="/contact">Contact</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/cookies">Cookies</a><button class="linkish-foot" type="button" data-consent-open hidden>Cookie settings</button>
      </nav>
    </div>

    <hr class="ft-rule">
    <p class="foot-legal">All prices in GBP. The price you see is the total price &mdash; we are not VAT registered, so there is no VAT to add. 3 months of ads included means we pay your ad spend, up to &pound;100 a month, for the first 3 months after your ads start, while you stay on One. Your ads start once your website and app are both live. After those 3 months, ads are optional: you pay Meta directly for any you keep, and we run them as part of One. 10 trials in 3 months, or 3 months free: if the ads we fund in those 3 months bring fewer than 10 trial bookings, your next 3 months of One are free (see terms). No contract: cancel any time.</p>
    <div class="ft-bottom">
      <div>
        <p class="foot-copy">&copy; <span id="year">2026</span> Kanvas One. All rights reserved.</p>
        <p class="ft-made">Proudly made in the North East</p>
      </div>
    </div>
  </div>
</footer>`;

const SCRIPTS = `<script src="/consent.js?v=5712679a"></script>
<script src="/supabase-config.js?v=90fd89dc"></script>
<script src="/session.js?v=59739977"></script>
<script src="/script.js?v=6c69ddf5"></script>
<script src="/chat.js?v=e0fc2af5" data-site="9094de37-b610-41b6-98f1-2aaf8f5bd52b" data-name="Kanvas One" data-trigger="#navChat" data-full data-style="sheet" data-color="#c93e09" data-agent="Kane" data-avatar="/assets/kane-sm.jpg?v=cff8a019" data-subtitle="Founder of One &middot; runs a dance school too" data-intro="Hi, I&rsquo;m Kane. I&rsquo;ve run our dance school since 2017 and built One. Ask me anything about running or growing your club. I&rsquo;ll give you a straight answer." data-quick="How do I get more trials to turn up?|Can I see your site and app?|Is it right for my club?" defer></script>
<script src="/beacon.js?v=77a73cd5" data-site="9094de37-b610-41b6-98f1-2aaf8f5bd52b" defer></script>
<script src="/admin-pill.js?v=06da798b"></script>
<script src="/learn/terms.js?v=bbafc742" defer></script>
<script src="/glossary.js?v=ce336630" defer></script>
<script src="/onemark.js?v=26409b0c" defer></script>
<script src="/learn/learn.js?v=3a84b052" defer></script>
</body>
</html>
`;

function head({ title, desc, canonical, ld }) {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${ESC(desc)}">
<meta name="theme-color" content="#ffffff">
<meta property="og:title" content="${ESC(title)}">
<meta property="og:description" content="${ESC(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Kanvas One">
<meta property="og:image" content="https://kanvas.one/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${canonical}">
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')}
<link rel="icon" href="/assets/favicon.svg?v=fa41229e" type="image/svg+xml">
<link rel="icon" href="/assets/favicon-32.png?v=6ae0fb7f" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/favicon-180.png?v=0ecf9df9">
<link rel="stylesheet" href="/styles.css?v=aff04046">
<link rel="stylesheet" href="/home.css?v=7cd1c862">
<link rel="stylesheet" href="/learn/learn.css?v=8e2f7fb2">
</head>
<body class="home learn">

<a class="skip" href="#main">Skip to content</a>

${NAV}`;
}

const AUTHOR = { '@type': 'Person', name: 'Kane Foster', jobTitle: 'Founder of Kanvas One, owner of Kanvas Academy', url: SITE + '/' };
const PUBLISHER = { '@type': 'Organization', name: 'Kanvas One', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/assets/favicon-192.png' } };

function card(g) {
  return `<a class="lc-card" href="/learn/${g.slug}" data-topic="${g.topic}" data-text="${ESC(plain(g.title + ' ' + g.card + ' ' + g.desc).toLowerCase())}">
      <span class="tag">${TOPICS[g.topic]}</span>
      <b>${g.title}</b>
      <span class="d">${g.card}</span>
      <span class="go">Read the guide &middot; ${g.read} min &rsaquo;</span>
    </a>`;
}

function guidePage(g) {
  const url = `${SITE}/learn/${g.slug}`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: plain(g.title), description: g.desc, author: AUTHOR, publisher: PUBLISHER, datePublished: UPDATED, dateModified: UPDATED, mainEntityOfPage: url, image: SITE + '/assets/og-image.png', inLanguage: 'en-GB' },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Kanvas One', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Learning Centre', item: SITE + '/learn' },
      { '@type': 'ListItem', position: 3, name: plain(g.short), item: url }] }
  ];
  if (g.faq) ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: g.faq.map(([q, a]) => ({ '@type': 'Question', name: plain(q), acceptedAnswer: { '@type': 'Answer', text: plain(a) } })) });
  const related = (g.related || []).map((s) => bySlug[s]).filter(Boolean);
  return head({ title: g.docTitle, desc: g.desc, canonical: url, ld }) + `<main id="main">
<article>
<header class="lc-hero" data-tone="white">
  <div class="wrap"><div class="lc-col">
    <nav class="lc-crumb" aria-label="Breadcrumb"><a href="/learn">Learning Centre</a><span aria-hidden="true">&rsaquo;</span><span>${TOPICS[g.topic]}</span></nav>
    <h1>${g.title}</h1>
    <p class="lc-stand">${g.desc.replace(/'/g, '&rsquo;').replace(/’/g, '&rsquo;').replace(/£/g, '&pound;')}</p>
    <p class="lc-by"><img src="/assets/kane-sm.jpg?v=cff8a019" alt="" width="44" height="44"><span><b>Kane Foster</b>, founder of Kanvas One and owner of Kanvas Academy in Newcastle<br>${g.read} min read &middot; Updated ${UPDATED_TEXT}</span></p>
  </div></div>
</header>
<div class="lc-body"><div class="wrap"><div class="lc-col">
${g.body.trim()}
${g.faq ? `<h2>Questions</h2>
<div class="lc-faq">
${g.faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('\n')}
</div>` : ''}
</div></div></div>
</article>
${oneBand(g.oneLead, g.one)}
${related.length ? `<section class="lc-more" data-tone="white">
  <div class="wrap">
    <h2>Keep reading</h2>
    <div class="lc-cards">
    ${related.map(card).join('\n    ')}
    <a class="lc-card" href="/learn"><span class="tag">Learning Centre</span><b>Every guide for club owners</b><span class="d">Straight answers on trials, members, pricing, payments and software.</span><span class="go">See them all &rsaquo;</span></a>
    </div>
  </div>
</section>` : ''}
</main>

${FOOTER}
${SCRIPTS}`;
}

function indexPage() {
  const url = `${SITE}/learn`;
  const desc = 'Free guides for kids’ club owners: more trials and members, what to charge, late payments, keeping members, ads, apps and choosing software. Written by a club owner.';
  const ld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Kanvas One Learning Centre', description: desc, url, publisher: PUBLISHER,
      hasPart: GUIDES.map((g) => ({ '@type': 'Article', headline: plain(g.title), url: `${SITE}/learn/${g.slug}` })) }
  ];
  const topics = Object.keys(TOPICS).filter((t) => GUIDES.some((g) => g.topic === t));
  return head({ title: 'Kanvas One Learning Centre: Guides for Kids’ Club Owners', desc, canonical: url, ld }) + `<main id="main">
<header class="lc-hero" data-tone="white">
  <div class="wrap"><div class="lc-col" style="max-width:860px">
    <p class="lc-kicker">Free guides for club owners</p>
    <h1>Kanvas One Learning Centre</h1>
    <p class="lc-stand">Straight answers on getting more trials and members, what to charge, and keeping the families you have. Written from running our own kids&rsquo; club, with our real numbers.</p>
    <label class="lc-search" for="lcSearch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.3 16.3L21 21"/></svg><input id="lcSearch" type="search" placeholder="Search, e.g. trials, ads, dance" autocomplete="off" aria-label="Search the guides"></label>
    <div class="lc-topics" role="group" aria-label="Topics">
      <button type="button" data-topic="" aria-pressed="true">All</button>${topics.map((t) => `<button type="button" data-topic="${t}" aria-pressed="false">${TOPICS[t]}</button>`).join('')}
    </div>
    <p class="lc-words"><a href="/learn/club-business-words">New to the jargon? Club business words, explained &rsaquo;</a></p>
  </div></div>
</header>
<section class="lc-more" style="padding-top:8px" data-tone="white">
  <div class="wrap">
    <div class="lc-cards" id="lcCards">
    ${GUIDES.map(card).join('\n    ')}
    </div>
    <p class="lc-none" id="lcNone" hidden>No guide on that yet. <a href="#" data-chat-open="Hi Kane, I was looking for a guide on this:">Ask me instead &rsaquo;</a></p>
  </div>
</section>
${oneBand('Everything in these guides. <span>In one system.</span>', ['Trials confirmed and reminded four times, automatically.', 'Bring-a-friend passes, joining in a tap and follow-ups sent for you.', 'Ads run for you, the first 3 months on us.', 'Your own app and website, with your club&rsquo;s name.', 'A flat &pound;250 a month. We take 0% of your payments.'])}
</main>

${FOOTER}
${SCRIPTS}`;
}

fs.writeFileSync(path.join(__dirname, 'index.html'), indexPage());
GUIDES.forEach((g) => fs.writeFileSync(path.join(__dirname, g.slug + '.html'), guidePage(g)));
console.log('learn: index + ' + GUIDES.length + ' guides');

module.exports = { GUIDES };
