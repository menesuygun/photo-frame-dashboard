// East Gwillimbury municipal coordinates: Natural Resources Canada, FEEUB.
const url = new URL('https://api.open-meteo.com/v1/forecast');
url.search = new URLSearchParams({ latitude: '44.14237', longitude: '-79.41168',
  current: 'temperature_2m,weather_code,is_day', hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
  daily: 'temperature_2m_max,temperature_2m_min', timezone: 'America/Toronto', timeformat: 'unixtime', forecast_days: '2' });
let cached;
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    if (!cached || Date.now() - cached.at > 600000) {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Weather unavailable');
      const data = await response.json();
      if (!Number.isFinite(data.current?.temperature_2m) || !data.hourly?.time?.length || !data.daily?.time?.length) throw new Error('Invalid forecast');
      cached = { at: Date.now(), data };
    }
    res.setHeader('Cache-Control', 'public, s-maxage=600');
    return res.status(200).json({ location: 'East Gwillimbury', fetchedAt: cached.at, ...cached.data });
  } catch (_) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'East Gwillimbury weather is temporarily unavailable' });
  }
}
