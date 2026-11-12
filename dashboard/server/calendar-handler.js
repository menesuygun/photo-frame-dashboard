import { createHash, timingSafeEqual } from 'node:crypto';
import { calendarUrl, googleCalendarUrl, parseCalendar } from './calendar.js';

let cached = null;
let pending = null;
const FIVE_MINUTES = 5 * 60 * 1000;

const digest = value => createHash('sha256').update(value).digest();

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Authorization');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const source = process.env.ICLOUD_CALENDAR_URL;
  const code = process.env.FRAME_ACCESS_CODE;
  if ((!source && !process.env.GOOGLE_CALENDAR_URL) || !code) return res.status(503).json({ error: 'Calendar setup is incomplete', setup: true });
  const supplied = String(req.headers.authorization || '').replace(/^Bearer /, '');
  if (!timingSafeEqual(digest(supplied), digest(code))) return res.status(401).json({ error: 'Unlock the calendar' });

  try {
    return res.status(200).json(await getCalendarPayload(source));
  } catch {
    // Do not expose the feed URL, raw events, or upstream error messages in logs/responses.
    return res.status(502).json({ error: 'Calendar refresh failed. Please try again.' });
  }
}

export async function getCalendarPayload(source) {
    const googleSource = process.env.GOOGLE_CALENDAR_URL || '';
    const cacheKey = JSON.stringify([source || '', googleSource]);
    if (!cached || cached.source !== cacheKey || Date.now() - cached.at >= FIVE_MINUTES) {
      if (!pending) {
        pending = (async () => {
          const now = new Date();
          const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
          const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 13, 1));
          const sources = [
            ...(source ? [{ url: calendarUrl(source), source: 'icloud' }] : []),
            ...(googleSource ? [{ url: googleCalendarUrl(googleSource), source: 'google' }] : [])
          ];
          const lists = await Promise.all(sources.map(async feed => {
            const response = await fetch(feed.url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
            if (!response.ok) throw new Error('Calendar unavailable');
            const text = await response.text();
            if (text.length > 5 * 1024 * 1024) throw new Error('Calendar is too large');
            return parseCalendar(text, from, to, process.env.CALENDAR_TIMEZONE || 'America/Toronto', {source: feed.source});
          }));
          const events = lists.flat().sort((a,b) => a.start.localeCompare(b.start));
          cached = { source: cacheKey, at: Date.now(), payload: { events, sources: sources.map(feed => feed.source), syncedAt: new Date().toISOString(), from: from.toISOString(), to: to.toISOString() } };
        })().finally(() => { pending = null; });
      }
      await pending;
    }
  return cached.payload;
}
