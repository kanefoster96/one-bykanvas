/* A web page inside the app, already signed in: the customer's own
 * dashboard, or one of ours (the One setup form, the admin's customer
 * pages). The server mints a one-time handoff link (a magic-link token in
 * the fragment) and kanvas-handoff.js on the page turns it into a session.
 *
 * The page can use the phone through window.KanvasApp (kanvas-handoff.js):
 * scan a QR code, add to the calendar, share, vibrate. It reaches us via
 * window.ReactNativeWebView and gets answers back through
 * window.KanvasAppResult. Our loading screen stays up until the page says
 * it is ready, so there is one loading screen, not two.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, Camera } from 'expo-camera';
import * as Calendar from 'expo-calendar/legacy';
import { Button } from './ui';
import Press from './Press';
import { haptic, openOutside } from '../lib/phone';
import { C } from '../theme';

const FEATURES = ['badge', 'haptic', 'share', 'review', 'scan', 'calendar', 'actions', 'links', 'updates'];

function hostOf(url) { const m = /^https?:\/\/([^/:?#]+)/i.exec(String(url || '')); return m ? m[1].toLowerCase() : ''; }

export default function HandoffWeb({ getUrl, loadingText = 'Loading…', reloadKey }) {
  const insets = useSafeAreaInsets();
  const web = useRef(null);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const [shown, setShown] = useState(false);
  const [scan, setScan] = useState(null);
  const scanned = useRef(false);
  const home = useRef('');

  const start = useCallback(async () => {
    setError(''); setShown(false); setUrl(null);
    try { const u = await getUrl(); home.current = hostOf(u); setUrl(u); }
    catch (e) { setError(e.message); }
  }, [getUrl]);
  useEffect(() => { start(); }, [start, reloadKey]);

  const answer = useCallback((m) => {
    if (web.current) web.current.injectJavaScript('window.KanvasAppResult && window.KanvasAppResult(' + JSON.stringify(m) + '); true;');
  }, []);

  const onMessage = useCallback(async (e) => {
    let m = null;
    try { m = JSON.parse(e.nativeEvent.data); } catch (err) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.kanvas === 'ready') { setShown(true); return; }
    if (m.kanvas !== 'native') return;
    if (m.op === 'haptic') { const st = m.style || 'light'; (haptic[st] || haptic.light)(); return; }
    if (m.op === 'share') { Share.share(Platform.OS === 'ios' ? { message: m.message || '', url: m.url || undefined } : { message: [m.message, m.url].filter(Boolean).join(' ') }).catch(() => {}); return; }
    if (m.op === 'scan') {
      let perm = null;
      try { perm = await Camera.requestCameraPermissionsAsync(); } catch (err) { perm = null; }
      if (!perm || !perm.granted) { answer({ id: m.id, error: 'denied' }); return; }
      scanned.current = false; setScan({ id: m.id }); return;
    }
    if (m.op === 'calendar') {
      const s0 = new Date(m.start), e0 = m.end ? new Date(m.end) : new Date(s0.getTime() + 3600000);
      if (isNaN(s0)) { answer({ id: m.id, saved: false, error: 'bad date' }); return; }
      try {
        const r = await Calendar.createEventInCalendarAsync({ title: String(m.title || 'Booking'), startDate: s0, endDate: e0, location: m.location || undefined, notes: m.notes || undefined });
        const saved = !!(r && r.action === 'saved');
        if (saved) haptic.success();
        answer({ id: m.id, saved });
      } catch (err) { answer({ id: m.id, saved: false, error: String(err && err.message || err) }); }
    }
  }, [answer]);

  /* The page's own site and its frames stay inside; anything else opens
     in the in-app browser, so the dashboard never wanders off. */
  const shouldStart = useCallback((req) => {
    const u = String(req.url || '');
    if (/^(tel|mailto|sms|whatsapp|maps):/i.test(u)) { openOutside(u); return false; }
    if (/^(about|blob|data):/i.test(u)) return true;
    if (!/^https?:/i.test(u)) return false;
    if (req.isTopFrame === false) return true;
    const h = hostOf(u);
    if (h === home.current || /(^|\.)kanvas\.one$/.test(h) || /\.supabase\.co$/.test(h)) return true;
    openOutside(u);
    return false;
  }, []);

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errTitle}>Could not open this here</Text>
        <Text style={s.errText}>{error}</Text>
        <Button title="Try again" onPress={start} style={{ marginTop: 18, alignSelf: 'center' }} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {url && Platform.OS !== 'web' ? (
        <WebView
          ref={web}
          source={{ uri: url }}
          style={{ flex: 1, opacity: shown ? 1 : 0 }}
          injectedJavaScriptBeforeContentLoaded={'window.ONE_NATIVE_EMBED=true;window.ONE_NATIVE_PLATFORM=' + JSON.stringify(Platform.OS) + ';window.ONE_NATIVE_FEATURES=' + JSON.stringify(FEATURES) + ';true;'}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={shouldStart}
          onOpenWindow={(e) => { const u = e && e.nativeEvent && e.nativeEvent.targetUrl; if (u) openOutside(String(u)); }}
          setSupportMultipleWindows={false}
          onLoadEnd={() => setTimeout(() => setShown(true), 2500)}
          onError={(e) => setError((e.nativeEvent && e.nativeEvent.description) || 'No connection.')}
          onContentProcessDidTerminate={() => web.current && web.current.reload()}
          onRenderProcessGone={() => web.current && web.current.reload()}
          pullToRefreshEnabled
          allowsBackForwardNavigationGestures
          sharedCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          allowsInlineMediaPlayback
          keyboardDisplayRequiresUserAction={false}
          allowsLinkPreview={false}
          textZoom={100}
          decelerationRate="normal"
        />
      ) : url ? (
        <iframe src={url} title="page" style={{ flex: 1, border: 0, width: '100%', height: '100%' }} onLoad={() => setShown(true)} />
      ) : null}
      {!shown ? (
        <View style={[StyleSheet.absoluteFill, s.center]} pointerEvents="none">
          <ActivityIndicator color={C.ink} />
          <Text style={s.loading}>{loadingText}</Text>
        </View>
      ) : null}
      <Modal visible={!!scan} animationType="slide" onRequestClose={() => { if (scan) answer({ id: scan.id, error: 'cancelled' }); setScan(null); }} statusBarTranslucent>
        <View style={s.scanRoot}>
          {scan ? <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={(r) => { if (scanned.current || !scan) return; scanned.current = true; haptic.success(); answer({ id: scan.id, data: String((r && r.data) || '') }); setScan(null); }} /> : null}
          <View style={[s.scanTop, { paddingTop: insets.top + 14 }]} pointerEvents="none">
            <Text style={s.scanTitle}>Scan a QR code</Text>
            <Text style={s.scanHint}>Hold the code inside the square.</Text>
          </View>
          <View style={s.scanFrame} pointerEvents="none" />
          <View style={[s.scanBottom, { paddingBottom: insets.bottom + 24 }]}>
            <Press onPress={() => { if (scan) answer({ id: scan.id, error: 'cancelled' }); setScan(null); }} style={s.scanClose}>
              <Text style={s.scanCloseText}>Cancel</Text>
            </Press>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#fff' },
  loading: { marginTop: 12, fontSize: 15, color: C.ink2 },
  errTitle: { fontSize: 19, fontWeight: '600', color: C.ink, textAlign: 'center' },
  errText: { marginTop: 6, fontSize: 15, color: C.ink2, textAlign: 'center' },
  scanRoot: { flex: 1, backgroundColor: C.night },
  scanTop: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center', paddingHorizontal: 24 },
  scanTitle: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  scanHint: { color: C.onNight2, fontSize: 15, marginTop: 6 },
  scanFrame: { position: 'absolute', alignSelf: 'center', top: '30%', width: 250, height: 250, borderRadius: 28, borderWidth: 4, borderColor: '#ff4f12' },
  scanBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  scanClose: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 34, borderRadius: 999 },
  scanCloseText: { color: C.night, fontSize: 16, fontWeight: '700' }
});
