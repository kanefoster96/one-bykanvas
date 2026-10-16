/* Where the app talks to. The same server and database the website uses:
   every screen calls kanvas.one's API with the person's own login, so the
   app and kanvas.one/app always agree. The publishable key is safe in an
   app (row level security guards every table); the service key never is. */
export const BASE = 'https://kanvas.one';
export const SUPABASE_URL = 'https://djhygbmuvacbpbnisuwd.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_7AIUqOnI8DRM2qynFFc2tg_97NuYYUW';
export const ATTACH_BUCKET = 'request-attachments';
