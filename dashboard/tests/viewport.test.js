import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
test('dashboard fits smaller iPad landscape, portrait and Safari browser viewports without horizontal clipping', () => {
  const stage = { style: {} };
  const context = { window: { DATA: {} }, document: { addEventListener() {}, querySelector: () => stage }, Date, Intl };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8'), context);
  for (const [width, height] of [[1194, 834], [1133, 744], [1024, 768], [834, 1194], [1194, 710]]) {
    context.window.innerWidth = width; context.window.innerHeight = height;
    context.window.App.fitScreen();
    const scale = +stage.style.transform.match(/scale\((.*)\)/)[1];
    assert.ok(1280 * scale <= width + 0.01);
    assert.ok(Math.abs(parseFloat(stage.style.height) * scale - height) < 0.01);
    assert.equal(parseFloat(stage.style.left), width / 2);
    assert.equal(parseFloat(stage.style.top), height / 2);
  }
  context.window.visualViewport = { width: 1024, height: 650, offsetTop: 10, offsetLeft: 5 };
  context.window.App.fitScreen();
  assert.equal(parseFloat(stage.style.top), 335);
  assert.equal(parseFloat(stage.style.left), 517);
});
