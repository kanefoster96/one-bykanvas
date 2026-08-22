/* one — Supabase connection.
 *
 * Both values are safe in public source. The publishable (anon) key is designed
 * to run in browsers; every table is protected by row level security, so a user
 * can only read or write their own row. NEVER put the service role key here —
 * it bypasses RLS completely.
 *
 * Fill these in from: Supabase dashboard -> Project Settings -> API
 */
window.ONE_SUPABASE = {
  url: 'https://djhygbmuvacbpbnisuwd.supabase.co',
  publishableKey: 'sb_publishable_7AIUqOnI8DRM2qynFFc2tg_97NuYYUW'
};
