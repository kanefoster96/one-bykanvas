/* Google reviews, fetched server-side.
 *
 * The Places API key must never reach the browser — anyone could lift it and
 * spend your quota — so the call happens here and only the tidied result goes
 * out. Set GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID in Vercel to switch it on;
 * until then this returns configured:false and the page shows its own reviews.
 */
const CACHE_SECONDS = 60 * 60 * 6;   // Google's review text changes rarely

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { GOOGLE_PLACES_API_KEY, GOOGLE_PLACE_ID } = process.env;

  if (!GOOGLE_PLACES_API_KEY || !GOOGLE_PLACE_ID) {
    // Not an error: the site is expected to run before this is connected.
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json({ configured: false, reviews: [] });
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', GOOGLE_PLACE_ID);
    url.searchParams.set('fields', 'rating,user_ratings_total,reviews');
    url.searchParams.set('reviews_sort', 'newest');
    url.searchParams.set('key', GOOGLE_PLACES_API_KEY);

    const r = await fetch(url.toString());
    const data = await r.json();

    if (data.status !== 'OK') {
      console.error('places api:', data.status, data.error_message || '');
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).json({ configured: true, error: data.status, reviews: [] });
    }

    const place = data.result || {};
    const reviews = (place.reviews || [])
      .filter((v) => v.rating >= 4 && v.text && v.text.trim())
      .map((v) => ({
        author: v.author_name,
        rating: v.rating,
        text: v.text.trim(),
        when: v.relative_time_description || '',
        photo: v.profile_photo_url || null,
        source: 'google'
      }));

    res.setHeader('Cache-Control', `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400`);
    return res.status(200).json({
      configured: true,
      rating: place.rating || null,
      total: place.user_ratings_total || null,
      reviews
    });
  } catch (err) {
    console.error('reviews failed:', err && err.message);
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json({ configured: true, error: 'fetch_failed', reviews: [] });
  }
};
