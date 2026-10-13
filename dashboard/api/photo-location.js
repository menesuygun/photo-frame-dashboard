// User approved forwarding photo GPS to Photon/Komoot; image files remain local.
const cache = new Map();
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const lat = Number(req.query.lat), lon = Number(req.query.lon);
  if (req.query.lat == null || req.query.lon == null || req.query.lat === '' || req.query.lon === '' || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return res.status(400).json({ error: 'Invalid coordinates' });
  const key = lat.toFixed(3) + ',' + lon.toFixed(3);
  if (cache.has(key)) return res.status(200).json({ location: cache.get(key) });
  try {
    const url = new URL('/reverse', process.env.PHOTO_GEOCODER_URL || 'https://photon.komoot.io');
    url.search = new URLSearchParams({ lat: String(lat), lon: String(lon), limit: '1', lang: 'en' });
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Location unavailable');
    const p = (await response.json()).features?.[0]?.properties || {};
    const location = [...new Set([p.city || p.town || p.village || (['city', 'town', 'village', 'hamlet'].includes(p.osm_value) ? p.name : ''), p.state, p.country].filter(v => typeof v === 'string' && v))].join(', ').slice(0, 160);
    if (cache.size >= 500) cache.delete(cache.keys().next().value);
    cache.set(key, location);
    return res.status(200).json({ location });
  } catch (_) { return res.status(502).json({ error: 'Location unavailable' }); }
}
