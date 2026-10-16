import { createHash, timingSafeEqual } from 'node:crypto';
import { calendarUrl, parseCalendar } from '../server/calendar.js';

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
  if (!source || !code) return res.status(503).json({ error: 'Calendar setup is incomplete', setup: true });
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
    const url = calendarUrl(source);
    if (!cached || cached.source !== source || Date.now() - cached.at >= FIVE_MINUTES) {
      if (!pending) {
        pending = (async () => {
          const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
          if (!response.ok) throw new Error('Calendar unavailable');
          const text = await response.text();
          if (text.length > 5 * 1024 * 1024) throw new Error('Calendar is too large');
          const now = new Date();
          const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
          const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 13, 1));
          const events = parseCalendar(text, from, to, process.env.CALENDAR_TIMEZONE || 'America/Toronto');
          cached = { source, at: Date.now(), payload: { events, syncedAt: new Date().toISOString(), from: from.toISOString(), to: to.toISOString() } };
        })().finally(() => { pending = null; });
      }
      await pending;
    }
  return cached.payload;
}
