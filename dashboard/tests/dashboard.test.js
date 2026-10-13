import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
const source = f => readFileSync(new URL('../js/' + f, import.meta.url), 'utf8');
function setup() {
  const handlers = {}, views = {}, store = new Map();
  const context = { window: {}, console, Date, Intl, JSON, Object, Number, String, Set, Array, crypto: webcrypto,
    setTimeout() {}, setInterval() {}, AbortSignal,
    localStorage: { getItem: k => store.get(k), setItem: (k, v) => store.set(k, v) },
    App: { now: () => new Date('2026-10-13T12:00:00'), esc: s => String(s).replaceAll('<', '&lt;'),
      register: (n, v) => views[n] = v, on: (n, f) => (handlers[n] ||= []).push(f),
      emit: n => (handlers[n] || []).forEach(f => f()), icon: () => '', avatar: () => '', pstyle: () => '', ring: () => '',
      currentRoutine: () => ({ id: 'after' }), toast() {} } };
  context.window.addEventListener = () => {};
  vm.createContext(context); vm.runInContext(source('data.js'), context);
  context.App.person = id => context.window.DATA.people.find(p => p.id === id) || context.window.DATA.family;
  return { context, views, store };
}
test('chores default to the entire day and filter Morning/Afternoon/Evening explicitly', () => {
  const { context, views } = setup();
  context.App.refreshChores = () => {};
  context.window.DATA.chores = [{ id: 'a', title: 'Morning task', r: 'morning', who: 'enes' }, { id: 'b', title: 'Evening task', r: 'evening', who: 'enes' }];
  vm.runInContext(source('views/tasks.js'), context);
  let click;
  const el = { innerHTML: '', addEventListener: (n, f) => { click = f; } };
  views.tasks.show(el);
  assert.match(el.innerHTML, /Morning task/); assert.match(el.innerHTML, /Evening task/);
  click({ target: { closest: s => s === '[data-r]' ? { dataset: { r: 'morning' } } : null } });
  assert.match(el.innerHTML, /Morning task/); assert.doesNotMatch(el.innerHTML, /Evening task/);
  click({ target: { closest: s => s === '[data-r]' ? { dataset: { r: 'all' } } : null } });
  assert.match(el.innerHTML, /Evening task/);
});
test('shopping adds selected categories, guesses Sujuk, removes at zero, and persists removal', () => {
  const { context, views, store } = setup();
  context.window.DATA.groceries = [];
  let click;
  const nodes = Object.fromEntries(['.s-input', '.s-category', '.s-list', '.s-suggest', '.s-count', '.s-stores'].map(k => [k, { value: '', innerHTML: '', scrollTop: 0, addEventListener() {} }]));
  const el = { innerHTML: '', querySelector: s => nodes[s] || null, addEventListener: (n, f) => { click = f; } };
  vm.runInContext(source('views/shopping.js'), context); views.shopping.show(el);
  const action = (selector, dataset) => click({ target: { closest: s => s === selector ? { dataset } : null } });
  nodes['.s-category'].value = 'Meat & Deli'; action('[data-add]', { add: 'Sujuk' });
  assert.equal(context.window.DATA.groceries[0].cat, 'Meat & Deli');
  nodes['.s-category'].value = 'Pantry'; action('[data-add]', { add: 'Unknown food' });
  assert.equal(context.window.DATA.groceries[1].cat, 'Pantry');
  const id = context.window.DATA.groceries[0].id;
  action('[data-qty]', { qty: '-1', id });
  assert.equal(context.window.DATA.groceries.length, 1);
  assert.equal(JSON.parse(store.get('frame-shopping-v1')).length, 1);
  nodes['.s-category'].value = ''; action('[data-add]', { add: 'Sujuk' });
  assert.equal(context.window.DATA.groceries[1].cat, 'Meat & Deli');
  let undo;
  context.App.toast = (message, options) => { undo = options.undo; };
  context.window.DATA.groceries[0].store = 'costco';
  context.window.DATA.groceries[0].done = true;
  action('[data-store]', { store: 'grocer' });
  action('[data-remove-all]', {});
  assert.equal(context.window.DATA.groceries.length, 0);
  assert.deepEqual(JSON.parse(store.get('frame-shopping-v1')), []);
  undo();
  assert.equal(context.window.DATA.groceries.length, 2);
  assert.equal(JSON.parse(store.get('frame-shopping-v1')).length, 2);
  action('[data-store]', { store: 'other' });
  nodes['.s-category'].value = 'Hardware & DIY';
  action('[data-add]', { add: 'Screws' });
  const hardware = context.window.DATA.groceries.find(g => g.name === 'Screws');
  assert.equal(hardware.store, 'other');
  assert.equal(hardware.cat, 'Hardware & DIY');
  assert.match(nodes['.s-list'].innerHTML, /Screws/);
  vm.runInContext(source('views/shopping.js'), context);
  assert.ok(context.window.DATA.groceries.some(g => g.name === 'Screws' && g.store === 'other'));
});
test('Usuals can be added, edited and removed and remain empty after reload', () => {
  const { context, store } = setup();
  vm.runInContext(source('views/shopping.js'), context);
  const index = context.window.DATA.usuals.length;
  context.App.saveUsual('Paint rollers');
  assert.equal(context.window.DATA.usuals[index], 'Paint rollers');
  context.App.saveUsual('Paint brushes', index);
  assert.equal(JSON.parse(store.get('frame-usuals-v1'))[index], 'Paint brushes');
  assert.throws(() => context.App.saveUsual('paint brushes'), /already/);
  context.App.removeUsual(index);
  assert.ok(!context.window.DATA.usuals.includes('Paint brushes'));
  while (context.window.DATA.usuals.length) context.App.removeUsual(0);
  vm.runInContext(source('views/shopping.js'), context);
  assert.equal(context.window.DATA.usuals.length, 0);
});
test('weather clears demo data and maps real forecast, hourly data, and failure state', async () => {
  const { context } = setup();
  const epoch = Math.floor(Date.now() / 3600000) * 3600;
  const forecast = { fetchedAt: Date.now(), current: { temperature_2m: 12.6, weather_code: 73, is_day: 1 },
    hourly: { time: [epoch, epoch + 3600], temperature_2m: [13, 14], weather_code: [73, 3], is_day: [1, 1], precipitation_probability: [80, 20] },
    daily: { time: [epoch], temperature_2m_max: [17], temperature_2m_min: [8] } };
  let failure = false;
  context.fetch = async () => { if (failure) throw new Error('offline'); return { ok: true, json: async () => forecast }; };
  vm.runInContext(source('weather-sync.js'), context);
  assert.equal(context.window.DATA.weather, null); assert.equal(context.App.weatherNow().unavailable, true);
  context.App.emit('ready'); await new Promise(r => setImmediate(r));
  assert.equal(context.App.weatherNow().temp, 13); assert.equal(context.App.weatherNow().label, 'Snow');
  assert.equal(context.App.hourly(7).length, 2);
  failure = true; context.App.emit('ready'); await new Promise(r => setImmediate(r));
  assert.equal(context.App.weatherNow().stale, true);
});
test('weather endpoint requests the fixed East Gwillimbury coordinates and Toronto timezone', async () => {
  const { default: handler } = await import('../api/weather.js');
  const previous = globalThis.fetch;
  let requested;
  globalThis.fetch = async url => {
    requested = new URL(url);
    return { ok: true, json: async () => ({ current: { temperature_2m: 12 }, hourly: { time: [1] }, daily: { time: [1] } }) };
  };
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } };
  try {
    await handler({ method: 'GET' }, res);
    assert.equal(res.code, 200); assert.equal(res.body.location, 'East Gwillimbury');
    assert.equal(requested.searchParams.get('latitude'), '44.14237');
    assert.equal(requested.searchParams.get('longitude'), '-79.41168');
    assert.equal(requested.searchParams.get('timezone'), 'America/Toronto');
    assert.equal(requested.searchParams.get('timeformat'), 'unixtime');
  } finally { globalThis.fetch = previous; }
});
