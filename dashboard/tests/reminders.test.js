import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';
const source = fs.readFileSync(new URL('../js/views/reminders.js', import.meta.url), 'utf8');
function setup(store = new Map()) {
  const data = { chores: [{ id: 'existing-chore', done: false }], choreTemplates: [{ id: 'weekly', weekday: 0 }] };
  let undo;
  const app = { esc: s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'), icon: () => '', emit() {}, register() {}, toast: (message, options) => { undo = options.undo; } };
  const context = { window: { DATA: data, addEventListener() {} }, App: app, crypto: webcrypto, localStorage: { getItem: k => store.get(k), setItem: (k, v) => store.set(k, v) } };
  vm.runInNewContext(source, context);
  return { app, data, store, undo: () => undo() };
}
test('undated reminders add, edit, complete, reopen, delete and undo independently of chores', () => {
  const { app, data, store, undo } = setup();
  const item = app.saveReminder('Call plumber');
  assert.deepEqual(Object.keys(item).sort(), ['done', 'id', 'title']);
  app.saveReminder('Call electrician', item.id);
  app.toggleReminder(item.id);
  assert.equal(data.reminders[0].done, true);
  const reloaded = setup(store);
  assert.equal(reloaded.data.reminders[0].title, 'Call electrician');
  assert.equal(reloaded.data.reminders[0].done, true);
  app.toggleReminder(item.id); assert.equal(data.reminders[0].done, false);
  app.removeReminder(item.id); assert.equal(data.reminders.length, 0);
  assert.equal(setup(store).data.reminders.length, 0);
  undo(); assert.equal(data.reminders.length, 1);
  assert.deepEqual(data.chores, [{ id: 'existing-chore', done: false }]);
  assert.deepEqual(data.choreTemplates, [{ id: 'weekly', weekday: 0 }]);
});
test('Today preview escapes reminder names and displays only unfinished reminders', () => {
  const { app } = setup();
  const done = app.saveReminder('Completed item'); app.toggleReminder(done.id);
  app.saveReminder('<b>Call plumber</b>');
  assert.match(app.reminderPreview(), /&lt;b>/);
  assert.doesNotMatch(app.reminderPreview(), /Completed item/);
  assert.throws(() => app.saveReminder(''), /Enter a reminder/);
});
