(function () {
  'use strict';
  var data = null, state = 'loading', pending = false;
  var hourFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: 'numeric', hour12: true });
  var dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' });
  function condition(code, isDay) {
    if (code === 0) return { icon: isDay ? 'sun' : 'moon', label: isDay ? 'Sunny' : 'Clear' };
    if (code <= 2) return { icon: 'partly', label: 'Partly cloudy' };
    if (code === 3) return { icon: 'cloud', label: 'Overcast' };
    if (code === 45 || code === 48) return { icon: 'cloud', label: 'Fog' };
    if ([71, 73, 75, 77, 85, 86].indexOf(code) >= 0) return { icon: 'cloud', label: 'Snow' };
    if (code >= 95) return { icon: 'rain', label: 'Thunderstorms' };
    return { icon: 'rain', label: 'Rain' };
  }
  App.weatherNow = function () {
    var expired = !data || Date.now() - data.fetchedAt > 3600000;
    if (expired) return { temp: '–', cond: 'cloud', label: state === 'loading' ? 'Loading' : 'Unavailable', summary: 'East Gwillimbury weather unavailable', advice: '', hi: '–', lo: '–', unavailable: true };
    var c = condition(data.current.weather_code, data.current.is_day);
    var today = dateFormat.format(new Date());
    var i = data.daily.time.findIndex(function (t) { return dateFormat.format(new Date(t * 1000)) === today; });
    return { temp: Math.round(data.current.temperature_2m), cond: c.icon, label: c.label,
      hi: i >= 0 ? Math.round(data.daily.temperature_2m_max[i]) : '–', lo: i >= 0 ? Math.round(data.daily.temperature_2m_min[i]) : '–',
      summary: state === 'stale' ? 'Last forecast · connection unavailable' : c.label,
      advice: '', stale: state === 'stale' };
  };
  App.hourly = function (count) {
    if (App.weatherNow().unavailable) return [];
    var start = Math.floor(Date.now() / 3600000) * 3600;
    return data.hourly.time.map(function (t, i) {
      var c = condition(data.hourly.weather_code[i], data.hourly.is_day[i]);
      return { epoch: t, t: Math.round(data.hourly.temperature_2m[i]), c: c.icon, p: data.hourly.precipitation_probability[i], label: hourFormat.format(new Date(t * 1000)) };
    }).filter(function (h) { return h.epoch >= start; }).slice(0, count);
  };
  async function refresh() {
    if (pending) return;
    pending = true;
    try {
      var response = await fetch('/api/weather', { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Weather unavailable');
      var value = await response.json();
      if (!Number.isFinite(value.fetchedAt) || !Number.isFinite(value.current?.temperature_2m) || !value.hourly?.time?.length || !value.daily?.time?.length) throw new Error('Invalid forecast');
      data = value; state = 'ready';
    } catch (_) { state = data ? 'stale' : 'error'; }
    finally { pending = false; App.emit('data'); App.emit('weather'); }
  }
  window.DATA.weather = null;
  App.on('ready', refresh);
  window.addEventListener('online', refresh);
  setInterval(refresh, 600000);
})();
