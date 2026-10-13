import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
const data = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const schedule = readFileSync(new URL('../js/chore-schedule.js', import.meta.url), 'utf8');
function load(date, storage = new Map()) {
  let now = new Date(date + 'T12:00:00');
  const handlers = {};
  const context = { Date, JSON, String, Number, Object, Array, Set, crypto: webcrypto, window: { addEventListener() {} },
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    App: { now: () => now, toast() {}, on: (e, fn) => (handlers[e] ||= []).push(fn),
      emit: e => (handlers[e] || []).forEach(fn => fn()) } };
  vm.createContext(context); vm.runInContext(data, context); vm.runInContext(schedule, context);
  return { context, storage, tasks: () => context.window.DATA.chores,
    advance: date => { now = new Date(date + 'T12:00:00'); context.App.emit('minute'); } };
}
test('requested chores occur on anchored dates and correct family members', () => {
  const app = load('2026-10-13');
  assert.deepEqual(Array.from(app.tasks(), c => [c.title, c.who, c.r]), [
    ['Start robot vacuum', 'enes', 'evening'], ['Laundry', 'enes', 'after']]);
  app.advance('2026-10-14'); assert.equal(app.tasks().length, 1);
  app.advance('2026-10-15'); assert.equal(app.tasks().length, 2);
  app.advance('2026-10-18');
  const sheets = app.tasks().find(c => c.title === 'Change sheets');
  assert.equal(sheets.who, 'any'); assert.equal(sheets.r, 'morning');
  // The same ordinal schedule applies across the November DST transition.
  app.advance('2026-11-02'); assert.ok(app.tasks().some(c => c.title === 'Laundry'));
  app.advance('2026-11-03'); assert.ok(!app.tasks().some(c => c.title === 'Laundry'));
});
test('completion and credited person survive reload, undo, and reset next occurrence', () => {
  const app = load('2026-10-18');
  let sheets = app.tasks().find(c => c.title === 'Change sheets');
  sheets.done = true; sheets.doneBy = 'beyza'; app.context.App.emit('data');
  const reloaded = load('2026-10-18', app.storage);
  sheets = reloaded.tasks().find(c => c.title === 'Change sheets');
  assert.equal(sheets.done, true); assert.equal(sheets.doneBy, 'beyza');
  sheets.done = false; delete sheets.doneBy; reloaded.context.App.emit('data');
  assert.equal(load('2026-10-18', app.storage).tasks().find(c => c.title === 'Change sheets').done, false);
  sheets.done = true; reloaded.context.App.emit('data'); reloaded.advance('2026-10-25');
  assert.equal(reloaded.tasks().find(c => c.title === 'Change sheets').done, false);
});

test('create, edit and delete schedules persist, including deletion of every default', () => {
  const app = load('2026-10-13');
  const chore = app.context.App.saveChore({ title: 'Water <plants>', who: 'beyza', r: 'evening', every: 0, start: '2026-10-14' });
  assert.ok(!app.tasks().some(c => c.title === chore.title));
  let reloaded = load('2026-10-14', app.storage);
  assert.ok(reloaded.tasks().some(c => c.title === chore.title));
  assert.equal(reloaded.context.window.DATA.choreTemplates.length, 4);
  reloaded.context.App.saveChore({ id: chore.id, title: 'Water plants', who: 'atlas', r: 'morning', weekday: 2 });
  reloaded = load('2026-10-13', app.storage);
  assert.ok(reloaded.tasks().some(c => c.title === 'Water plants' && c.who === 'atlas'));
  assert.throws(() => reloaded.context.App.saveChore({ title: '   ', who: 'enes', r: 'morning', every: 1, start: '2026-10-13' }));
  assert.throws(() => reloaded.context.App.saveChore({ title: 'Bad date', who: 'enes', r: 'morning', every: 1, start: '2026-02-31' }));
  assert.throws(() => reloaded.context.App.saveChore({ title: 'Bad interval', who: 'any', r: 'morning', every: -1, start: '2026-10-13' }));
  reloaded.context.window.DATA.choreTemplates.slice().forEach(c => reloaded.context.App.deleteChore(c.id));
  assert.equal(load('2026-10-13', app.storage).context.window.DATA.choreTemplates.length, 0);
});
