import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('prayer endpoint requests East Gwillimbury, Hanafi, ISNA and Toronto with offset-aware dates', async () => {
  const { default: handler } = await import('../api/prayers.js');
  const original = globalThis.fetch, calls = [];
  globalThis.fetch = async url => {
    calls.push(url);
    assert.equal(url.searchParams.get('school'), '1'); assert.equal(url.searchParams.get('method'), '2');
    assert.equal(url.searchParams.get('latitude'), '44.14237'); assert.equal(url.searchParams.get('timezonestring'), 'America/Toronto');
    const date = url.pathname.split('/').pop(), [d,m,y] = date.split('-');
    return { ok: true, json: async () => ({ code: 200, data: { date: { gregorian: { date } }, meta: { timezone: 'America/Toronto' }, timings: Object.fromEntries(['Fajr','Dhuhr','Asr','Maghrib','Isha'].map((n,i) => [n, `${y}-${m}-${d}T${['06','13','16','18','19'][i]}:00:00-04:00`])) } }) };
  };
  const res = { setHeader() {}, status(code) { this.code=code; return this; }, json(body) { this.body=body; } };
  try {
    await handler({method:'GET'}, res);
    assert.equal(res.code,200); assert.equal(calls.length,2);
    assert.equal(res.body.school,'Hanafi'); assert.equal(res.body.timings.Fajr,'06:00');
    assert.ok(res.body.tomorrow.instants.Fajr > res.body.instants.Isha);
  } finally { globalThis.fetch=original; }
});
test('countdown moves between prayers and to tomorrow Fajr; old dates are hidden', async () => {
  let now = +new Date('2026-10-16T14:30:00-04:00');
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const instants = Object.fromEntries(Object.entries({Fajr:'06:14',Dhuhr:'13:03',Asr:'16:47',Maghrib:'18:32',Isha:'19:51'}).map(([n,t]) => [n,+new Date('2026-10-16T'+t+':00-04:00')]));
  const payload = {date:'2026-10-16',timezone:'America/Toronto',timings:{Fajr:'06:14',Dhuhr:'13:03',Asr:'16:47',Maghrib:'18:32',Isha:'19:51'},instants,tomorrow:{instants:{Fajr:+new Date('2026-10-17T06:15:00-04:00')}}};
  const app={on(){},emit(){}};
  vm.runInNewContext(fs.readFileSync(new URL('../js/prayer-times.js',import.meta.url),'utf8'),{App:app,Date:Clock,Intl,window:{},document:{},fetch:async()=>({ok:true,json:async()=>payload})});
  await app.refreshPrayers();
  assert.match(app.prayerTimesHTML(),/2 hr 17 minutes to <b>Asr/);
  now=+new Date('2026-10-16T16:47:00-04:00'); assert.equal(app.nextPrayer().name,'Maghrib');
  now=+new Date('2026-10-16T22:00:00-04:00'); assert.equal(app.nextPrayer().name,'Fajr'); assert.equal(app.nextPrayer().hours,8);
  now=+new Date('2026-10-17T00:00:00-04:00'); assert.doesNotMatch(app.prayerTimesHTML(),/6:14/);
});
