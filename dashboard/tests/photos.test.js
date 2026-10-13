import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
const source = f => readFileSync(new URL('../js/' + f, import.meta.url), 'utf8');
function library(storage = new Map()) {
  const handlers = {}, events = [];
  const db = { transaction() {
    const tx = { objectStore() { return {
      getAll() { const req = {}; queueMicrotask(() => { req.result = [...storage.values()]; req.onsuccess(); }); return req; },
      put(p) { storage.set(p.id, p); }, delete(id) { storage.delete(id); }
    }; } };
    setImmediate(() => tx.oncomplete()); return tx;
  } };
  const context = { window: { DATA: { photos: [{ seed: 'demo' }] } }, crypto: webcrypto, Date, Blob, Array, Math, Promise,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, setTimeout() {},
    indexedDB: { open() { const req = {}; queueMicrotask(() => { req.result = db; req.onsuccess(); }); return req; } },
    Image: class { naturalWidth = 4000; naturalHeight = 3000; set src(_) { queueMicrotask(() => this.onload()); } },
    document: { createElement() { return { getContext: () => ({ drawImage() {} }), toBlob: cb => cb(new Blob(['image'], { type: 'image/jpeg' })) }; } },
    App: { emit: n => events.push(n), choreDate: d => d.toISOString().slice(0, 10) } };
  vm.createContext(context); vm.runInContext(source('photo-library.js'), context);
  return { context, storage, events };
}
test('personal photo upload persists blobs, replaces demos, and restores after reload', async () => {
  const app = library();
  assert.equal(app.context.window.DATA.photos.length, 0);
  await app.context.App.addPhotoFiles([{ type: 'image/jpeg', size: 100, name: 'Family.jpg', lastModified: Date.now() }]);
  assert.equal(app.storage.size, 1); assert.equal(app.context.window.DATA.photos[0].place, 'Family.jpg');
  assert.equal(app.context.window.DATA.photos[0].url, 'blob:test');
  assert.ok(app.events.includes('photos'));
  const reloaded = library(app.storage);
  await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));
  assert.equal(reloaded.context.window.DATA.photos.length, 1);
  await assert.rejects(() => app.context.App.addPhotoFiles([{ type: 'image/heic', size: 10 }]), /JPG/);
  await assert.rejects(() => app.context.App.addPhotoFiles([{ type: 'image/jpeg', size: 21000000 }]), /20 MB/);
  assert.equal(app.storage.size, 1);
});
test('single-photo libraries safely fall back from pair and collage layouts', () => {
  const context = { window: { DATA: { photos: [{ o: 'l', seed: 'single', date: '2026-10-13', from: 'family' }] } },
    Date, Math, Object, setInterval() {}, clearInterval() {},
    App: { on() {}, now: () => new Date('2026-10-13T12:00:00'), person: () => ({}), fmt: { month: () => 'Oct' } } };
  vm.createContext(context); vm.runInContext(source('slideshow.js'), context);
  for (const layout of ['pair', 'collage']) {
    const show = new context.App.Slideshow({}, { layout });
    const slide = show.pick(); assert.equal(slide.layout, 'cover'); assert.equal(slide.photos.length, 1);
  }
});
