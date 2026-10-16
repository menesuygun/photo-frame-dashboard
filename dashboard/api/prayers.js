const zone = 'America/Toronto';
const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
let cached;
function dateKey(date) { return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
async function timingsFor(key) {
  const [year, month, day] = key.split('-');
  const url = new URL(`https://api.aladhan.com/v1/timings/${day}-${month}-${year}`);
  url.search = new URLSearchParams({ latitude: '44.14237', longitude: '-79.41168', method: '2', school: '1', timezonestring: zone, iso8601: 'true' });
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Unavailable');
  const payload = await response.json(), data = payload.data;
  if (payload.code !== 200 || data?.date?.gregorian?.date !== `${day}-${month}-${year}` || data.meta?.timezone !== zone) throw new Error('Invalid date');
  const timings = {}, instants = {};
  for (const name of prayers) {
    const raw = String(data.timings?.[name] || '');
    const time = raw.match(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):([0-5]\d):[0-5]\d[+-]\d{2}:\d{2}$/);
    const instant = Date.parse(raw);
    if (!time || !Number.isFinite(instant) || dateKey(new Date(instant)) !== key) throw new Error('Invalid time');
    timings[name] = time[1] + ':' + time[2]; instants[name] = instant;
  }
  return { date: key, timings, instants };
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const key = dateKey(new Date());
  try {
    if (!cached || cached.date !== key || Date.now() - cached.fetchedAt > 3600000) {
      const tomorrow = new Date(key + 'T12:00:00Z'); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const nextKey = tomorrow.toISOString().slice(0, 10);
      const [current, next] = await Promise.all([timingsFor(key), timingsFor(nextKey)]);
      cached = { ...current, tomorrow: next, timezone: zone, location: 'East Gwillimbury', method: 'ISNA', school: 'Hanafi', fetchedAt: Date.now() };
    }
    return res.status(200).json(cached);
  } catch (_) { return res.status(502).json({ error: 'Prayer times temporarily unavailable' }); }
}
