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
  return { date, dateSource: date ? 'metadata' : 'unknown' };
}
App.inspectPhoto = async function (file) {
  let tags;
  try { tags = await parse(file, { pick: ['DateTimeOriginal', 'DateTimeDigitized', 'CreateDate', 'DateCreated', 'GPSDateStamp'], gps: false, reviveValues: false, xmp: true, iptc: true, icc: false, jfif: false, ihdr: false }); } catch (_) {
    try { tags = await parse(file, { pick: ['DateTimeOriginal', 'DateTimeDigitized', 'CreateDate', 'DateCreated', 'GPSDateStamp'], gps: false, reviveValues: false, xmp: false, iptc: false }); } catch (_) {}
  }
  const result = metadataDetails(tags);
  if (!result.date && Number.isFinite(file.lastModified)) {
    const modified = new Date(file.lastModified);
    if (Number.isFinite(+modified)) { result.date = App.choreDate(modified); result.dateSource = 'file'; }
  }
  return result;
};
