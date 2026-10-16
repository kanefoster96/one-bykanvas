/* The numbers from the site's visitor counter, as on the web app:
 * Today (live, every 15 seconds while on screen), 7, 30 or 90 days, each
 * against the period before. Four numbers on black, who is on the site
 * now, every visit as a story, then where they came from and what they
 * did. Starter's Home is this screen with "is my site up?" on top. */
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Page, useEvery, useLoad } from '../components/screen';
import { Card, Chip, Empty, FadeIn, Label, Segmented, Skeleton, animateNext } from '../components/ui';
import Press from '../components/Press';
import Icon from '../components/Icon';
import { api } from '../lib/api';
import { useApp } from '../state/app';
import { C, R } from '../theme';
import { openOutside, share } from '../lib/phone';
import { clock, countryName, delta, fmt, minutesText, pageName, pct, pounds, secsText, sessionNo, whenVisit } from '../lib/format';

const PERIODS = [{ value: 'today', label: 'Today' }, { value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }];

function Delta({ now, before, night, text }) {
  const d = text !== undefined ? { text, dir: '' } : delta(now, before);
  if (!d.text) return null;
  const color = d.dir === 'up' ? (night ? C.orLight : C.or) : d.dir === 'down' ? (night ? '#ff8a80' : C.bad) : (night ? C.onNight2 : C.ink3);
  return <Text style={[s.delta, !night && { marginLeft: 0, marginBottom: 0 }, { color }]}>{d.text}</Text>;
}

function Tile({ label, n, children }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileN} adjustsFontSizeToFit numberOfLines={1}>{n}</Text>
      {children}
    </View>
  );
}

function Spark({ series }) {
  const [w, setW] = useState(0);
  const H = 110, pad = 4;
  const max = Math.max(1, ...series.map((d) => d.visitors || 0));
  const step = series.length > 1 ? (w - pad * 2) / (series.length - 1) : 0;
  const pts = series.map((d, i) => [pad + i * step, H - pad - ((d.visitors || 0) / max) * (H - pad * 2)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = pts.length ? line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (H - pad) + ' L' + pts[0][0].toFixed(1) + ' ' + (H - pad) + ' Z' : '';
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
      {w && pts.length ? (
        <Svg width={w} height={H}>
          <Path d={area} fill={C.or2} opacity={0.1} />
          <Path d={line} fill="none" stroke={C.or2} strokeWidth={2.2} strokeLinejoin="round" />
        </Svg>
      ) : null}
    </View>
  );
}

function BarList({ rows, keyName, nName, empty, label }) {
  if (!rows || !rows.length) return <Text style={s.empty}>{empty}</Text>;
  const max = rows[0][nName] || 1;
  return rows.map((r, i) => (
    <View key={i} style={s.li}>
      <Text style={s.liKey} numberOfLines={2}>{label ? label(r[keyName]) : r[keyName]}</Text>
      <View style={[s.liBar, { width: Math.max(6, Math.round((r[nName] / max) * 60)) }]} />
      <Text style={s.liN}>{fmt(r[nName])}</Text>
    </View>
  ));
}

function FunnelRows({ rows, total }) {
  return rows.map((r) => (
    <View key={r[0]} style={s.fRow}>
      <Text style={s.fLabel} numberOfLines={2}>{r[0]}</Text>
      <View style={s.fTrack}><View style={[s.fBar, { width: (r[1] ? Math.max(2, (r[1] / (total || 1)) * 100) : 0) + '%' }, r[2] === 'left' && { backgroundColor: C.line }]} /></View>
      <Text style={s.fN}>{fmt(r[1])}</Text>
    </View>
  ));
}

function stepText(st, first) {
  if (st.kind === 'view') return (first ? 'Landed on ' : 'Opened ') + pageName(st.path);
  const label = '“' + st.label + '”';
  const t = st.target || '';
  if (/^step:\d+$/.test(t)) return '✔ ' + st.label;
  const lv = /^leave:(\d+):(\d+)$/.exec(t);
  if (lv) return 'Left ' + pageName(st.path) + ' after ' + secsText(Number(lv[1])) + ', having scrolled ' + lv[2] + '% of it';
  if (t === 'form-start') return 'Tapped into ' + label;
  if (t === 'seen') return 'Scrolled to ' + st.label;
  if (t === 'form') return 'Sent the form ' + label;
  if (t === 'form-incomplete') return 'Tried to send the form ' + label + ', something was missing';
  if (t === 'phone') return 'Tapped to call ' + label;
  if (t === 'email') return 'Tapped to email ' + label;
  if (t === 'message') return 'Tapped to message ' + label;
  if (t.charAt(0) === '/') return 'Pressed ' + label + (t !== st.path ? ' → ' + pageName(t) : '');
  if (t) return 'Pressed ' + label + ' → left for ' + t;
  return 'Pressed ' + label;
}
function sourceText(v) { if (v.from_ad === 'likely') return v.source + ' · likely an ad'; return v.source === 'Direct' ? 'Direct visit' : v.source; }

/* One visit, as a story: tap to see every step. */
function Visit({ v, open, onToggle, last }) {
  const bits = ['Landed on ' + pageName(v.landing), v.pages === 1 ? '1 page' : v.pages + ' pages'];
  if (v.clicks) bits.push(v.clicks === 1 ? '1 click' : v.clicks + ' clicks');
  bits.push(v.stayed != null ? 'stayed ' + secsText(v.stayed) : minutesText(v.first_at, v.last_at));
  const where = [v.city, v.city ? null : (v.country ? countryName(v.country) : null), v.device === 'phone' ? 'phone' : 'desktop'].filter(Boolean);
  const far = (v.done || [])[(v.done || []).length - 1];
  const chips = [[sourceText(v), !!v.from_ad]];
  if (v.sent_form) chips.push(['Sent a form', true]); else if (v.started_form) chips.push(['Started the form', false]);
  if (far) chips.push(['Got to: ' + far.label, far.n >= 4]);
  if (v.messaged) chips.push(['Messaged', true]);
  if (v.paid) chips.push(['Paid', true]);
  return (
    <View style={[s.visit, !last && s.line]}>
      <Press onPress={onToggle} feel="select" scale={0.99} style={s.visitHead}>
        <View style={[s.vDot, v.live && { backgroundColor: C.or2 }]} />
        <View style={{ flex: 1 }}>
          <View style={s.vTop}>
            <Text style={s.vWho}>{'Visitor #' + sessionNo(v.session)}</Text>
            <Text style={s.vWhen}>{v.live ? 'Now on ' + pageName(v.now_path) : whenVisit(v.first_at)}</Text>
          </View>
          <Text style={s.vLine}>{bits.join(' · ') + ' · ' + where.join(', ')}</Text>
          <View style={s.vChips}>{chips.map((c, i) => <Text key={i} style={[s.vChip, c[1] && s.vChipOn]}>{c[0]}</Text>)}</View>
        </View>
      </Press>
      {open ? (
        <FadeIn style={s.steps}>
          <View style={s.stepRow}><Text style={s.stepTime}>{clock(v.first_at)}</Text><Text style={s.stepText}>{'From ' + (v.from_ad === 'yes' ? v.source : v.from_ad === 'likely' ? v.source + ' (likely an ad)' : sourceText(v)) + (v.campaign ? ': ' + v.campaign : '')}</Text></View>
          {(v.steps || []).map((st, i) => {
            const key = st.kind === 'click' && ['form', 'phone', 'email', 'message'].indexOf(st.target) >= 0;
            return <View key={i} style={s.stepRow}><Text style={s.stepTime}>{clock(st.at)}</Text><Text style={[s.stepText, key && { color: C.or, fontWeight: '600' }]}>{stepText(st, i === 0)}</Text></View>;
          })}
          {v.more_steps ? <Text style={s.stepText}>{'… and ' + v.more_steps + ' more'}</Text> : null}
          {v.live ? <View style={s.stepRow}><Text style={s.stepTime}>now</Text><Text style={[s.stepText, { color: C.or, fontWeight: '600' }]}>{'Still on ' + pageName(v.now_path)}</Text></View> : null}
        </FadeIn>
      ) : null}
    </View>
  );
}

/* Starter's home: is the site up? Checked each time the tab shows. */
function SiteCard({ site }) {
  const [st, setSt] = useState({ dot: '', title: 'Checking your website…', hint: '' });
  const url = site && site.url ? String(site.url).replace(/\/+$/, '') : '';
  const host = url.replace(/^https?:\/\//, '');
  useLoad(async () => {
    if (!site) { setSt({ dot: '', title: 'We have not started your site yet', hint: 'It appears here the moment we do.' }); return; }
    try {
      const r = await api({ action: 'site_status', site_id: site.site_id });
      if (!r.live) setSt({ dot: 'building', title: 'Your website is being built', hint: 'It goes live the moment it is ready, and you will get a notification.' });
      else if (r.online) setSt({ dot: 'on', title: 'Your website is live', hint: host });
      else if (r.online === false) setSt({ dot: 'off', title: 'Your website is not responding', hint: 'Pull down to check again. If it stays like this, tell Kane under Support.' });
      else setSt({ dot: '', title: 'No address yet', hint: 'Your website address appears here once it is set.' });
    } catch (e) { setSt({ dot: '', title: 'Could not check just now', hint: e.message }); }
  }, [site && site.site_id]);
  const dotColor = st.dot === 'on' ? '#34c759' : st.dot === 'off' ? '#ff453a' : st.dot === 'building' ? C.orLight : 'rgba(255,255,255,0.3)';
  return (
    <Card night style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={[s.siteDot, { backgroundColor: dotColor }]} />
        <View style={{ flex: 1 }}>
          <Text style={s.siteTitle}>{st.title}</Text>
          {st.hint ? <Text style={s.siteHint}>{st.hint}</Text> : null}
        </View>
      </View>
      {url ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Chip title="Open your website" onPress={() => openOutside(url)} />
          <Chip title="Share it" icon="share" onPress={() => share((site.name ? site.name + ': ' : '') + 'have a look at our website', site.url)} />
        </View>
      ) : null}
    </Card>
  );
}

export default function AnalyticsScreen() {
  const { site, isStarter } = useApp();
  const [days, setDays] = useState('today');
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState({});
  const [shown, setShown] = useState(30);
  const cache = useRef({});

  const latest = useRef('');
  const load = useCallback(async (fresh, which) => {
    const period = which || days;
    if (!site) return;
    const key = site.site_id + ':' + period;
    latest.current = key;
    let data = !fresh && cache.current[key];
    try {
      if (!data) { data = await api({ action: 'analytics', site_id: site.site_id, days: period }); cache.current[key] = Object.assign({ at: Date.now() }, data); }
      if (latest.current !== key) return; // they moved on to another period or site
      setD(data); setError('');
    } catch (e) { if (latest.current === key && (!fresh || !d)) setError(e.message); }
  }, [site, days, d]);
  const { refreshing, onRefresh } = useLoad((q) => load(q), [site && site.site_id, days]);
  useEvery(15000, () => load(true), days === 'today');

  if (!site) return <Page>{isStarter ? <SiteCard site={null} /> : null}<Empty title="Analytics start the moment your site is live." /></Page>;

  const pick = (v) => { setDays(v); setShown(30); const c = cache.current[site.site_id + ':' + v]; if (c && Date.now() - c.at < 60000) setD(c); else setD(null); };
  const j = (d && d.journeys) || { pages_per_visit: 0, top: [], one_page_pct: 0 };
  const vs = (d && d.visits) || { list: [], live: [], total: 0, sources: [], clicks: [], from_ads: { yes: 0, likely: 0 }, sent_form: 0 };
  const toggle = (id) => { animateNext(); setOpen((o) => Object.assign({}, o, { [id]: !o[id] })); };

  let fourth = { label: 'Pages a visit', n: '–', delta: null };
  if (d) {
    if (d.money) fourth = { label: 'Taken', n: pounds(d.money.amount, d.money.currency), now: d.money.amount, before: d.money.previous.amount };
    else if (d.chat) fourth = { label: 'Conversations', n: fmt(d.chat.conversations), now: d.chat.conversations, before: d.chat.previous.conversations };
    else fourth = { label: 'Pages a visit', n: String(j.pages_per_visit || 0), text: d.visitors ? j.one_page_pct + '% saw one page' : '' };
  }

  return (
    <Page refreshing={refreshing} onRefresh={onRefresh}>
      {isStarter ? <SiteCard site={site} /> : null}
      <Segmented options={PERIODS} value={days} onChange={pick} />
      <Text style={s.compare}>{days === 'today' ? 'Today since midnight, against yesterday up to this time.' : 'Last ' + days + ' days, against the ' + days + ' before.'}</Text>

      <View style={s.tiles}>
        <Tile label="Visitors" n={d ? fmt(d.visitors) : '–'}>{d ? <Delta night now={d.visitors} before={d.previous.visitors} /> : null}</Tile>
        <Tile label="On the site now" n={d ? fmt(d.online_now) : '–'}>{d ? <Delta night text={d.online_now ? 'in the last 5 minutes' : 'nobody right now'} /> : null}</Tile>
        <Tile label="Page views" n={d ? fmt(d.views) : '–'}>{d ? <Delta night now={d.views} before={d.previous.views} /> : null}</Tile>
        <Tile label={fourth.label} n={fourth.n}>{d ? (fourth.text !== undefined ? <Delta night text={fourth.text} /> : <Delta night now={fourth.now} before={fourth.before} />) : null}</Tile>
      </View>

      {!d ? (error ? <Empty title="Could not load your numbers" text={error} /> : <View><Skeleton height={140} radius={R.cardLg} style={{ marginTop: 14 }} /><Skeleton height={220} radius={R.cardLg} style={{ marginTop: 14 }} /></View>) : (
        <FadeIn>
          <Card style={s.card}>
            <View style={s.liveHead}><View style={s.liveDot} /><Label orange>On the site now</Label></View>
            {vs.live.length ? vs.live.map((v, i) => <Visit key={v.session} v={v} open={open[v.session]} onToggle={() => toggle(v.session)} last={i === vs.live.length - 1} />) : <Text style={s.empty}>Nobody on the site right now.</Text>}
          </Card>

          {(vs.ads && ((vs.ads.rows || []).some((r) => r.ad) || (vs.ads.steps || []).length)) ? (
            <Card style={s.card}>
              <Label orange>How each ad is doing</Label>
              <Text style={s.hint}>Each ad, and everyone who came another way: how many visited, how many left straight away, and how far the rest got. Tap one to see every step.</Text>
              {vs.ads.rows.map((r, i) => {
                const k = 'ad:' + r.name + i;
                const arm = /-(a|b)$/.exec(r.name);
                let paidAt = -1; let furthest = null;
                vs.ads.steps.forEach((st, n) => { if (/^paid$/i.test(st.label)) paidAt = n; if (r.steps[n]) furthest = st.label + ' (' + r.steps[n] + ')'; });
                const paid = Math.max(r.paid || 0, paidAt >= 0 ? r.steps[paidAt] : 0);
                const line = pct(r.left, r.visitors) + ' left straight away · ' + (r.stayed != null ? 'stayed ' + secsText(r.stayed) + ', scrolled ' + r.scrolled + '% (typical) · ' : '')
                  + (paidAt >= 0 || paid ? (paid ? paid + ' paid' : 'nobody paid yet') : (furthest ? 'furthest: ' + furthest : 'nobody went further yet'));
                return (
                  <View key={k} style={[s.visit, i < vs.ads.rows.length - 1 && s.line]}>
                    <Press onPress={() => toggle(k)} feel="select" scale={0.99}>
                      <View style={s.vTop}><Text style={s.vWho} numberOfLines={1}>{r.ad && r.landing ? pageName(r.landing) : r.name}</Text><Text style={s.vWhen}>{r.visitors === 1 ? '1 visitor' : fmt(r.visitors) + ' visitors'}</Text></View>
                      {r.ad ? <Text style={s.adTag}>{'Ad: ' + r.name + (arm ? ' · Test ' + arm[1].toUpperCase() + (arm[1] === 'a' ? ': example page' : ': straight to join form') : '')}</Text> : null}
                      <Text style={s.vLine}>{line}</Text>
                    </Press>
                    {open[k] ? <FadeIn style={{ marginTop: 10 }}><FunnelRows total={r.visitors} rows={[['Visited', r.visitors], ['Left without doing anything', r.left, 'left']].concat(vs.ads.steps.map((st, n) => [st.label, r.steps[n]]))} /></FadeIn> : null}
                  </View>
                );
              })}
            </Card>
          ) : null}

          <Card style={s.card}>
            <Label orange>{(days === 'today' ? 'Today’s visitors' : 'Visitors, newest first') + (vs.total ? ' (' + vs.total + ')' : '')}</Label>
            <Text style={s.hint}>{'Tap a visitor to see their visit.' + (d.bots_hidden ? ' ' + d.bots_hidden + (d.bots_hidden === 1 ? ' visit' : ' visits') + ' from data centres (bots, not people) left out.' : '')}</Text>
            {vs.list.length ? vs.list.slice(0, shown).map((v, i, arr) => <Visit key={v.session} v={v} open={open[v.session]} onToggle={() => toggle(v.session)} last={i === arr.length - 1} />)
              : <Text style={s.empty}>{days === 'today' ? 'No visitors yet today.' : 'No visitors in this period.'}</Text>}
            {vs.list.length > shown ? <Press onPress={() => { animateNext(); setShown(shown + 30); }} style={s.more}><Text style={s.moreText}>{'Show ' + Math.min(30, vs.list.length - shown) + ' more'}</Text></Press> : null}
            {vs.total > vs.list.length && vs.list.length <= shown ? <Text style={s.empty}>{'Showing the latest ' + vs.list.length + ' of ' + vs.total + '.'}</Text> : null}
          </Card>

          <Card style={s.card}>
            <Label orange>{d.days === 'today' ? 'Visitors an hour' : 'Visitors a day'}</Label>
            <View style={{ marginTop: 10 }}><Spark series={d.series || []} /></View>
            {!d.beacon_seen ? <Text style={s.empty}>No visits recorded yet. The first visitors show here within minutes of your site going live.</Text> : null}
          </Card>

          {d.funnel ? (
            <Card style={s.card}>
              <Label orange>From a visit to a payment</Label>
              <View style={{ marginTop: 10 }}><FunnelRows total={d.funnel.visitors} rows={[['Visited', d.funnel.visitors]].concat(d.chat ? [['Messaged', d.funnel.messaged]] : []).concat(d.money ? [['Paid', d.funnel.paid]] : [])} /></View>
              <Text style={s.hint}>{[d.money ? (d.funnel.visitors ? pct(d.funnel.paid, d.funnel.visitors) + ' of visitors paid.' : 'No visitors yet.') : '',
                d.chat && d.money ? (d.funnel.messaged ? d.funnel.messaged_and_paid + ' of the ' + d.funnel.messaged + ' who messaged went on to pay.' : 'Nobody has messaged yet.') : d.chat ? (d.funnel.visitors ? pct(d.funnel.messaged, d.funnel.visitors) + ' of visitors sent a message.' : '') : ''].filter(Boolean).join(' ')}</Text>
            </Card>
          ) : null}

          {d.money ? (
            <Card style={s.card}>
              <Label orange>Money in</Label>
              <View style={s.minis}>
                <View style={s.mini}><Text style={s.miniLabel}>Taken</Text><Text style={s.miniN}>{pounds(d.money.amount, d.money.currency)}</Text><Delta now={d.money.amount} before={d.money.previous.amount} /></View>
                <View style={s.mini}><Text style={s.miniLabel}>Payments</Text><Text style={s.miniN}>{fmt(d.money.count)}</Text><Delta now={d.money.count} before={d.money.previous.count} /></View>
                <View style={s.mini}><Text style={s.miniLabel}>Paying customers</Text><Text style={s.miniN}>{fmt(d.money.payers)}</Text></View>
                <View style={s.mini}><Text style={s.miniLabel}>Average payment</Text><Text style={s.miniN}>{d.money.count ? pounds(d.money.average, d.money.currency) : '–'}</Text>{d.money.refunds ? <Text style={[s.delta, { marginLeft: 0 }]}>{d.money.refunds + ' refunded, ' + pounds(d.money.refunded, d.money.currency)}</Text> : null}</View>
              </View>
              {!d.money.count ? <Text style={s.hint}>No payments in this period yet.</Text> : null}
            </Card>
          ) : !isStarter ? (
            <Card style={s.card}><Label orange>Money in</Label><Text style={s.hint}>Payments aren’t connected on this site yet. Once they are, every payment shows here: how much was taken, how many people paid, and how many of your visitors became customers.</Text></Card>
          ) : null}

          {d.chat ? (
            <Card style={s.card}>
              <Label orange>Live chat</Label>
              <View style={s.minis}>
                <View style={s.mini}><Text style={s.miniLabel}>Conversations</Text><Text style={s.miniN}>{fmt(d.chat.conversations)}</Text><Delta now={d.chat.conversations} before={d.chat.previous.conversations} /></View>
                <View style={s.mini}><Text style={s.miniLabel}>Went on to pay</Text><Text style={s.miniN}>{d.money ? fmt((d.funnel || {}).messaged_and_paid) : '–'}</Text><Text style={[s.delta, { marginLeft: 0 }]}>{d.money ? ((d.funnel || {}).messaged ? pct(d.funnel.messaged_and_paid, d.funnel.messaged) + ' of them' : '') : 'once payments are connected'}</Text></View>
              </View>
            </Card>
          ) : !isStarter ? (
            <Card style={s.card}><Label orange>Live chat</Label><Text style={s.hint}>Live chat isn’t on this site yet. With it, visitors can message you from any page and you answer from the Chat tab; the numbers here show how many do, and how many go on to pay.</Text></Card>
          ) : null}

          <Card style={s.card}><Label orange>Top pages</Label><View style={{ marginTop: 8 }}><BarList rows={d.pages} keyName="path" nName="views" empty="No pages viewed yet." label={pageName} /></View></Card>
          <Card style={s.card}>
            <Label orange>Visitor journeys</Label>
            <View style={{ marginTop: 8 }}>
              {j.top.length ? j.top.map((r, i) => (
                <View key={i} style={s.li}><Text style={s.liKey}>{r.steps.map(pageName).join('  →  ')}</Text><Text style={s.liN}>{fmt(r.visitors)}</Text></View>
              )) : <Text style={s.empty}>{d.visitors ? 'Every visit so far stayed on one page.' : 'Nothing yet.'}</Text>}
            </View>
            {d.visitors ? <Text style={s.hint}>{'About ' + j.pages_per_visit + ' pages a visit. ' + j.one_page_pct + '% of visits saw one page and left.'}</Text> : null}
          </Card>
          <Card style={s.card}>
            <Label orange>Where they came from</Label>
            <View style={{ marginTop: 8 }}><BarList rows={vs.sources.map((x) => ({ key: x.ad === 'likely' ? x.source + ' (likely ad)' : x.source, n: x.visitors }))} keyName="key" nName="n" empty="Nothing yet." /></View>
            {vs.total ? <Text style={s.hint}>{(vs.from_ads.yes + vs.from_ads.likely) ? (vs.from_ads.yes + vs.from_ads.likely) + ' of ' + vs.total + ' visitors came from an ad.' + (vs.from_ads.likely ? ' Facebook and Instagram add the same tag to shared posts as to ads, so those count as likely.' : '') : 'None from an ad in this period.'}</Text> : null}
          </Card>
          <Card style={s.card}>
            <Label orange>What they pressed</Label>
            <View style={{ marginTop: 8 }}><BarList rows={vs.clicks} keyName="label" nName="visitors" empty="No clicks yet. Buttons and links pressed show here." /></View>
            {vs.clicks.length ? <Text style={s.hint}>{'By how many visitors pressed each one.' + (vs.sent_form ? ' ' + vs.sent_form + ' sent a form.' : '')}</Text> : null}
          </Card>
          <Card style={s.card}>
            <Label orange>Phone or desktop</Label>
            {(() => {
              const total = (d.devices.phone || 0) + (d.devices.desktop || 0);
              return (
                <View>
                  <View style={s.devBar}>
                    <View style={{ flex: total ? d.devices.phone : 0, backgroundColor: C.ink }} />
                    <View style={{ flex: total ? d.devices.desktop : 1, backgroundColor: C.line }} />
                  </View>
                  <Text style={s.hint}>{total ? Math.round((d.devices.phone / total) * 100) + '% on a phone, ' + Math.round((d.devices.desktop / total) * 100) + '% on a desktop.' : 'No visitors yet.'}</Text>
                </View>
              );
            })()}
          </Card>
          <Card style={s.card}>
            <Label orange>Where they are</Label>
            <View style={{ marginTop: 8 }}>{(d.cities || []).length ? <BarList rows={d.cities} keyName="city" nName="visitors" empty="Nothing yet." /> : <BarList rows={d.countries || []} keyName="country" nName="visitors" empty="Nothing yet." label={countryName} />}</View>
          </Card>
        </FadeIn>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  compare: { marginTop: 10, fontSize: 14, color: C.ink2 },
  tiles: { marginTop: 14, backgroundColor: C.night, borderRadius: R.cardLg, padding: 8, flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '50%', padding: 6 },
  tileLabel: { fontSize: 13.5, color: C.onNight2, marginTop: 8, marginLeft: 8 },
  tileN: { fontSize: 34, fontWeight: '700', letterSpacing: -1, color: C.onNight, marginLeft: 8, marginTop: 2 },
  delta: { fontSize: 13, marginLeft: 8, marginTop: 2, marginBottom: 8, color: C.ink3 },
  card: { marginTop: 14 },
  hint: { marginTop: 8, fontSize: 14, lineHeight: 19, color: C.ink2 },
  empty: { marginTop: 8, fontSize: 14.5, color: C.ink2 },
  liveHead: { flexDirection: 'row', alignItems: 'center' },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.or2, marginRight: 8 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  visit: { paddingVertical: 12 },
  visitHead: { flexDirection: 'row' },
  vDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.line, marginTop: 6, marginRight: 10 },
  vTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vWho: { flex: 1, fontSize: 16, fontWeight: '600', color: C.ink, marginRight: 8 },
  vWhen: { fontSize: 13, color: C.ink3 },
  vLine: { marginTop: 4, fontSize: 14, lineHeight: 19, color: C.ink2 },
  vChips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
  vChip: { fontSize: 12.5, fontWeight: '600', color: C.ink2, backgroundColor: '#fff', borderWidth: 1, borderColor: C.lineSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  vChipOn: { backgroundColor: C.orSoft, borderColor: '#ffd9c7', color: C.orSoftText },
  steps: { marginTop: 10, marginLeft: 19, borderLeftWidth: 2, borderLeftColor: C.lineSoft, paddingLeft: 12 },
  stepRow: { flexDirection: 'row', marginBottom: 6 },
  stepTime: { width: 44, fontSize: 12.5, color: C.ink3, marginTop: 1, fontVariant: ['tabular-nums'] },
  stepText: { flex: 1, fontSize: 14, lineHeight: 19, color: C.ink },
  more: { marginTop: 10, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#fff' },
  moreText: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  adTag: { marginTop: 3, fontSize: 12.5, color: C.or, fontWeight: '600' },
  li: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  liKey: { flex: 1, fontSize: 15, color: C.ink, marginRight: 10 },
  liBar: { height: 6, borderRadius: 3, backgroundColor: C.or2, marginRight: 10 },
  liN: { minWidth: 30, textAlign: 'right', fontSize: 15, fontWeight: '600', color: C.ink, fontVariant: ['tabular-nums'] },
  fRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  fLabel: { width: 110, fontSize: 13.5, color: C.ink2, marginRight: 8 },
  fTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#fff', overflow: 'hidden' },
  fBar: { height: 10, borderRadius: 5, backgroundColor: C.or2 },
  fN: { width: 44, textAlign: 'right', fontSize: 14, fontWeight: '600', color: C.ink, fontVariant: ['tabular-nums'] },
  minis: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  mini: { width: '50%', paddingVertical: 8 },
  miniLabel: { fontSize: 13.5, color: C.ink2 },
  miniN: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, color: C.ink, marginTop: 2 },
  devBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginTop: 12 },
  siteDot: { width: 12, height: 12, borderRadius: 6, marginTop: 5, marginRight: 12 },
  siteTitle: { fontSize: 18, fontWeight: '600', color: C.onNight },
  siteHint: { marginTop: 3, fontSize: 14.5, color: C.onNight2 }
});
