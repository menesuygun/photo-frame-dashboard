// Alternating Friday curbside collection, anchored to recycling on October 16, 2026.
(function () {
  'use strict';
  App.collectionDay = function (date) {
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    var fields = {};
    parts.forEach(function (part) { fields[part.type] = part.value; });
    var today = Date.UTC(+fields.year, +fields.month - 1, +fields.day), weekday = new Date(today).getUTCDay();
    var tomorrow = weekday === 4 && +fields.hour >= 17;
    if (weekday !== 5 && !tomorrow) return null;
    var friday = today + (tomorrow ? 86400000 : 0);
    var weeks = Math.round((friday - Date.UTC(2026, 9, 16)) / (7 * 86400000));
    return { title: tomorrow ? 'Garbage Day TMR' : 'Garbage Day', recycling: weeks % 2 === 0 };
  };
  function bin(color, recycling) {
    return '<svg width="37" height="48" viewBox="0 0 40 52" aria-hidden="true"><path d="M8 12h24l-2 33H10z" fill="' + color + '" stroke="#111" stroke-width="2"/><path d="M5 9h30v5H5zM12 5h16v4H12z" fill="' + color + '" stroke="#111" stroke-width="2"/><circle cx="12" cy="47" r="3" fill="#111"/><circle cx="28" cy="47" r="3" fill="#111"/>' + (recycling ? '<path d="m18 22 3-4 4 7-4-1m6 5 2 4h-8l2-3m-6 8h-5l4-7 1 4" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' : '<path d="M20 22c-7 4-7 10 0 13 7-3 7-9 0-13Z" fill="#fff"/><path d="m16 37 8-13" stroke="' + color + '" stroke-width="1.5"/>') + '</svg>';
  }
  function bag() {
    return '<svg width="37" height="48" viewBox="0 0 40 52" aria-hidden="true"><path d="m15 12-3-7 8 3 8-3-3 7 7 10c9 17 2 25-12 25S-1 39 8 22Z" fill="#242424" stroke="#111" stroke-width="2"/><path d="M13 14h14M17 21l-4 17M24 22l3 16" fill="none" stroke="#777" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  App.collectionNotice = function (date) {
    var info = App.collectionDay(date);
    if (!info) return '';
    return '<div class="collection-title label">' + info.title + '</div><div class="collection-bins"><div>' + (info.recycling ? bin('#2678d8', true) : bag()) + '<span>' + (info.recycling ? 'Recycling' : 'Garbage') + '</span></div><div>' + bin('#248b42', false) + '<span>Organics</span></div></div>';
  };
})();
