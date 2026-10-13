// Completion belongs to a dated occurrence, saved on this dashboard device.
(function () {
  'use strict';
  var D = window.DATA, key = 'frame-chore-completions-v1', day = '', saved = {};
  function read() {
    try {
      var value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  }
  saved = read();
  function dateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // Count calendar dates, rather than 24-hour intervals, across daylight saving.
  function ordinal(s) {
    var p = s.split('-').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]) / 86400000;
  }
  App.refreshChores = function () {
    var now = App.now(), today = dateKey(now);
    if (day === today) return false;
    day = today;
    D.chores = D.choreTemplates.filter(function (t) {
      if (t.weekday != null) return now.getDay() === t.weekday;
      var delta = ordinal(today) - ordinal(t.start || today);
      return delta >= 0 && delta % t.every === 0;
    }).map(function (t) {
      var id = t.id + ':' + today, completion = saved[id];
      var c = Object.assign({}, t, { id: id, done: !!completion });
      if (completion && D.people.some(function (p) { return p.id === completion.by; })) c.doneBy = completion.by;
      return c;
    });
    return true;
  };
  function persist() {
    D.chores.forEach(function (c) {
      if (c.done) saved[c.id] = { by: c.doneBy || null };
      else delete saved[c.id];
    });
    // Retain a month of completion history without letting storage grow forever.
    Object.keys(saved).forEach(function (id) {
      var delta = ordinal(day) - ordinal(id.split(':')[1] || '1970-01-01');
      if (!Number.isFinite(delta) || delta > 31) delete saved[id];
    });
    try { localStorage.setItem(key, JSON.stringify(saved)); }
    catch (_) { App.toast('Chore completion could not be saved on this device.'); }
  }
  App.refreshChores();
  App.on('data', persist);
  App.on('minute', function () { if (App.refreshChores()) App.emit('data'); });
  App.on('time', function () { App.refreshChores(); });
  window.addEventListener('storage', function (e) {
    if (e.key !== key) return;
    saved = read(); day = ''; App.refreshChores(); App.emit('data');
  });
})();
