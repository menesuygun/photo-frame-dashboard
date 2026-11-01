// Daytime photo screensaver and a quiet, theme-tinted night display (11 PM–6 AM).
(function () {
  'use strict';
  var D = window.DATA, $ = App.$;
  var amb = { show: null }, shiftTimer = null;

  function ambientInfo() {
    var n = App.now(), w = App.weatherNow(), next = App.nextEvent();
    return '<div class="amb-clock"><div class="amb-time num">' + App.fmt.time(n, false) + '</div>' +
      '<div class="amb-date">' + App.fmt.day(n) + ', ' + App.fmt.month(n) + ' ' + n.getDate() + '</div></div>' +
      '<div class="amb-right">' +
      '<div class="amb-wx">' + App.icon(w.cond, 44) + '<span class="num">' + w.temp + '°</span><small>' + w.summary + '</small></div>' +
      (next ? '<div class="amb-next" style="' + App.pstyle(App.evColor(next)) + '"><i></i>' + App.esc(next.title) + ' · ' + App.fmt.time(next.start) + '</div>' : '') +
      '<div class="amb-who">' + D.people.map(function (p) { return App.avatar(p, 34); }).join('') + '</div>' +
      '</div>';
  }
  function nightInfo() {
    var n = App.now(), w = App.weatherNow();
    var next = App.events().filter(function (event) { return event.start > n; }).sort(function (a, b) { return a.start - b.start; })[0];
    return '<div class="nt-clock"><div class="nt-time num">' + App.fmt.time(n, false) + '<span class="nt-ampm">' + App.fmt.ampm(n) + '</span></div>' +
      '<div class="nt-date serif">' + App.fmt.day(n) + ', ' + App.fmt.month(n) + ' ' + n.getDate() + '</div></div>' +
      '<div class="nt-details"><div class="nt-weather"><div class="nt-label">East Gwillimbury</div><div class="nt-weather-now">' + App.icon(w.cond, 30) + '<span>' + App.esc(w.temp) + '°</span></div><div class="nt-weather-text">' + App.esc(w.label || w.summary || 'Weather unavailable') + '</div></div>' +
      '<div class="nt-next"><div class="nt-label">Next event</div>' + (next ? '<div class="nt-event-title">' + App.esc(next.title) + '</div><div class="nt-event-time">' + App.esc(App.fmt.rel(next.start)) + ' · ' + (next.allDay ? 'All day' : App.fmt.time(next.start)) + '</div>' : '<div class="nt-event-title">No upcoming events</div>') + '</div></div>';
  }

  function paint() {
    if (App.mode === 'ambient' || App.mode === 'night') {
      var expected = App.isNight() ? 'night' : 'ambient';
      if (App.mode !== expected) { App.setMode(expected); return; }
    }
    if (App.mode === 'ambient') $('#ambient .amb-info').innerHTML = ambientInfo();
    if (App.mode === 'night') $('#night .nt-inner').innerHTML = nightInfo();
  }

  // Nudge static content a few px every minute so nothing sits still for hours (image retention)
  function pixelShift() {
    var x = Math.round(Math.random() * 8 - 4), y = Math.round(Math.random() * 8 - 4);
    App.$$('.amb-info, .nt-inner').forEach(function (el) { el.style.transform = 'translate(' + x + 'px,' + y + 'px)'; });
  }

  App.on('ready', function () {
    $('#ambient').innerHTML = '<div class="amb-stage"></div><div class="amb-scrim"></div><div class="amb-info"></div><div class="amb-photo-credit"></div><button class="amb-next-photo" aria-label="Next screensaver photo">' + App.icon('right', 30) + '</button>';
    $('#night').innerHTML = '<div class="nt-inner"></div>';
    amb.show = new App.Slideshow($('#ambient .amb-stage'), { layout: 'cover', captions: false, interval: 20000, photos: App.scenicPhotos, onChange: function (slide) { var p=slide.photos[0]; $('#ambient .amb-photo-credit').innerHTML=App.esc(p.place)+' · Photo by '+App.esc(p.photographer)+' on Unsplash'; } });
    $('#ambient').addEventListener('click', function (event) { if (event && event.target.closest('.amb-next-photo')) { App.resetIdle(); amb.show.next(); return; } App.resetIdle(); App.setMode('day'); App.go('home'); });
    $('#night').addEventListener('click', function () { App.resetIdle(); App.setMode('day'); App.go('home'); });
  });

  App.on('mode', function (m) {
    clearInterval(shiftTimer);
    if (m === 'ambient') { amb.show.start(); paint(); shiftTimer = setInterval(pixelShift, 60000); }
    else amb.show.stop();
    if (m === 'night') { paint(); shiftTimer = setInterval(pixelShift, 60000); }
    App.resetIdle();
  });
  App.on('minute', paint);
  App.on('weather', paint);
  App.on('data', paint);
})();
