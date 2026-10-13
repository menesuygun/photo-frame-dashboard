import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('tapping either screensaver restores normal home colors and resets idle', () => {
  const handlers = {}, nodes = {}, actions = [];
  const App = { $: selector => nodes[selector] ||= { innerHTML: '', addEventListener: (name, fn) => { handlers[selector + ':' + name] = fn; } },
    on: (name, fn) => { if (name === 'ready') handlers.ready = fn; },
    Slideshow: function () {}, resetIdle: () => actions.push('reset'), setMode: mode => actions.push(mode), go: page => actions.push(page) };
  vm.runInNewContext(fs.readFileSync(new URL('../js/views/ambient.js', import.meta.url), 'utf8'), { window: { DATA: {} }, App });
  handlers.ready();
  for (const selector of ['#night', '#ambient']) {
    actions.length = 0; handlers[selector + ':click']();
    assert.deepEqual(actions, ['reset', 'day', 'home']);
  }
});
