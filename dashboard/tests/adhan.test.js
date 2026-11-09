import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/views/adhan.js', import.meta.url), 'utf8');
const date = '2026-10-19';

function setup(storage = new Map([['frame-adhan-settings-v1', '{"Fajr":true}']])) {
  let now = Date.parse(date + 'T10:00Z');
  const events = {}, audioEvents = {}, routes = [];
  let view;
  class Clock extends Date { static now() { return now; } }
  const player = {
    plays: [],
    pause() { this.paused = true; },
    addEventListener(name, handler) { audioEvents[name] = handler; },
    async play() { this.ended = false; this.paused = false; this.plays.push(this.src); }
  };
  const App = {
    esc: String, emit() {}, on: (name, handler) => events[name] = handler,
    register: (_, page) => view = page, go: name => routes.push(name),
    resetIdle() {}, closeSheet() {}, setMode() {},
    prayerData: () => ({date, instants: {
      Fajr: Date.parse(date + 'T10:01Z'), Dhuhr: Date.parse(date + 'T10:02Z'),
      Asr: Date.parse(date + 'T20:00Z'), Maghrib: Date.parse(date + 'T22:00Z'),
      Isha: Date.parse(date + 'T23:00Z')
    }})
  };
  vm.runInNewContext(source, {
    window: {App, ADHAN_ASSETS: {audio: '/adhan.mp3', dua: '/dua.mp3'}, addEventListener() {}},
    document: {addEventListener() {}}, Date: Clock, Intl, setTimeout, clearTimeout, navigator: {},
    Audio: function(url) { player.src = url; return player; },
    localStorage: {getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k)}
  });
  const controls = {};
  view.show({dataset: {}, addEventListener: (name, handler) => controls[name] = handler});
  return {
    App, storage, routes, player,
    async tick(minutes) { now += minutes * 60000; await events.second(); },
    async end() { player.ended = true; await audioEvents.ended(); },
    error() { audioEvents.error(); },
    async click(attribute) {
      controls.click({target: {closest: () => ({hasAttribute: name => name === attribute, dataset: {}})}});
      await new Promise(resolve => setImmediate(resolve));
    },
    select(name) { controls.change({target: {dataset: {prayer: name}, checked: true}}); }
  };
}

test('a selected prayer plays once, followed by the dua, and returns to Today', async () => {
  const s = setup();
  await s.tick(1);
  assert.deepEqual(s.player.plays, ['/adhan.mp3']);
  assert.deepEqual(s.routes, ['adhan']);
  await s.end();
  assert.deepEqual(s.player.plays, ['/adhan.mp3', '/dua.mp3']);
  assert.equal(s.App.adhanPlaying, true);
  await s.end();
  await s.tick(0);
  await s.tick(1);
  assert.deepEqual(s.player.plays, ['/adhan.mp3', '/dua.mp3']);
  assert.deepEqual(s.routes, ['adhan', 'home']);
});

test('secular mode persists, stops previews, and skips prayers that came due while on', async () => {
  const first = setup();
  await first.click('data-adhan-enable');
  first.App.setSecularMode(true);
  assert.equal(first.player.paused, true);
  await first.end();
  assert.deepEqual(first.player.plays, ['/adhan.mp3']);

  const s = setup(first.storage);
  assert.equal(s.App.isSecularMode(), true);
  s.select('Dhuhr');
  await s.click('data-adhan-enable');
  await s.tick(1);
  s.App.setSecularMode(false);
  await s.tick(0);
  assert.deepEqual(s.player.plays, []);
  await s.tick(1);
  assert.deepEqual(s.player.plays, ['/adhan.mp3']);
});

test('an unavailable dua returns to Today without replaying the adhan', async () => {
  const s = setup();
  await s.tick(1);
  await s.end();
  s.error();
  await s.tick(0.5);
  assert.deepEqual(s.player.plays, ['/adhan.mp3', '/dua.mp3']);
  assert.deepEqual(s.routes, ['adhan', 'home']);
});

test('a prayer more than two minutes past its time does not play', async () => {
  const s = setup();
  await s.tick(5);
  assert.deepEqual(s.player.plays, []);
});

test('prayer switches persist as device preferences', () => {
  const s = setup();
  s.select('Isha');
  assert.equal(JSON.parse(s.storage.get('frame-adhan-settings-v1')).Isha, true);
});
