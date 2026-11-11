import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import handler from '../api/sports.js';

const fixture = {
  version: 1, capturedAt: '2026-11-10T20:00:00Z', player: '<Test Player>', club: 'Club',
  duprId: 'TEST', duprUrl: 'https://dashboard.dupr.com/dashboard/player/1',
  profileUrl: 'https://www.globalpickleball.network/test', leagueUrl: 'https://www.globalpickleball.network/league',
  league: 'Doubles', leagueRank: 1, leaguePoints: 20,
  standings: [{rank: 1, name: '<Test Player>', points: 20, wins: 2, losses: 0, dupr: 3.13}, {rank: 1, name: 'Other Player', points: 20, wins: 0, losses: 2, dupr: null}],
  ratings: {duprDoubles: 3.125, duprSingles: null, gpnDoubles: 2.5, gpnDoublesAccuracy: 100, gpnSingles: 2, gpnSinglesAccuracy: 10},
  matches: [{date: '2026-11-10', partner: 'Partner', opponents: ['Opponent 1', 'Opponent 2'], scoreFor: 7, scoreAgainst: 11}]
};

test('pickleball requires family authorization and forbids shared caching', async () => {
  const previous = {code: process.env.FRAME_ACCESS_CODE, snapshot: process.env.PICKLEBALL_SNAPSHOT};
  process.env.FRAME_ACCESS_CODE = 'test-access';
  process.env.PICKLEBALL_SNAPSHOT = JSON.stringify(fixture);
  const response = () => ({headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(v) { this.code = v; return this; }, json(v) { this.body = v; return this; }});
  try {
    const denied = response();
    await handler({method: 'GET', url: '/api/sports?kind=pickleball', headers: {}}, denied);
    assert.equal(denied.code, 401);
    assert.equal(denied.body.snapshot, undefined);
    const allowed = response();
    await handler({method: 'GET', url: '/api/sports?kind=pickleball', headers: {authorization: 'Bearer test-access'}}, allowed);
    assert.equal(allowed.code, 200);
    assert.equal(allowed.body.snapshot.ratings.duprDoubles, 3.125);
    assert.equal(allowed.headers['Cache-Control'], 'private, no-store');
    process.env.PICKLEBALL_SNAPSHOT = '{invalid';
    await handler({method: 'GET', url: '/api/sports?kind=pickleball', headers: {authorization: 'Bearer test-access'}}, allowed);
    assert.equal(allowed.code, 503);
  } finally {
    if (previous.code === undefined) delete process.env.FRAME_ACCESS_CODE; else process.env.FRAME_ACCESS_CODE = previous.code;
    if (previous.snapshot === undefined) delete process.env.PICKLEBALL_SNAPSHOT; else process.env.PICKLEBALL_SNAPSHOT = previous.snapshot;
  }
});

test('the panel labels imports, unrated singles and losses, escapes names, and retains data on refresh failure', async () => {
  const App = {esc: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'), emit() {}};
  let fail = false;
  vm.runInNewContext(fs.readFileSync(new URL('../js/views/pickleball.js', import.meta.url), 'utf8'), {
    window: {App}, Intl, Date, URL, AbortSignal,
    localStorage: {getItem: () => 'test-access'},
    fetch: async (url, options) => {
      assert.equal(url, '/api/sports?kind=pickleball');
      assert.equal(options.headers.Authorization, 'Bearer test-access');
      if (fail) throw new Error('Offline');
      return {ok: true, status: 200, json: async () => ({snapshot: fixture})};
    }
  });
  await App.refreshPickleball();
  let html = App.pickleballPanelHTML();
  assert.match(html, /3\.125/);
  assert.match(html, /Singles NR/);
  assert.match(html, /LOSS/);
  assert.match(html, /7–11/);
  assert.match(html, /&lt;Test Player&gt;/);
  assert.match(html, /fresh import/);
  assert.match(html, /League table/);
  assert.match(html, /class="pk-player-row"/);
  assert.match(html, /3\.13/);
  assert.match(html, /<td>0<\/td>/);
  assert.match(html, /Other Player/);
  assert.match(html, /datetime="2026-11-10"/);
  assert.match(html, /Games on Nov 10, 2026/);
  fail = true;
  await App.refreshPickleball();
  html = App.pickleballPanelHTML();
  assert.match(html, /showing your saved snapshot/);
  assert.match(html, /3\.125/);
});
