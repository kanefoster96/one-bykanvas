/* Whose app this is: the business's name and logo for the header. A
   customer sees their own (from their profile, which they can change in
   the app); Kane sees the site he is looking at. */
import { SUPABASE_URL } from '../config';

export function logoUrl(path, version) {
  if (!path) return null;
  return SUPABASE_URL + '/storage/v1/object/public/avatars/' + String(path).split('/').map(encodeURIComponent).join('/') + (version ? '?v=' + version : '');
}

export function brandFor(app) {
  const own = app.user && !app.user.is_admin;
  const site = app.site;
  const name = (own && app.user.business_name) || (site && site.name) || '';
  const path = (own && app.user.logo_path) || (site && site.logo_path) || null;
  return { name, logo: logoUrl(path, app.logoVersion), path };
}
