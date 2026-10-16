// Today's chores, with optional time-of-day filters.
(function () {
  'use strict';
  var D = window.DATA;
  var V = { el: null, routine: null, pending: {} };
  var LANES = D.people.map(function (p) { return p.id; }).concat(['any']);

  function routine() { return V.routine ? D.routines.find(function (r) { return r.id === V.routine; }) : { id: 'all', name: 'All day', range: 'Today' }; }
  function listFor(who, r) {
    return D.chores.filter(function (c) { return (r.id === 'all' || c.r === r.id) && c.who === who; })
      .sort(function (a, b) { return (a.done - b.done) || ((b.overdue ? 1 : 0) - (a.overdue ? 1 : 0)); });
  }

  function row(c, p) {
    var pend = V.pending[c.id];
    var emoji = !c.emoji || ['✓', '✔', '✅'].indexOf(c.emoji) >= 0 ? '📋' : c.emoji;
    return '<button class="ch' + (c.done ? ' is-done' : '') + (pend ? ' is-checking' : '') + (c.overdue && !c.done ? ' is-overdue' : '') + '" data-ch="' + c.id + '">' +
      '<span class="ch-emoji">' + App.esc(emoji) + '<span class="ch-check"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span></span>' +
      '<span class="ch-text"><b>' + App.esc(c.title) + '</b>' +
      (c.label ? '<small>' + (routine().id === 'all' ? App.esc(D.routines.find(function (r) { return r.id === c.r; }).name) + ' · ' : '') + App.esc(c.label) + (c.doneBy ? ' · ' + App.esc(App.person(c.doneBy).name) : '') + '</small>' : c.overdue && !c.done ? '<small class="ch-late">Overdue</small>' : c.stars ? '<small>' + App.icon('star', 14, 'i--fill') + c.stars + (c.doneBy ? ' · ' + App.person(c.doneBy).name : '') + '</small>' : (c.doneBy ? '<small>by ' + App.person(c.doneBy).name + '</small>' : '')) +
      '</span>' +
      '</button>';
  }

  function weekGrid(id) {
    var w = D.week[id];
    if (!w) return '';
    var today = (App.now().getDay() + 6) % 7;
    return '<div class="ch-week"><div class="label">This week</div><div class="ch-week-row">' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (d, i) {
      var cls = i > today ? 'is-future' : i === today ? 'is-today' : (w[i] ? 'is-hit' : 'is-miss');
      return '<span class="' + cls + '"><i></i>' + d + '</span>';
    }).join('') + '</div></div>';
  }

  function lane(who, r) {
    var p = App.person(who), list = listFor(who, r);
    var done = list.filter(function (c) { return c.done; }).length;
    var all = list.length && done === list.length;
    var kid = D.stars[who] != null;
    return '<section class="ch-lane' + (all ? ' is-complete' : '') + '" data-lane="' + who + '" style="' + App.pstyle(p) + '">' +
      '<header class="ch-head">' + App.avatar(p, 42) +
      '<div><b>' + (who === 'any' ? 'Anyone' : p.name) + '</b>' +
      (kid ? '<span class="ch-stars">' + App.icon('star', 18, 'i--fill') + '<span class="num">' + D.stars[who] + '</span></span>' : '<span class="ch-sub">' + (who === 'any' ? 'Up for grabs' : (list.length ? done + ' of ' + list.length : 'Nothing')) + '</span>') + '</div>' +
      '<div class="ch-ring">' + App.ring(done, list.length || 1, 46) + '<span class="num">' + (all ? '✓' : list.length ? done + '/' + list.length : '–') + '</span></div>' +
      '</header>' +
      '<div class="ch-list">' + (list.length ? list.map(function (c) { return row(c, p); }).join('') : '<div class="ch-none serif"><i>Nothing ' + (r.id === 'all' ? 'today' : r.id === 'evening' ? 'this evening' : r.id === 'morning' ? 'this morning' : 'this afternoon') + '</i></div>') +
      (all ? '<div class="ch-alldone serif">All done<i>!</i></div>' : '') + '</div>' +
      weekGrid(who) +
      '</section>';
  }

  function render() {
    var r = routine(), auto = App.currentRoutine();
    var inR = D.chores.filter(function (c) { return (r.id === 'all' || c.r === r.id); });
    var done = inR.filter(function (c) { return c.done; }).length;
    V.el.innerHTML = '<div class="tasks">' +
      '<header class="t-head">' +
      '<div class="t-title"><div class="label">' + (r.id === auto.id ? 'Right now · ' : '') + r.range + '</div><h1 class="serif">' + r.name + '</h1></div>' +
      '<div class="seg">' + [{ id: 'all', name: 'All day' }].concat(D.routines).map(function (x) { return '<button class="' + (x.id === r.id ? 'is-on' : '') + '" data-r="' + x.id + '">' + x.name + '</button>'; }).join('') + '</div>' +
      '<div class="ch-toolbar"><button class="btn btn--ghost" data-manage-chores>Manage</button><button class="btn btn--solid" data-add-chore>Add chore</button></div>' +
      '<div class="t-progress"><span class="num">' + done + '<small>/' + inR.length + '</small></span><div class="t-bar"><i style="width:' + (inR.length ? done / inR.length * 100 : 0) + '%"></i></div><span class="label">done</span></div>' +
      '</header>' +
      '<div class="ch-lanes">' + LANES.map(function (w) { return lane(w, r); }).join('') + '</div>' +
      '<section class="meal-plan"></section>' +
      '</div>';
    App.mountMealPlan(V.el.querySelector('.meal-plan'));
  }

  function complete(c, btn, by) {
    var r = routine();
    V.pending[c.id] = true;
    btn.classList.add('is-checking');
    setTimeout(function () {
      delete V.pending[c.id];
      c.done = true;
      if (by) c.doneBy = by;
      var earner = D.stars[c.who] != null ? c.who : (by && D.stars[by] != null ? by : null);
      if (earner && c.stars) D.stars[earner] += c.stars;
      render();
      App.emit('data');
      var laneList = listFor(c.who, r);
      var laneDone = laneList.every(function (x) { return x.done; });
      var allDone = D.chores.filter(function (x) { return (r.id === 'all' || x.r === r.id); }).every(function (x) { return x.done; });
      if (allDone) {
        App.toast('<b>' + r.name + ' routine complete!</b> Everyone crushed it.', { icon: 'star', ms: 5000 });
        return;
      }
      App.toast('<b>' + App.esc(c.title) + '</b> done' + (earner && c.stars ? ' · +' + c.stars + '★ ' + App.person(earner).name : ''), {
        icon: 'check',
        undo: function () {
          c.done = false;
          delete c.doneBy;
          if (earner && c.stars) D.stars[earner] -= c.stars;
          render();
          App.emit('data');
        }
      });
    }, 350);
  }

  // "Anyone" chores ask who did it, so stars go to the right kid
  function whoDidIt(c, btn) {
    App.sheet('<div class="sheet-pad"><div class="label">' + c.emoji + ' ' + App.esc(c.title) + '</div><h2 class="serif sheet-h">Who did it?</h2>' +
      '<div class="add-who add-who--big">' + D.people.map(function (p) {
        return '<button class="who-btn" data-by="' + p.id + '" style="' + App.pstyle(p) + '">' + App.avatar(p, 88) + '<span>' + p.name + '</span></button>';
      }).join('') + '</div></div>', {
      onMount: function (s, close) {
        s.addEventListener('click', function (e) {
          var b = e.target.closest('[data-by]');
          if (!b) return;
          close();
          var fresh = V.el.querySelector('[data-ch="' + c.id + '"]');
          complete(c, fresh || btn, b.dataset.by);
        });
      }
    });
  }

  function options(items, selected) {
    return items.map(function (x) { return '<option value="' + App.esc(String(x[0])) + '"' + (String(x[0]) === String(selected) ? ' selected' : '') + '>' + App.esc(x[1]) + '</option>'; }).join('');
  }
  function choreSheet(t) {
    t = t || { title: '', who: 'any', r: V.routine || App.currentRoutine().id, every: 1, start: App.choreDate(App.now()) };
    var repeat = t.weekday != null ? 'weekly' : t.every === 0 ? 'once' : t.every === 1 ? 'daily' : 'interval';
    App.sheet('<form class="sheet-pad chore-form">' +
      '<div class="label">' + (t.id ? 'Edit chore' : 'New chore') + '</div><h2 class="serif sheet-h">' + (t.id ? 'Edit chore' : 'Add chore') + '</h2>' +
      '<label>Chore name<input name="title" required maxlength="120" value="' + App.esc(t.title) + '" placeholder="e.g. Water the plants"></label>' +
      '<div class="chore-fields"><label>Assign to<select name="who">' + options(D.people.map(function (p) { return [p.id, p.name]; }).concat([['any', 'Anyone']]), t.who) + '</select></label>' +
      '<label>Time of day<select name="routine">' + options(D.routines.map(function (r) { return [r.id, r.id === 'after' ? 'Afternoon' : r.name]; }), t.r) + '</select></label>' +
      '<label>Repeat<select name="repeat">' + options([['once', 'Once'], ['daily', 'Every day'], ['interval', 'Every few days'], ['weekly', 'Every week']], repeat) + '</select></label>' +
      '<label data-start>Start date<input name="start" type="date" value="' + App.esc(t.start || App.choreDate(App.now())) + '"></label>' +
      '<label data-interval>Every how many days?<input name="interval" type="number" min="2" max="365" step="1" value="' + (t.every > 1 ? t.every : 2) + '"></label>' +
      '<label data-weekday>Weekday<select name="weekday">' + options(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(function (d, i) { return [i, d]; }), t.weekday == null ? App.now().getDay() : t.weekday) + '</select></label></div>' +
      '<p class="chore-error" role="alert"></p><div class="sheet-actions"><button type="button" class="btn btn--ghost" data-cancel>Cancel</button><button type="submit" class="btn btn--solid">Save chore</button></div></form>', {
      onMount: function (s, close) {
        var f = s.querySelector('form');
        function update() {
          var mode = f.elements.repeat.value;
          s.querySelector('[data-start]').hidden = mode === 'weekly';
          s.querySelector('[data-interval]').hidden = mode !== 'interval';
          s.querySelector('[data-weekday]').hidden = mode !== 'weekly';
          f.elements.start.required = mode !== 'weekly'; f.elements.start.disabled = mode === 'weekly';
          f.elements.interval.disabled = mode !== 'interval';
        }
        update(); f.elements.repeat.addEventListener('change', update);
        s.querySelector('[data-cancel]').addEventListener('click', close);
        f.addEventListener('submit', function (e) {
          e.preventDefault(); if (!f.reportValidity()) return;
          var mode = f.elements.repeat.value;
          var input = { id: t.id, title: f.elements.title.value, who: f.elements.who.value, r: f.elements.routine.value };
          if (mode === 'weekly') input.weekday = Number(f.elements.weekday.value);
          else { input.start = f.elements.start.value; input.every = mode === 'once' ? 0 : mode === 'daily' ? 1 : Number(f.elements.interval.value); }
          try { App.saveChore(input); }
          catch (_) { s.querySelector('.chore-error').textContent = 'Could not save. Check the fields and allow storage on this device.'; return; }
          close(); render(); App.toast('Chore saved.');
        });
        f.elements.title.focus();
      }
    });
  }
  function manageSheet() {
    App.sheet('<div class="sheet-pad"><div class="label">All schedules</div><h2 class="serif sheet-h">Manage chores</h2>' +
      '<p class="sheet-p">Includes chores scheduled for other days.</p><div class="chore-manage">' +
      (D.choreTemplates.length ? D.choreTemplates.map(function (t) {
        return '<div class="chore-manage-row"><div><b>' + App.esc(t.title) + '</b><small>' + App.esc(t.who === 'any' ? 'Anyone' : App.person(t.who).name) + ' · ' + App.esc(t.label) + '</small></div>' +
          '<button class="btn btn--ghost" data-edit-chore="' + t.id + '" aria-label="Edit ' + App.esc(t.title) + '">Edit</button>' +
          '<button class="btn btn--ghost" data-delete-chore="' + t.id + '" aria-label="Delete ' + App.esc(t.title) + '">Delete</button></div>';
      }).join('') : '<p>No chores yet. Use Add chore to create one.</p>') + '</div></div>', {
      onMount: function (s, close) {
        s.addEventListener('click', function (e) {
          var b = e.target.closest('[data-edit-chore], [data-delete-chore]'); if (!b) return;
          var id = b.dataset.editChore || b.dataset.deleteChore;
          var t = D.choreTemplates.find(function (x) { return x.id === id; }); if (!t) return;
          close();
          if (b.dataset.editChore) return choreSheet(t);
          App.sheet('<div class="sheet-pad"><h2 class="serif sheet-h">Delete chore?</h2><p class="sheet-p">Remove “' + App.esc(t.title) + '” and its future repeats?</p>' +
            '<p class="chore-error" role="alert"></p><div class="sheet-actions"><button class="btn btn--ghost" data-cancel>Cancel</button><button class="btn btn--solid" data-confirm>Delete chore</button></div></div>', {
            onMount: function (sheet, finish) {
              sheet.querySelector('[data-cancel]').addEventListener('click', function () { finish(); manageSheet(); });
              sheet.querySelector('[data-confirm]').addEventListener('click', function () {
                try { App.deleteChore(id); }
                catch (_) { sheet.querySelector('.chore-error').textContent = 'Could not save the deletion on this device.'; return; }
                finish(); render(); manageSheet();
              });
            }
          });
        });
      }
    });
  }

  function onClick(e) {
    var t;
    if (e.target.closest('[data-add-chore]')) return choreSheet();
    if (e.target.closest('[data-manage-chores]')) return manageSheet();
    if ((t = e.target.closest('[data-r]'))) { V.routine = t.dataset.r === 'all' ? null : t.dataset.r; return render(); }
    if ((t = e.target.closest('[data-ch]'))) {
      var c = D.chores.filter(function (x) { return x.id === t.dataset.ch; })[0];
      if (!c || V.pending[c.id]) return;
      if (c.done) {
        c.done = false;
        var earner = D.stars[c.who] != null ? c.who : (c.doneBy && D.stars[c.doneBy] != null ? c.doneBy : null);
        if (earner && c.stars) D.stars[earner] -= c.stars;
        delete c.doneBy;
        render();
        App.emit('data');
        return;
      }
      if (c.who === 'any') return whoDidIt(c, t);
      complete(c, t);
    }
  }

  App.register('tasks', {
    minutely: true,
    show: function (el) {
      App.refreshChores();
      if (!V.el) { V.el = el; el.addEventListener('click', onClick); }
      render();
    }
  });
  App.on('time', function () { V.routine = null; });
})();
