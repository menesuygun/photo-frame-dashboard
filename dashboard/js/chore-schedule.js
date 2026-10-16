// Completion belongs to a dated occurrence, saved on this dashboard device.
(function () {
  'use strict';
  var D = window.DATA, key = 'frame-chore-completions-v1', templateKey = 'frame-chore-templates-v1', day = '', saved = {};
  function read() {
    try {
      var value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  }
  saved = read();
  var defaults = D.choreTemplates.map(function (t) { return Object.assign({ start: '2026-10-13' }, t); });
  function validTemplate(t) {
    if (!t || typeof t.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(t.id) ||
        typeof t.title !== 'string' || !t.title.trim() || t.title.length > 120) return false;
    if (t.who !== 'any' && !D.people.some(function (p) { return p.id === t.who; })) return false;
    if (!D.routines.some(function (r) { return r.id === t.r; })) return false;
    if (t.weekday != null) return Number.isInteger(t.weekday) && t.weekday >= 0 && t.weekday <= 6;
    return Number.isInteger(t.every) && t.every >= 0 && t.every <= 365 &&
      /^\d{4}-\d{2}-\d{2}$/.test(t.start || '') &&
      dateKey(new Date(t.start + 'T12:00:00')) === t.start;
  }
  function readTemplates() {
    try {
      var raw = localStorage.getItem(templateKey);
      if (raw == null) return defaults.slice();
      var value = JSON.parse(raw);
      if (Array.isArray(value) && value.every(validTemplate) && new Set(value.map(function (t) { return t.id; })).size === value.length) return value;
    } catch (_) {}
    return defaults.slice();
  }
  D.choreTemplates = readTemplates();
  App.choreDate = dateKey;
  App.saveChore = function (input) {
    var t = Object.assign({}, input);
    if (!t.id) t.id = 'chore-' + crypto.randomUUID();
    t.title = String(t.title || '').trim(); t.emoji = '📋'; t.stars = 0;
    if (!validTemplate(t)) throw new Error('Please enter a name, person, and valid schedule.');
    t.label = t.weekday != null ? 'Every ' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][t.weekday] :
      t.every === 0 ? 'Once · ' + t.start : t.every === 1 ? 'Every day' : 'Every ' + t.every + ' days';
    var list = D.choreTemplates.filter(function (x) { return x.id !== t.id; }).concat([t]);
    localStorage.setItem(templateKey, JSON.stringify(list));
    D.choreTemplates = list; day = ''; App.refreshChores(); App.emit('data');
    return t;
  };
  App.deleteChore = function (id) {
    var list = D.choreTemplates.filter(function (t) { return t.id !== id; });
    localStorage.setItem(templateKey, JSON.stringify(list));
    D.choreTemplates = list; day = ''; App.refreshChores(); App.emit('data');
  };
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
      return t.every === 0 ? delta === 0 : delta >= 0 && delta % t.every === 0;
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
    if (e.key !== key && e.key !== templateKey && e.key !== null) return;
    saved = read(); D.choreTemplates = readTemplates(); day = ''; App.refreshChores(); App.emit('data');
  });
})();
