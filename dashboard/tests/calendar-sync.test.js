import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

test('client clears demos, preserves last sync on failure, and replaces deleted events', async () => {
  const app = { on() {}, emit() {}, rerender() {}, fmt: { time() { return '9 AM'; } }, esc: String };
  const data = { events: [{ title: 'Demo' }], busyExtras: [{}] };
  let result = { status: 200, ok: true, json: async () => ({ events: [{ id: 'real', title: 'Holiday', start: '2026-03-08', end: '2026-03-09', allDay: true }], syncedAt: '2026-03-08T13:00:00Z', from: '2025-03-01', to: '2027-04-01' }) };
  const context = vm.createContext({ window: { App: app, DATA: data }, localStorage: { getItem() { return 'code'; }, setItem() {} }, fetch: async () => {
    if (result instanceof Error) throw result;
    return result;
  } });
  vm.runInContext(fs.readFileSync(new URL('../js/calendar-sync.js', import.meta.url), 'utf8'), context);
  assert.equal(data.events.length, 0);
  await app.refreshCalendar();
  assert.equal(app.calendarSync.status, 'ready');
  assert.equal(data.events[0].start.getDate(), 8);
  result = new Error('offline'); await app.refreshCalendar();
  assert.equal(app.calendarSync.status, 'stale'); assert.equal(data.events[0].id, 'real');
  result = { status: 200, ok: true, json: async () => ({ events: [], syncedAt: '2026-03-08T14:00:00Z', from: '2025-03-01', to: '2027-04-01' }) };
  await app.refreshCalendar(); assert.equal(data.events.length, 0); assert.equal(app.calendarSync.status, 'ready');
  result = { status: 401, ok: false }; await app.refreshCalendar(); assert.equal(app.calendarSync.status, 'locked');
});
