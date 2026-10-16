/* kanvas.one's API, with the person's login.
 *
 *   api(payload)                 /api/app (the app's own actions)
 *   apiTo('/api/admin', payload) any other endpoint (admin, requests)
 *
 * A 401 gets one fresh token and one more try; still 401 and the login is
 * signed out here, which takes the app back to the login screen. Errors
 * come back as Error(message) in the server's own words.
 */
import { BASE, ATTACH_BUCKET, SUPABASE_KEY, SUPABASE_URL } from '../config';
import { db } from './supabase';

async function token() {
  const { data } = await db.auth.getSession();
  const t = data && data.session && data.session.access_token;
  if (!t) throw Object.assign(new Error('Your session has expired. Log in again.'), { loggedOut: true });
  return t;
}

function post(path, payload, t) {
  return fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
    body: JSON.stringify(payload)
  });
}

export async function apiTo(path, payload) {
  let res;
  try { res = await post(path, payload, await token()); }
  catch (e) {
    if (e && e.loggedOut) throw e;
    throw new Error('Could not reach kanvas.one. Check your connection and try again.');
  }
  if (res.status === 401) {
    let fresh = null;
    try { const r = await db.auth.refreshSession(); fresh = r.data && r.data.session && r.data.session.access_token; } catch (e) { fresh = null; }
    if (fresh) res = await post(path, payload, fresh);
    if (res.status === 401) {
      try { await db.auth.signOut({ scope: 'local' }); } catch (e) { /* already gone */ }
      throw Object.assign(new Error('Your session has expired. Log in again.'), { loggedOut: true });
    }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

export function api(payload) { return apiTo('/api/app', payload); }
export function admin(payload) { return apiTo('/api/admin', payload); }
export function requests(payload) { return apiTo('/api/requests', payload); }

function batchId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/* Photos and PDFs into the private attachments bucket, under the
   person's own folder (the storage policy allows nothing else). Sent as
   multipart straight from the file on the phone, so a 12-megapixel photo
   is never read into memory as a string. Returns the stored paths, in
   the order given. `sub` is an extra folder ('chat' for the chat with
   Kane, as the web app does). */
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' };
export async function uploadFiles(userId, files, sub) {
  const t = await token();
  const batch = batchId();
  const paths = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const ext = EXT[f.type] || (String(f.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = userId + '/' + (sub ? sub + '/' : '') + batch + '-' + i + '.' + ext;
    const form = new FormData();
    if (f.file) form.append('', f.file, f.name); // the web preview: a real File
    else form.append('', { uri: f.uri, name: f.name || ('photo-' + i + '.' + ext), type: f.type || 'image/jpeg' });
    const res = await fetch(SUPABASE_URL + '/storage/v1/object/' + ATTACH_BUCKET + '/' + path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, apikey: SUPABASE_KEY, 'x-upsert': 'false' },
      body: form
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error('Could not upload ' + (f.name || 'that file') + ': ' + (body.message || body.error || res.status));
    }
    paths.push(path);
  }
  return paths;
}

/* One file to an exact path, replacing what is there (the logo, always
   <user id>/logo.<ext> in the public avatars bucket). */
export async function uploadOne(bucket, path, f) {
  const t = await token();
  const form = new FormData();
  if (f.file) form.append('', f.file, f.name);
  else form.append('', { uri: f.uri, name: f.name || 'logo.jpg', type: f.type || 'image/jpeg' });
  const res = await fetch(SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + t, apikey: SUPABASE_KEY, 'x-upsert': 'true' },
    body: form
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.message || body.error || String(res.status);
    throw new Error(/size|large/i.test(msg) ? 'That picture is too big. Try a smaller one (under 2 MB).' : 'Could not upload the picture: ' + msg);
  }
  return path;
}

/* Links that open a stored file for an hour. */
export async function signedUrls(paths) {
  if (!paths || !paths.length) return [];
  const q = await db.storage.from(ATTACH_BUCKET).createSignedUrls(paths, 3600);
  if (q.error) throw q.error;
  return (q.data || []).map((s) => (s && s.signedUrl) || null);
}
