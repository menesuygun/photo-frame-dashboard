import { createHash, timingSafeEqual } from 'node:crypto';
import { getCalendarPayload } from './calendar.js';
import { configured, supabase } from '../server/household.js';
import { drivingEstimate } from '../server/travel.js';
const hash = value => createHash('sha256').update(value).digest();
const cache = new Map(), pending = new Map();
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');res.setHeader('Vary', 'Authorization');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method-not-allowed' });
  const code = process.env.FRAME_ACCESS_CODE;
  if (!code || !timingSafeEqual(hash(String(req.headers.authorization || '').replace(/^Bearer /, '')), hash(code))) return res.status(401).json({ error: 'unlock-calendar' });
  const key = process.env.GOOGLE_MAPS_API_KEY, origin = process.env.TRAVEL_HOME_ADDRESS, source = process.env.ICLOUD_CALENDAR_URL;
  if (!key || !origin || !source) return res.status(503).json({ error: 'traffic-setup-needed' });
  const id = String(req.query.event || '');
  if (!/^[a-f0-9]{64}$/.test(id)&&!/^dashboard-[a-z0-9-]{1,100}$/i.test(id)) return res.status(400).json({ error: 'invalid-event' });
  try {
    let event;
    if(id.startsWith('dashboard-')){
      if(!configured())return res.status(503).json({error:'event-sync-needed'});
      const docs=await supabase('/rest/v1/household_documents?household=eq.'+encodeURIComponent(process.env.HOUSEHOLD_ID)+'&category=eq.events&select=value');
      event=docs[0]?.value?.find(e=>e.id===id);
    }else{const payload = await getCalendarPayload(source);event=payload.events.find(e => e.id === id);}
    const now = new Date();
    if (!event || event.allDay || +new Date(event.start) <= +now || +new Date(event.start) - now > 24*60*60*1000) return res.status(400).json({ error: 'event-not-upcoming' });
    const destination = String(event.loc || '').trim();
    if (!destination || /https?:|zoom|teams\.microsoft|online|virtual/i.test(destination)) return res.status(422).json({ error: 'destination-needed' });
    const cacheKey = hash(origin + destination + event.start).toString('hex');
    let entry = cache.get(cacheKey);
    if (!entry || Date.now() - entry.at >= 30*60*1000) {
      if (!pending.has(cacheKey)) pending.set(cacheKey, drivingEstimate({origin,destination,start:event.start,key,now}).then(data => ({at:Date.now(),data})).catch(error => ({at:Date.now(),data:{error:['routes-disabled','google-access-denied','address-incomplete','traffic-unavailable'].includes(error.message)?error.message:'route-unavailable'}})).then(value => {if(cache.size>100)cache.delete(cache.keys().next().value);cache.set(cacheKey,value);return value;}).finally(()=>pending.delete(cacheKey)));
      entry = await pending.get(cacheKey);
    }
    return res.status(entry.data.error?502:200).json(entry.data);
  } catch { return res.status(502).json({ error: 'route-unavailable' }); }
}
