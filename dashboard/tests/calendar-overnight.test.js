import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
process.env.TZ = 'America/Toronto';
function setup(start = '2026-10-15T23:00:00', end = '2026-10-16T01:00:00') {
  const people = ['enes','beyza','atlas','miyam'].map(id => ({ id, name: id, color: '#aaa', rgb: '1 1 1', ink: '#111' }));
  const event = { id: 'overnight', title: 'Night shift', start: new Date(start), end: new Date(end), people: ['enes'], location: 'Work' };
  const data = { people, family: people[0], ALL: people.map(p => p.id), events: [event], busyExtras: [] };
  const context = { window: { DATA: data, ICONS: {} }, document: { addEventListener() {} }, Date, Intl, console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8'), context);
  context.App = context.window.App;
  context.App.now = () => new Date(start.slice(0,10) + 'T12:00:00');
  vm.runInContext(fs.readFileSync(new URL('../js/views/calendar.js', import.meta.url), 'utf8'), context);
  const handlers = {};
  const el = { innerHTML: '', addEventListener: (event, fn) => handlers[event] = fn, querySelector: selector => selector === '.grid-scroll' ? { scrollTop: 0, addEventListener() {} } : null };
  context.App.views.calendar.show(el, {});
  const click = (selector, dataset) => handlers.click({ target: { closest: query => query === selector ? { dataset } : null } });
  return { app: context.App, el, click, event };
}
test('11 PM–1 AM renders readable matching events on both dates with clipped time ranges', () => {
  const { app, el, click, event } = setup();
  assert.match(el.innerHTML, /height:1728px/);
  assert.match(el.innerHTML, /top:1656px;height:69px/);
  assert.match(el.innerHTML, /11:00 PM – 12:00 AM/);
  assert.match(el.innerHTML, /Night shift/);
  click('[data-nav]', { nav: '1' });
  assert.match(el.innerHTML, /top:0px;height:69px/);
  assert.match(el.innerHTML, /12:00 – 1:00 AM/);
  assert.match(el.innerHTML, /data-ev="overnight"/);
  assert.equal(event.start.getHours(), 23);
  assert.equal(event.end.getHours(), 1);
  assert.equal(app.calendarSegment(event, new Date('2026-10-16T12:00:00')).location, 'Work');
  click('[data-nav]', { nav: '-1' });
  click('[data-mode]', { mode: '3day' });
  assert.match(el.innerHTML, /11:00 PM – 12:00 AM/);
  assert.match(el.innerHTML, /12:00 – 1:00 AM/);
});
test('midnight end is exclusive and DST boundaries use local calendar midnights', () => {
  const { app, event } = setup('2026-10-15T23:00:00', '2026-10-16T00:00:00');
  assert.equal(app.timedOn(new Date('2026-10-16T12:00:00')).length, 0);
  for (const date of ['2026-03-08', '2026-11-01']) {
    const day = new Date(date + 'T12:00:00');
    const span = Object.assign({}, event, { start: app.addDays(app.dayStart(day), -1), end: app.addDays(app.dayStart(day), 2) });
    const segment = app.calendarSegment(span, day);
    assert.equal(segment.start.getHours(), 0); assert.equal(segment.end.getHours(), 0);
    assert.equal(segment.end.getDate(), day.getDate() + 1);
  }
});
