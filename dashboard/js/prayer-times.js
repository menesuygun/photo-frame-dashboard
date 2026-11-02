(function () {
  'use strict';
  var data = null, pending = false, state = 'loading', requestedDate = '', lastAttempt = 0;
  var zone = 'America/Toronto';
  function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  function time(value) {
    var parts = value.split(':'), hour = +parts[0];
    return (hour % 12 || 12) + ':' + parts[1] + (hour < 12 ? ' AM' : ' PM');
  }
  App.nextPrayer = function () {
    if (!data || data.date !== today()) return null;
    var names = ['Fajr','Dhuhr','Asr','Maghrib','Isha'];
    var events = names.map(function (name) { return { name: name, at: data.instants[name] }; });
    events.push({ name: 'Fajr', at: data.tomorrow.instants.Fajr });
    var next = events.find(function (event) { return event.at > Date.now(); });
    if (!next) return null;
    var minutes = Math.ceil((next.at - Date.now()) / 60000);
    return { name: next.name, hours: Math.floor(minutes / 60), minutes: minutes % 60 };
  };
  App.prayerTimesHTML = function () {
    if (!data || data.date !== today()) return '<div class="h-prayers h-prayers--empty"><span class="label">Prayer times</span><span>' + (state === 'loading' ? 'Loading…' : 'Temporarily unavailable') + '</span></div>';
    var next = App.nextPrayer();
    var countdown = next ? '<div class="h-prayer-countdown">' + next.hours + ' hr ' + next.minutes + ' ' + (next.minutes === 1 ? 'minute' : 'minutes') + ' to <b>' + next.name + '</b></div>' : '';
    return '<div class="h-prayer-panel">' + countdown + '<div class="h-prayers" aria-label="East Gwillimbury prayer times, Hanafi Asr, ISNA calculation">' + ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map(function (name) {
      return '<div class="h-prayer"><span>' + name + '</span><b>' + time(data.timings[name]) + '</b></div>';
    }).join('') + '</div></div>';
  };
  App.prayerData = function () { return data && data.date === today() ? data : null; };
  var prayerHTML = App.prayerTimesHTML;
  App.prayerTimesHTML = function () {
    var html = prayerHTML();
    var link = '<button class="h-adhan-link" data-go="adhan" aria-label="Open Adhan and prayer audio settings">☾ Adhan' + (App.adhanAudioLabel ? App.esc(App.adhanAudioLabel()) : '') + '</button>';
    return html.includes('h-prayer-panel') ? html.replace('<div class="h-prayer-panel">', '<div class="h-prayer-panel">' + link) : '<div class="h-prayer-panel">' + link + html + '</div>';
  };
  App.refreshPrayers = async function () {
    if (pending) return;
    pending = true; requestedDate = today(); lastAttempt = Date.now();
    try {
      const response = await fetch('/api/prayers', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unavailable');
      const result = await response.json();
      if (result.date !== today() || result.timezone !== zone || !Number.isFinite(result.tomorrow?.instants?.Fajr) || !['Fajr','Dhuhr','Asr','Maghrib','Isha'].every(function (name) { return Number.isFinite(result.instants?.[name]) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(result.timings?.[name]); })) throw new Error('Invalid timings');
      data = result; state = 'ready';
    } catch (_) { state = 'error'; }
    finally { pending = false; App.emit('prayers'); }
  };
  App.on('ready', function () {
    App.refreshPrayers();
    window.addEventListener('online', App.refreshPrayers);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) App.refreshPrayers(); });
  });
  App.on('minute', function () {
    if (requestedDate !== today() || Date.now() - lastAttempt >= (state === 'error' ? 300000 : 3600000)) App.refreshPrayers();
    App.emit('prayers');
  });
})();
