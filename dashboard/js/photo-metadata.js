import { parse } from 'exifr/dist/full.esm.mjs';

export function photoDate(value) {
  if (value instanceof Date && Number.isFinite(+value)) return App.choreDate(value);
  const match = String(value || '').match(/^(\d{4})[:-]?(\d{2})[:-]?(\d{2})/);
  if (!match) return '';
  const date = match.slice(1).join('-');
  const parsed = new Date(date + 'T12:00:00');
  return Number.isFinite(+parsed) && App.choreDate(parsed) === date ? date : '';
}
export function metadataDetails(tags = {}) {
  const date = [tags.DateTimeOriginal, tags.DateTimeDigitized, tags.CreateDate, tags.DateCreated, tags.GPSDateStamp].map(photoDate).find(Boolean) || '';
  const location = [tags.City || tags.Location || tags.SubLocation, tags.State || tags.ProvinceState, tags.Country || tags.CountryName]
    .filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()).filter((v, i, values) => values.indexOf(v) === i).join(', ').slice(0, 160);
  const latitude = tags.latitude, longitude = tags.longitude;
  const gps = Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
  return { date, dateSource: date ? 'metadata' : 'unknown', location, gps };
}
const cache = new Map();
let lastLookup = 0;
App.inspectPhoto = async function (file) {
  let tags;
  try { tags = await parse(file, { reviveValues: false, xmp: true, iptc: true, icc: false, jfif: false, ihdr: false }); } catch (_) {
    try { tags = await parse(file, { reviveValues: false, xmp: false, iptc: false }); } catch (_) {}
  }
  const result = metadataDetails(tags);
  if (!result.date && Number.isFinite(file.lastModified)) {
    const modified = new Date(file.lastModified);
    if (Number.isFinite(+modified)) { result.date = App.choreDate(modified); result.dateSource = 'file'; }
  }
  if (!result.location && result.gps) {
    const key = result.gps.latitude.toFixed(3) + ',' + result.gps.longitude.toFixed(3);
    if (cache.has(key)) result.location = cache.get(key);
    else {
      const delay = Math.max(0, 1100 - (Date.now() - lastLookup));
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      lastLookup = Date.now();
      try {
        const query = new URLSearchParams({ lat: result.gps.latitude, lon: result.gps.longitude });
        const response = await fetch('/api/photo-location?' + query, { signal: AbortSignal.timeout(12000) });
        if (response.ok) result.location = (await response.json()).location || '';
      } catch (_) {}
      cache.set(key, result.location);
    }
    if (!result.location) result.location = result.gps.latitude.toFixed(3) + '°, ' + result.gps.longitude.toFixed(3) + '°';
  }
  return result;
};
