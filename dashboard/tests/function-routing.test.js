import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import calendar from '../api/calendar.js';
import household from '../api/household.js';
import weather from '../api/weather.js';
import sports from '../api/sports.js';

const rewrites = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url))).rewrites;
const handlers = {'/api/calendar': calendar, '/api/household': household, '/api/weather': weather, '/api/sports': sports};
function requestFor(path, extra = {}, method = 'GET') {
  const destination = rewrites.find(rule => rule.source === path)?.destination || path;
  const url = new URL(destination, 'https://dashboard.local');
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  return {method, url: url.pathname + url.search, query: Object.fromEntries(url.searchParams), headers: {}};
}
function response() {
  return {headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; }};
}

test('legacy private URLs reach protected handlers and remain uncached', async () => {
  for (const path of ['/api/travel', '/api/household-photos']) {
    const req = requestFor(path, {event: 'event-1', versions: '{"photos":1}'});
    assert.equal(req.query.event, 'event-1');
    const res = response();
    await handlers[new URL(req.url, 'https://dashboard.local').pathname](req, res);
    assert.equal(res.code, 401);
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
  }
});

test('legacy public routes preserve their method and program validation', async () => {
  const prayers = requestFor('/api/prayers', {}, 'POST');
  const prayerResponse = response();
  await weather(prayers, prayerResponse);
  assert.equal(prayerResponse.code, 405);
  const schedules = requestFor('/api/eg-schedules', {program: 'invalid'});
  const scheduleResponse = response();
  await sports(schedules, scheduleResponse);
  assert.equal(scheduleResponse.code, 400);
  assert.match(scheduleResponse.body.error, /Aquatic/);
});

test('unknown consolidated resources are rejected and only six function entrypoints remain', async () => {
  for (const [handler, query] of [[calendar, {action: 'unknown'}], [household, {action: 'unknown'}], [weather, {resource: 'unknown'}]]) {
    const res = response();
    await handler({method: 'GET', query, headers: {}}, res);
    assert.equal(res.code, 400);
  }
  assert.equal(fs.readdirSync(new URL('../api', import.meta.url)).filter(name => name.endsWith('.js')).length, 6);
});
