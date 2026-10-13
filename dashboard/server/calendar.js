import ICAL from 'ical.js';
import { createHash } from 'node:crypto';

export const PEOPLE = ['enes', 'beyza', 'atlas', 'miyam'];

export function assignment(summary = '') {
  const people = [];
  const title = String(summary).replace(/\[([^\]]+)\]/g, (tag, name) => {
    const id = name.trim().toLowerCase();
    if (!PEOPLE.includes(id) && id !== 'family') return tag;
    for (const person of id === 'family' ? PEOPLE : [id]) {
      if (!people.includes(person)) people.push(person);
    }
    return '';
  }).replace(/\s+/g, ' ').trim();
  return { title: title || 'Untitled event', people: people.length ? people : PEOPLE.slice() };
}

// Restrict the configured source to Apple's published calendar service.
export function calendarUrl(value) {
  const url = new URL(String(value).replace(/^webcal:/i, 'https:'));
  if (url.protocol !== 'https:' || !/^p\d+-caldav\.icloud\.com$/.test(url.hostname) ||
      !url.pathname.startsWith('/published/') || url.username || url.password || url.port) {
    throw new Error('Invalid iCloud calendar URL');
  }
  return url.href;
}

function wireDate(time) {
  // Date-only values must stay date-only: UTC midnight shifts to yesterday in Toronto.
  return time.isDate ? time.toString() : time.toJSDate().toISOString();
}

export function parseCalendar(text, from, to, fallbackTimezone = 'America/Toronto') {
  const calendar = new ICAL.Component(ICAL.parse(text));
  if (calendar.name !== 'vcalendar') throw new Error('Invalid calendar');
  const components = calendar.getAllSubcomponents('vevent');
  const events = new Map();
  let steps = 0;
  const defaultZone = calendar.getTimeZoneByID(calendar.getFirstPropertyValue('x-wr-timezone') || fallbackTimezone);

  function add(item, start, end, recurrenceId) {
    if (String(item.component.getFirstPropertyValue('status')).toUpperCase() === 'CANCELLED') return;
    if (!start || !end) return;
    if (!start.isDate && start.zone === ICAL.Timezone.localTimezone) {
      // iCloud normally supplies VTIMEZONE. Never silently interpret floating times as UTC.
      if (!defaultZone) throw new Error('Calendar timezone is missing');
      start = start.clone(); end = end.clone(); start.zone = defaultZone; end.zone = defaultZone;
    }
    const startDate = start.toJSDate(), endDate = end.toJSDate();
    if (endDate <= from || startDate >= to) return;
    const id = createHash('sha256').update(item.uid + ':' + recurrenceId.toString()).digest('hex');
    events.set(id, {
      id, ...assignment(item.summary), start: wireDate(start), end: wireDate(end),
      allDay: start.isDate, loc: item.location || '', notes: item.description || '', source: 'icloud'
    });
    if (events.size > 5000) throw new Error('Calendar has too many events');
  }

  for (const component of components) {
    if (!component.hasProperty('dtstart') || component.hasProperty('recurrence-id')) continue;
    const uid = component.getFirstPropertyValue('uid');
    const exceptions = components.filter(c => c.hasProperty('recurrence-id') && c.getFirstPropertyValue('uid') === uid);
    const event = new ICAL.Event(component, { exceptions });
    if (!event.isRecurring()) {
      add(event, event.startDate, event.endDate, event.startDate);
      continue;
    }
    const iterator = event.iterator();
    let occurrence;
    while ((occurrence = iterator.next())) {
      if (++steps > 100000) throw new Error('Calendar recurrence limit exceeded');
      if (occurrence.toJSDate() >= to) break;
      const details = event.getOccurrenceDetails(occurrence);
      add(details.item, details.startDate, details.endDate, occurrence);
    }
    // Include exceptions moved into this window from outside the original recurrence window.
    for (const exception of exceptions) {
      const item = new ICAL.Event(exception);
      add(item, item.startDate, item.endDate, item.recurrenceId);
    }
  }
  return [...events.values()].sort((a, b) => a.start.localeCompare(b.start));
}
