/* The login, kept on the phone.
 *
 * supabase-js with the session in AsyncStorage, refreshed while the app is
 * open and paused while it is in the background (Supabase's own advice for
 * React Native). Same clock fix as the web app (supabase-client.js): a new
 * token's expiry is counted on this phone's clock, so a phone set an hour
 * fast does not think every fresh token has already run out.
 */
import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from '../config';

async function authFetch(input, init) {
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  const res = await fetch(input, init);
  if (url.indexOf('/auth/v1/') < 0 || !res.ok) return res;
  try {
    const body = await res.clone().json();
    if (!body || typeof body.access_token !== 'string' || typeof body.expires_in !== 'number' || !('expires_at' in body)) return res;
    delete body.expires_at;
    return new Response(JSON.stringify(body), { status: res.status, statusText: res.statusText, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return res;
  }
}

export const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  global: { fetch: authFetch }
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => {
    if (s === 'active') db.auth.startAutoRefresh();
    else db.auth.stopAutoRefresh();
  });
}

/* Plain words for what Supabase says, as on the website. */
export function friendlyError(error) {
  const msg = (error && error.message) || 'Something went wrong. Please try again.';
  if (/invalid login credentials/i.test(msg)) return 'That email and password do not match an account.';
  if (/email not confirmed/i.test(msg)) return 'Check your inbox and confirm your email address first.';
  if (/rate limit|too many|for security purposes/i.test(msg)) return 'Too many attempts just now. Wait a minute and try again.';
  if (/failed to fetch|network request failed|network/i.test(msg)) return 'Could not reach the server. Check your connection and try again.';
  return msg;
}
