import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const App = {};
vm.runInNewContext(fs.readFileSync(new URL('../js/collection-day.js', import.meta.url), 'utf8'), { App, Date, Intl });
const at = value => App.collectionDay(new Date(value));
test('Thursday evening and the entire Friday show recycling plus organics for October 16', () => {
  assert.equal(at('2026-10-15T16:59:59-04:00'), null);
  const evening = at('2026-10-15T17:00:00-04:00');
  assert.equal(evening.title, 'Garbage Day TMR'); assert.equal(evening.recycling, true);
  for (const time of ['00:00:00', '12:00:00', '23:59:59']) {
    const friday = at('2026-10-16T' + time + '-04:00');
    assert.equal(friday.title, 'Garbage Day'); assert.equal(friday.recycling, true);
  }
  assert.equal(at('2026-10-17T00:00:00-04:00'), null);
  assert.equal(at('2026-10-14T18:00:00-04:00'), null);
});
test('alternates every week across daylight saving and the new year using Toronto dates', () => {
  assert.equal(at('2026-10-22T18:00:00-04:00').recycling, false);
  assert.equal(at('2026-10-23T12:00:00-04:00').recycling, false);
  assert.equal(at('2026-10-30T12:00:00-04:00').recycling, true);
  assert.equal(at('2026-11-06T12:00:00-05:00').recycling, false);
  assert.equal(at('2027-01-01T12:00:00-05:00').recycling, false);
  assert.equal(at('2026-10-16T01:00:00Z').title, 'Garbage Day TMR');
});
test('notice includes a blue recycling bin or black bag and always a green organics bin', () => {
  const recycling = App.collectionNotice(new Date('2026-10-16T12:00:00-04:00'));
  assert.match(recycling, /#2678d8/); assert.match(recycling, /Recycling/); assert.match(recycling, /#248b42/);
  const garbage = App.collectionNotice(new Date('2026-10-23T12:00:00-04:00'));
  assert.match(garbage, /#242424/); assert.match(garbage, /Organics/); assert.doesNotMatch(garbage, /Recycling/);
});
