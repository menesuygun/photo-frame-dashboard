import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'exifr/dist/full.esm.mjs';
globalThis.App = { choreDate: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') };
const { photoDate, metadataDetails } = await import('../js/photo-metadata.js');

test('capture dates retain the original calendar date and absent dates remain unknown', () => {
  assert.equal(photoDate('2021:06:12 00:15:00'), '2021-06-12');
  assert.equal(photoDate('2021-06-12T23:45:00-04:00'), '2021-06-12');
  assert.equal(photoDate('20210231'), '');
  assert.equal(metadataDetails().date, '');
  const result = metadataDetails({ DateTimeOriginal: '2020:07:01 14:00:00', City: 'Toronto', State: 'Ontario', Country: 'Canada', latitude: 43.65, longitude: -79.38 });
  assert.equal(result.location, 'Toronto, Ontario, Canada'); assert.equal(result.date, '2020-07-01');
  assert.equal(metadataDetails({ latitude: 91, longitude: 10 }).gps, null);
});
test('real EXIF parsing reads a DateTimeOriginal tag from JPEG bytes', async () => {
  const tiff = Buffer.alloc(64);
  tiff.write('II'); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8); tiff.writeUInt16LE(0x8769, 10); tiff.writeUInt16LE(4, 12);
  tiff.writeUInt32LE(1, 14); tiff.writeUInt32LE(26, 18);
  tiff.writeUInt16LE(1, 26); tiff.writeUInt16LE(0x9003, 28); tiff.writeUInt16LE(2, 30);
  tiff.writeUInt32LE(20, 32); tiff.writeUInt32LE(44, 36); tiff.write('2021:06:12 00:15:00\0', 44);
  const segment = Buffer.concat([Buffer.from('Exif\0\0'), tiff]);
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 0]); header.writeUInt16BE(segment.length + 2, 4);
  const tags = await parse(Buffer.concat([header, segment, Buffer.from([0xff, 0xd9])]), { reviveValues: false });
  assert.equal(metadataDetails(tags).date, '2021-06-12');
});
test('location API returns town/region without street address and validates coordinates', async () => {
  const { default: handler } = await import('../api/photo-location.js');
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ features: [{ properties: { name: 'Private Street', city: 'East Gwillimbury', state: 'Ontario', country: 'Canada' } }] }) });
  const res = { setHeader() {}, status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } };
  try {
    await handler({ method: 'GET', query: { lat: '44.1', lon: '-79.4' } }, res);
    assert.equal(res.body.location, 'East Gwillimbury, Ontario, Canada');
    await handler({ method: 'GET', query: { lat: '200', lon: '-79.4' } }, res);
    assert.equal(res.code, 400);
  } finally { globalThis.fetch = original; }
});
