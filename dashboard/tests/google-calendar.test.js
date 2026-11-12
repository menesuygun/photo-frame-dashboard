import test from 'node:test';
import assert from 'node:assert/strict';
import {googleCalendarUrl, parseCalendar} from '../server/calendar.js';
import {getCalendarPayload} from '../server/calendar-handler.js';
const feed = ['BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT','UID:work','DTSTART:20261112T140000Z','DTEND:20261112T150000Z','RRULE:FREQ=DAILY;COUNT=2','SUMMARY:[Family] Meeting','END:VEVENT','BEGIN:VEVENT','UID:holiday','DTSTART;VALUE=DATE:20261115','DTEND;VALUE=DATE:20261116','SUMMARY:[Beyza] Work holiday','END:VEVENT','END:VCALENDAR'].join('\r\n');

test('only private Google ICS endpoints are accepted',()=>{
 assert.equal(googleCalendarUrl('https://calendar.google.com/calendar/ical/work%40example.com/private-123abc/basic.ics'),'https://calendar.google.com/calendar/ical/work%40example.com/private-123abc/basic.ics');
 for(const url of ['https://example.com/calendar/ical/work/private-123/basic.ics','http://calendar.google.com/calendar/ical/work/private-123/basic.ics','https://calendar.google.com/calendar/ical/work/public/basic.ics','https://calendar.google.com/calendar/ical/work/private-123/basic.ics?redirect=1'])assert.throws(()=>googleCalendarUrl(url));
});

test('Google recurrences and all-day events belong only to Enes and cannot collide with Apple IDs',()=>{
 const from=new Date('2026-11-01'),to=new Date('2026-12-01');
 const apple=parseCalendar(feed,from,to),google=parseCalendar(feed,from,to,'America/Toronto',{source:'google'});
 assert.equal(google.length,3);
 for(const e of google){assert.deepEqual(e.people,['enes']);assert.deepEqual(e.mentionedPeople,['enes']);assert.equal(e.source,'google');assert.ok(!apple.some(a=>a.id===e.id));}
 assert.equal(google[2].start,'2026-11-15');assert.equal(apple[0].people.length,4);
});

test('merged feed retains Apple assignment and includes Google without disclosing source URLs',async()=>{
 const oldFetch=global.fetch,oldGoogle=process.env.GOOGLE_CALENDAR_URL;
 process.env.GOOGLE_CALENDAR_URL='https://calendar.google.com/calendar/ical/work/private-123abc/basic.ics';
 let requests=0;global.fetch=async()=>{requests++;return {ok:true,text:async()=>feed};};
 try{
  const payload=await getCalendarPayload('https://p151-caldav.icloud.com/published/2/test-merge');
  assert.equal(requests,2);assert.deepEqual(payload.sources,['icloud','google']);
  assert.equal(payload.events.filter(e=>e.source==='google').length,3);
  assert.ok(payload.events.filter(e=>e.source==='google').every(e=>e.people.join()==='enes'));
  assert.ok(!JSON.stringify(payload).includes('private-123abc'));
  await getCalendarPayload('https://p151-caldav.icloud.com/published/2/test-merge');assert.equal(requests,2);
 }finally{global.fetch=oldFetch;if(oldGoogle===undefined)delete process.env.GOOGLE_CALENDAR_URL;else process.env.GOOGLE_CALENDAR_URL=oldGoogle;}
});
