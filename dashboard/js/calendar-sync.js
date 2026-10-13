// iCloud is read-only. Keep the last successful sync in memory during a network outage.
(function () {
  'use strict';
  var App = window.App, D = window.DATA;
  var code = '';
  try { code = localStorage.getItem('frame-calendar-code') || ''; } catch (e) {}
  var busy = false;
  App.calendarSync = { status: 'loading', syncedAt: null };
  D.events = [];
  D.busyExtras = [];

  function date(value) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      var p = value.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]);
    }
    return new Date(value);
  }
  function repaint(status) {
    App.calendarSync.status = status;
    App.emit('data'); App.rerender();
  }
  App.refreshCalendar = function () {
    if (busy) return Promise.resolve();
    busy = true;
    return fetch('/api/calendar', { headers: { Authorization: 'Bearer ' + code }, cache: 'no-store' })
      .then(function (response) {
        if (response.status === 401) { repaint('locked'); return null; }
        if (response.status === 503) { repaint('setup'); return null; }
        if (!response.ok) throw new Error('Calendar unavailable');
        return response.json();
      }).then(function (payload) {
        if (!payload) return;
        D.events = payload.events.map(function (event) {
          return Object.assign({}, event, { start: date(event.start), end: date(event.end) });
        });
        App.calendarSync.syncedAt = new Date(payload.syncedAt);
        App.calendarSync.from = new Date(payload.from);
        App.calendarSync.to = new Date(payload.to);
        try { localStorage.setItem('frame-calendar-code', code); } catch (e) {}
        repaint('ready');
      }).catch(function () { repaint(App.calendarSync.syncedAt ? 'stale' : 'error'); })
      .then(function () { busy = false; });
  };
  App.unlockCalendar = function () {
    App.sheet('<form class="sheet-pad" data-unlock-form><div class="label">Family calendar</div>' +
      '<h2 class="serif sheet-h">Connect this frame</h2><p>Enter your frame access code to show your calendar.</p>' +
      '<input class="big-input" type="password" autocomplete="off" required aria-label="Frame access code" data-access-code>' +
      '<div class="sheet-actions"><button class="btn btn--solid" type="submit">Connect</button></div></form>', {
      onMount: function (sheet, close) {
        sheet.querySelector('[data-unlock-form]').addEventListener('submit', function (event) {
          event.preventDefault(); code = sheet.querySelector('[data-access-code]').value.trim(); close();
          App.refreshCalendar().then(function () {
            if (App.calendarSync.status === 'locked') App.toast('That access code didn’t work. Try again.', { icon: 'lock' });
          });
        });
      }
    });
  };
  App.calendarStatus = function () {
    var state = App.calendarSync, message = {
      loading: 'Connecting calendar…', locked: 'Connect your family calendar', setup: 'Calendar setup is incomplete',
      ready: 'iCloud · Updated ' + (state.syncedAt ? App.fmt.time(state.syncedAt) : ''),
      stale: 'Calendar offline · Showing last update', error: 'Couldn’t load your calendar'
    }[state.status];
    var action = state.status === 'locked' ? 'Connect' : state.status === 'setup' ? '' : 'Refresh';
    return '<div class="calendar-status" role="status"><span>' + App.esc(message) + '</span>' +
      (action ? '<button class="btn btn--ghost" data-calendar-sync>' + action + '</button>' : '') + '</div>';
  };
  App.on('ready', function () {
    App.setTime(null);
    App.refreshCalendar();
    setInterval(App.refreshCalendar, 300000);
    window.addEventListener('online', App.refreshCalendar);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) App.refreshCalendar(); });
    document.addEventListener('click', function (event) {
      if (!event.target.closest('[data-calendar-sync]')) return;
      if (App.calendarSync.status === 'locked') App.unlockCalendar(); else App.refreshCalendar();
    });
  });
})();
