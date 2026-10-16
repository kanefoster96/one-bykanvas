/* One conversation from the site's live chat. Who they are and where
 * they are on the site at the top; messages arrive as they are sent; the
 * reply goes by live chat or by email, whichever reaches them (the
 * sensible one is picked first, as on the web app). */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ThreadLayout from '../../components/ThreadLayout';
import { Bubble, Composer, choose, confirm } from '../../components/chat';
import { Avatar, Chip, Empty, Segmented, Skeleton, animateNext } from '../../components/ui';
import Press from '../../components/Press';
import Icon from '../../components/Icon';
import { useEvery } from '../../components/screen';
import { useApp } from '../../state/app';
import { loadChats, markRead } from '../../state/chat';
import { api } from '../../lib/api';
import { bus } from '../../lib/bus';
import { haptic, maybeAskForRating, openOutside } from '../../lib/phone';
import { ago, displayName, pageName, telHref } from '../../lib/format';
import { C } from '../../theme';

function metaLine(c) {
  const chan = c.channel || 'web';
  const bits = [];
  if (chan === 'whatsapp') bits.push('WhatsApp');
  else if (chan === 'sms') bits.push('Text message' + (c.name && c.phone ? ' · ' + c.phone : ''));
  else if (c.online) bits.push(c.now_path ? 'On ' + pageName(c.now_path) + ' now' : 'On your site now');
  else bits.push('Last seen ' + ago(c.last_at));
  if (c.page && !(c.online && c.now_path)) bits.push(pageName(c.page));
  if (c.status === 'closed') bits.push('Closed');
  if (c.blocked) bits.push('Blocked');
  return bits.join(' · ');
}

function viaHint(c, via) {
  if (c.online) return via === 'email' ? 'They’re on your site now, so live chat reaches them straight away. Email works too.' : 'They’re on your site now.';
  if (c.email) return via === 'email' ? 'They’ve left the site. They get your reply by email, with a link back to the chat, and can reply to the email.' : 'They’ve left the site, so a live chat reply is emailed to them as well.';
  return 'They’ve left the site and didn’t leave an email address. They’ll see your reply if they come back.' + (c.phone ? ' They left a number, so a call might be quickest.' : '');
}

export default function ThreadScreen({ route, navigation }) {
  const { id } = route.params;
  const { site } = useApp();
  const [conv, setConv] = useState(null);
  const [msgs, setMsgs] = useState(null);
  const [error, setError] = useState('');
  const [via, setVia] = useState('chat');
  const [note, setNote] = useState(route.params.note || '');
  const picked = useRef(false);

  const load = useCallback(async () => {
    if (!site) return;
    try {
      const r = await api({ action: 'chat_get', site_id: site.site_id, conversation_id: id });
      setConv(r.conversation);
      setMsgs((cur) => { if (cur && cur.length !== r.messages.length) animateNext(); return r.messages; });
      if (!picked.current) { picked.current = true; setVia(r.conversation.online || !r.conversation.email ? 'chat' : 'email'); }
      markRead(id);
      setError('');
    } catch (e) { setError(e.message); }
  }, [site, id]);

  useEffect(() => { load(); }, [load]);
  useEvery(6000, load);
  useEffect(() => bus.on('chat:message', (m) => {
    if (m.conversation_id !== id) return;
    setMsgs((cur) => (cur && !cur.some((x) => x.id === m.id) ? (animateNext(), cur.concat({ id: m.id, author: m.author, body: m.body, at: m.created_at })) : cur));
    if (m.author === 'visitor') { haptic.light(); load(); }
  }), [id, load]);
  useEffect(() => () => { if (site) loadChats(site.site_id); }, [site]);

  const more = useCallback(async () => {
    if (!conv) return;
    const opts = [];
    if (conv.phone) opts.push(['Call ' + conv.phone, () => openOutside(telHref(conv.phone))]);
    if (conv.phone && site && site.phone_number) opts.push(['Call as your business', callBiz]);
    if (conv.email) opts.push(['Email ' + conv.email, () => openOutside('mailto:' + conv.email)]);
    opts.push([conv.status === 'closed' ? 'Reopen conversation' : 'Close conversation', () => setStatus({ status: conv.status === 'closed' ? 'open' : 'closed' })]);
    opts.push([conv.blocked ? 'Unblock this visitor' : 'Block this visitor', async () => {
      if (!conv.blocked && !(await confirm({ title: 'Block this visitor?', body: 'They will not be able to message you again from this chat.', ok: 'Block', danger: true }))) return;
      setStatus({ blocked: !conv.blocked });
    }]);
    const i = await choose(null, opts.map((o) => o[0]), conv.blocked ? undefined : opts.length - 1);
    if (i >= 0) opts[i][1]();
  }, [conv, site]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: conv ? () => (
        <View style={s.head}>
          <Avatar name={conv.name} size={34} online={conv.online && (conv.channel || 'web') === 'web'} />
          <View style={{ marginLeft: 10, flexShrink: 1 }}>
            <Text style={s.headName} numberOfLines={1}>{displayName(conv)}</Text>
            <Text style={s.headMeta} numberOfLines={1}>{metaLine(conv)}</Text>
          </View>
        </View>
      ) : '',
      headerRight: conv ? () => <Press onPress={more} style={s.moreBtn} accessibilityLabel="More" hitSlop={8}><Icon name="more" size={24} color={C.ink} /></Press> : undefined
    });
  }, [navigation, conv, more]);

  const setStatus = async (body) => {
    try { const r = await api(Object.assign({ action: 'chat_set', site_id: site.site_id, conversation_id: id }, body)); setConv(r.conversation); haptic.success(); }
    catch (e) { setNote(e.message); haptic.error(); }
  };
  const callBiz = async () => {
    setNote('Ringing your phone first, then connecting them…');
    try { await api({ action: 'call_back', site_id: site.site_id, conversation_id: id }); setNote('Answer your phone and you’ll be connected. They see your business number.'); }
    catch (e) { setNote(e.message); }
  };

  const send = async (text) => {
    if (!text) return false;
    const r = await api({ action: 'chat_reply', site_id: site.site_id, conversation_id: id, body: text, via });
    animateNext();
    setMsgs((cur) => (cur || []).concat(r.message));
    setConv(r.conversation);
    haptic.success();
    maybeAskForRating();
    const emailed = (r.delivered || []).indexOf('email') >= 0;
    setNote(via === 'email' && emailed ? 'Emailed to them, with a link back to the chat. They can reply to the email too.'
      : emailed ? 'Sent. They’ve left the site, so it went by email as well.'
        : r.online === false && !r.conversation.email ? 'Sent. They’ll see it when they come back.' : '');
    return true;
  };

  if (!msgs) return error ? <Empty title="Could not open this chat" text={error} /> : <View style={{ padding: 20 }}><Skeleton height={44} width="70%" radius={20} /><Skeleton height={44} width="60%" radius={20} style={{ marginTop: 14, alignSelf: 'flex-end' }} /></View>;

  const chan = conv.channel || 'web';
  let reply;
  if (conv.blocked) reply = <Text style={s.noReply}>This visitor is blocked. Unblock them to reply.</Text>;
  else if (chan !== 'web') reply = <Text style={s.noReply}>{(chan === 'whatsapp' ? 'WhatsApp' : 'Text') + ' threads take no typed replies: texts are automated only, to keep costs down. Call them back' + (conv.email ? ', or email them.' : '.')}</Text>;
  else {
    reply = (
      <Composer
        onSend={send}
        note={note}
        top={conv.via_app ? (
          <Text style={s.hint}>{'A Kanvas One customer, writing from their app. Your reply reaches them as a notification in the app' + (conv.online ? '; they are in it now.' : '.')}</Text>
        ) : (
          <View style={{ marginBottom: 10 }}>
            <Segmented value={via} onChange={(v) => { if (v === 'email' && !conv.email) { haptic.warning(); setNote('They did not leave an email address.'); return; } setVia(v); }}
              options={[{ value: 'chat', label: 'Live chat' }, { value: 'email', label: conv.email ? 'Email' : 'Email (none left)' }]} />
            <Text style={s.hint}>{viaHint(conv, via)}</Text>
          </View>
        )}
      />
    );
  }

  return (
    <ThreadLayout follow={msgs.length} composer={reply}
      above={conv.phone || conv.email ? (
        <View style={s.tools}>
          {conv.phone ? <Chip title="Call" icon="phone" onPress={() => openOutside(telHref(conv.phone))} /> : null}
          {conv.phone && site && site.phone_number ? <Chip dark title="Call as business" onPress={callBiz} /> : null}
          {conv.email ? <Chip title="Email" icon="mail" onPress={() => openOutside('mailto:' + conv.email)} /> : null}
        </View>
      ) : null}>
      {msgs.map((m) => (
        <Bubble key={m.id} system={m.author === 'system'} mine={m.author === 'owner'}
          who={m.author === 'owner' ? 'You' + (m.emailed ? ' · also emailed' : '') : displayName(conv)}
          text={m.body} when={(m.author === 'owner' && m.emailed ? 'Also emailed · ' : '') + ago(m.at)} />
      ))}
    </ThreadLayout>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', maxWidth: 250 },
  headName: { fontSize: 16, fontWeight: '600', color: C.ink },
  headMeta: { fontSize: 12.5, color: C.ink2, marginTop: 1 },
  moreBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  tools: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  hint: { marginTop: 8, marginHorizontal: 2, fontSize: 13.5, lineHeight: 18, color: C.ink2 },
  noReply: { padding: 16, fontSize: 14.5, lineHeight: 20, color: C.ink2, textAlign: 'center' }
});
