import test from 'node:test';
import assert from 'node:assert/strict';
import { assignment, calendarUrl, parseCalendar } from '../server/calendar.js';
import handler from '../api/calendar.js';

const zone = `BEGIN:VTIMEZONE
TZID:America/Toronto
BEGIN:DAYLIGHT
DTSTART:20070311T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
END:DAYLIGHT
BEGIN:STANDARD
DTSTART:20071104T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
END:STANDARD
END:VTIMEZONE`;
const feed = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', zone, ...events, 'END:VCALENDAR'].join('\r\n');
const event = (uid, lines) => `BEGIN:VEVENT\nUID:${uid}\n${lines}\nEND:VEVENT`;
const parse = text => parseCalendar(text, new Date('2026-03-01'), new Date('2026-04-01'));

test('name tags are case-insensitive, deduplicated, hidden; unknown tags stay visible', () => {
  assert.deepEqual(assignment('[ ENES ][Beyza][enes] Dinner'), { title: 'Dinner', people: ['enes', 'beyza'], mentionedPeople: ['enes', 'beyza'] });
  assert.deepEqual(assignment('[Atlas] Swimming'), { title: 'Swimming', people: ['atlas'], mentionedPeople: ['atlas'] });
  assert.deepEqual(assignment('[Work] Meeting').people, ['enes', 'beyza', 'atlas', 'miyam']);
  assert.equal(assignment('[Work] Meeting').title, '[Work] Meeting');
  assert.equal(assignment('[Family] Picnic').people.length, 4);
});

test('normalizes webcal and rejects sources outside published iCloud feeds', () => {
  assert.equal(calendarUrl('webcal://p151-caldav.icloud.com/published/2/test'), 'https://p151-caldav.icloud.com/published/2/test');
  for (const url of ['http://p151-caldav.icloud.com/published/2/test', 'https://example.com/published/test', 'https://p151-caldav.icloud.com/private/test']) {
    assert.throws(() => calendarUrl(url));
  }
});

test('date-only events keep calendar dates and an exclusive end date', () => {
  const [e] = parse(feed(event('date', 'DTSTART;VALUE=DATE:20260308\nDTEND;VALUE=DATE:20260310\nSUMMARY:[Miyam] Holiday')));
  assert.equal(e.start, '2026-03-08'); assert.equal(e.end, '2026-03-10'); assert.equal(e.allDay, true);
});

test('recurrences keep local clock time across daylight saving; exclusions and overrides apply', () => {
  const rows = parse(feed(
    event('weekly', 'DTSTART;TZID=America/Toronto:20260301T090000\nDTEND;TZID=America/Toronto:20260301T100000\nRRULE:FREQ=WEEKLY;COUNT=5\nEXDATE;TZID=America/Toronto:20260315T090000\nSUMMARY:[Atlas] Swimming'),
    event('weekly', 'RECURRENCE-ID;TZID=America/Toronto:20260322T090000\nDTSTART;TZID=America/Toronto:20260322T110000\nDTEND;TZID=America/Toronto:20260322T120000\nSUMMARY:[Beyza] Rescheduled'),
    event('weekly', 'RECURRENCE-ID;TZID=America/Toronto:20260329T090000\nDTSTART;TZID=America/Toronto:20260329T090000\nDTEND;TZID=America/Toronto:20260329T100000\nSTATUS:CANCELLED')
  ));
  assert.deepEqual(rows.map(e => e.start), ['2026-03-01T14:00:00.000Z', '2026-03-08T13:00:00.000Z', '2026-03-22T15:00:00.000Z']);
  assert.equal(rows[2].title, 'Rescheduled'); assert.deepEqual(rows[2].people, ['beyza']);
  assert.equal(new Set(rows.map(e => e.id)).size, 3);
});

test('floating times use the calendar default timezone', () => {
  const [e] = parse(feed(event('floating', 'DTSTART:20260308T090000\nDTEND:20260308T100000\nSUMMARY:Meeting')));
  assert.equal(e.start, '2026-03-08T13:00:00.000Z');
});

test('an exception moved into the range from outside it appears once', () => {
  const rows = parse(feed(
    event('moved', 'DTSTART:20260401T090000Z\nDTEND:20260401T100000Z\nRRULE:FREQ=DAILY;COUNT=2\nSUMMARY:Original'),
    event('moved', 'RECURRENCE-ID:20260401T090000Z\nDTSTART:20260331T090000Z\nDTEND:20260331T100000Z\nSUMMARY:Moved')
  ));
  assert.equal(rows.length, 1); assert.equal(rows[0].title, 'Moved');
});

function response() {
  return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

test('API fails closed without configuration or the correct frame code', async () => {
  const old = { url: process.env.ICLOUD_CALENDAR_URL, code: process.env.FRAME_ACCESS_CODE };
  try {
    delete process.env.ICLOUD_CALENDAR_URL; delete process.env.FRAME_ACCESS_CODE;
    let res = response(); await handler({ method: 'GET', headers: {} }, res); assert.equal(res.code, 503);
    process.env.ICLOUD_CALENDAR_URL = 'webcal://p151-caldav.icloud.com/published/2/test'; process.env.FRAME_ACCESS_CODE = 'test-only-access-code';
    res = response(); await handler({ method: 'GET', headers: { authorization: 'Bearer wrong' } }, res);
    assert.equal(res.code, 401); assert.equal(res.headers['Cache-Control'], 'private, no-store');
    res = response(); await handler({ method: 'POST', headers: {} }, res); assert.equal(res.code, 405);
  } finally {
    if (old.url === undefined) delete process.env.ICLOUD_CALENDAR_URL; else process.env.ICLOUD_CALENDAR_URL = old.url;
    if (old.code === undefined) delete process.env.FRAME_ACCESS_CODE; else process.env.FRAME_ACCESS_CODE = old.code;
  }
});
