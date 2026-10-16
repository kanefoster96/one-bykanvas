/* Starter's inbox: what the contact form on their site brought in, read
 * here and answered from the phone's own mail or phone app. "New" is
 * anything since they last opened this tab on this phone. */
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Page, useLoad } from '../components/screen';
import { Chip, Empty, FadeIn, Skeleton } from '../components/ui';
import { useApp } from '../state/app';
import { api } from '../lib/api';
import { openOutside } from '../lib/phone';
import { ago, telHref } from '../lib/format';
import { C, R } from '../theme';

export default function MessagesScreen({ route }) {
  const { site, setCounts } = useApp();
  const [list, setList] = useState(null);
  const [since, setSince] = useState(0);
  const [error, setError] = useState('');
  const openId = route.params && route.params.openId;
  const scroll = useRef(null);
  const ys = useRef({});
  const key = 'oa-msgs-seen:' + (site ? site.site_id : '');

  const { refreshing, onRefresh } = useLoad(async () => {
    if (!site) return;
    try {
      const res = await api({ action: 'enquiries', site_id: site.site_id });
      const week = Date.now() - 7 * 864e5;
      const seen = Number(await AsyncStorage.getItem(key).catch(() => null)) || week;
      setSince(seen);
      setList(res.enquiries || []);
      setError('');
      await AsyncStorage.setItem(key, String(Date.now())).catch(() => {});
      setCounts({ messages: 0 });
      if (openId) setTimeout(() => { const y = ys.current[openId]; if (scroll.current && y != null) scroll.current.scrollTo({ y: Math.max(0, y - 80), animated: true }); }, 350);
    } catch (e) { setError(e.message); }
  }, [site && site.site_id, openId]);

  return (
    <Page refreshing={refreshing} onRefresh={onRefresh} scrollRef={scroll}>
      <Text style={s.hint}>From the contact form on your site. A copy goes to your email too.</Text>
      {!list ? (error ? <Empty title="Could not load your messages" text={error} /> : [0, 1].map((i) => <Skeleton key={i} height={120} radius={R.card} style={{ marginTop: 14 }} />)) : null}
      {list && !list.length ? <Empty title="No messages yet" text="When someone sends the contact form on your website, it shows here and you get a notification." /> : null}
      {(list || []).map((m, i) => {
        const who = m.name || m.email || m.phone || 'Someone';
        const isNew = since && new Date(m.created_at).getTime() > since;
        const meta = [m.email, m.phone].filter((v) => v && v !== who).join(' · ');
        return (
          <FadeIn key={m.id || i} delay={Math.min(i, 6) * 40}>
            <View onLayout={(e) => { ys.current[m.id] = e.nativeEvent.layout.y; }} style={[s.msg, isNew && s.msgNew, openId === m.id && s.msgOpen]}>
              <View style={s.head}>
                {isNew ? <View style={s.dot} /> : null}
                <Text style={s.who} numberOfLines={1}>{who}</Text>
                <Text style={s.when}>{ago(m.created_at)}</Text>
              </View>
              <Text style={s.body} selectable>{m.message}</Text>
              {meta ? <Text style={s.meta}>{meta}</Text> : null}
              <View style={s.acts}>
                {m.email ? <Chip dark icon="mail" title={'Email ' + (m.name ? m.name.split(' ')[0] : 'them')} onPress={() => openOutside('mailto:' + m.email + '?subject=' + encodeURIComponent('Re: your message to ' + ((site && site.name) || 'us')))} /> : null}
                {m.phone ? <Chip icon="phone" title="Call" onPress={() => openOutside(telHref(m.phone))} /> : null}
              </View>
            </View>
          </FadeIn>
        );
      })}
    </Page>
  );
}

const s = StyleSheet.create({
  hint: { fontSize: 14.5, lineHeight: 20, color: C.ink2, marginBottom: 4 },
  msg: { marginTop: 14, backgroundColor: C.grey, borderRadius: R.cardLg, padding: 18, borderWidth: 1.5, borderColor: 'transparent' },
  msgNew: { backgroundColor: '#fff', borderColor: C.lineSoft },
  msgOpen: { borderColor: C.or },
  head: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.or2, marginRight: 8 },
  who: { flex: 1, fontSize: 17, fontWeight: '600', color: C.ink },
  when: { fontSize: 13, color: C.ink3 },
  body: { marginTop: 8, fontSize: 16, lineHeight: 22, color: C.ink },
  meta: { marginTop: 8, fontSize: 14, color: C.ink2 },
  acts: { flexDirection: 'row', gap: 8, marginTop: 14 }
});
