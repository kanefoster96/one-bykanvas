/* What the phone itself does: vibration, links out, the share sheet, the
   rating prompt and the number on the app icon. Every call is safe to
   make anywhere: on a phone (or a simulator) that cannot, nothing happens. */
import { Linking, Platform, Share } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as StoreReview from 'expo-store-review';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const web = Platform.OS === 'web';

/* light: a tab, a pill, opening something. select: a toggle or picker.
   medium: a long press. success / warning / error: how something went. */
export const haptic = {
  light() { if (!web) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  medium() { if (!web) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); },
  select() { if (!web) Haptics.selectionAsync().catch(() => {}); },
  success() { if (!web) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  warning() { if (!web) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
  error() { if (!web) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); }
};

/* tel:, mailto: and sms: go to the phone's own apps; a web link opens in
   the in-app browser sheet, so nothing ever leaves the app with no way back. */
export async function openOutside(url) {
  url = String(url || '');
  if (!url) return;
  if (/^(tel|mailto|sms|whatsapp|maps):/i.test(url)) { try { await Linking.openURL(url); } catch (e) { /* nothing installed to open it */ } return; }
  if (/^https?:/i.test(url)) {
    if (web) { window.open(url, '_blank', 'noopener'); return; }
    try { await WebBrowser.openBrowserAsync(url, { controlsColor: '#c93e09', dismissButtonStyle: 'close' }); }
    catch (e) { try { await Linking.openURL(url); } catch (e2) { /* ignore */ } }
  }
}

export function share(message, url) {
  // iOS shows the url as its own item; Android only reads message.
  return Share.share(Platform.OS === 'ios' ? { message, url: url || undefined } : { message: [message, url].filter(Boolean).join(' ') }).catch(() => {});
}

export function setBadge(n) {
  if (web) return;
  Notifications.setBadgeCountAsync(Math.max(0, Number(n) || 0)).catch(() => {});
}

/* Ask for a rating at a good moment, rarely: after something went well,
   once the app has been used on five different days, at most every four
   months. The phone decides whether the prompt actually shows. */
export async function noteDayOpened() {
  try {
    const d = JSON.parse((await AsyncStorage.getItem('oa-days')) || '[]');
    const t = new Date().toISOString().slice(0, 10);
    if (d.indexOf(t) < 0) { d.push(t); await AsyncStorage.setItem('oa-days', JSON.stringify(d.slice(-30))); }
  } catch (e) { /* no storage */ }
}
export async function maybeAskForRating() {
  if (web) return;
  try {
    const days = JSON.parse((await AsyncStorage.getItem('oa-days')) || '[]').length;
    const last = Number(await AsyncStorage.getItem('oa-rate')) || 0;
    if (days < 5 || Date.now() - last < 120 * 864e5) return;
    await AsyncStorage.setItem('oa-rate', String(Date.now()));
    setTimeout(async () => {
      try { if (await StoreReview.isAvailableAsync() && await StoreReview.hasAction()) await StoreReview.requestReview(); } catch (e) { /* the OS said no */ }
    }, 1200);
  } catch (e) { /* no storage */ }
}
