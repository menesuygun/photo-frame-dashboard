// Undated reminders are independent of chore schedules and completions.
(function () {
  'use strict';
  var D = window.DATA, key = 'frame-reminders-v1', view = null;
  function valid(item) {
    return item && typeof item.id === 'string' && /^[a-zA-Z0-9-]+$/.test(item.id) && typeof item.title === 'string' && item.title.trim() && item.title.length <= 200 && typeof item.done === 'boolean';
  }
  function read() {
    try {
      var items = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(items) && items.every(valid) && new Set(items.map(function (item) { return item.id; })).size === items.length) return items;
    } catch (_) {}
    return [];
  }
  D.reminders = read();
  function write(items) {
    localStorage.setItem(key, JSON.stringify(items));
    D.reminders = items;
    if (view) render();
    App.emit('reminders');
  }
  App.saveReminder = function (title, id) {
    title = String(title || '').trim();
    var existing = id && D.reminders.find(function (item) { return item.id === id; });
    if (id && !existing) throw new Error('That reminder no longer exists.');
    var item = { id: id || 'reminder-' + crypto.randomUUID(), title: title, done: existing ? existing.done : false };
    if (!valid(item)) throw new Error('Enter a reminder up to 200 characters.');
    write(existing ? D.reminders.map(function (old) { return old.id === id ? item : old; }) : D.reminders.concat([item]));
    return item;
  };
  App.toggleReminder = function (id) {
    write(D.reminders.map(function (item) { return item.id === id ? Object.assign({}, item, { done: !item.done }) : item; }));
  };
  App.removeReminder = function (id) {
    var item = D.reminders.find(function (item) { return item.id === id; });
    if (!item) return;
    write(D.reminders.filter(function (item) { return item.id !== id; }));
    App.toast('Reminder removed', { icon: 'check', undo: function () {
      if (!D.reminders.some(function (current) { return current.id === item.id; })) write(D.reminders.concat([item]));
    } });
  };
  App.reminderSheet = function (id) {
    var item = id && D.reminders.find(function (item) { return item.id === id; });
    if (id && !item) return;
    App.sheet('<form class="sheet-pad reminder-form"><h2 class="serif sheet-h">' + (item ? 'Edit reminder' : 'Add reminder') + '</h2><label>Reminder<input class="big-input" name="title" required maxlength="200" value="' + App.esc(item ? item.title : '') + '" placeholder="Something to remember…"></label><p role="alert" data-reminder-error></p><div class="sheet-actions"><button class="btn btn--ghost" type="button" data-cancel>Cancel</button><button class="btn btn--solid" type="submit">Save reminder</button></div></form>', {
      onMount: function (sheet, close) {
        var form = sheet.querySelector('form');
        sheet.querySelector('[data-cancel]').addEventListener('click', close);
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          try { App.saveReminder(form.elements.title.value, id); close(); }
          catch (error) { sheet.querySelector('[data-reminder-error]').textContent = error.message; }
        });
        form.elements.title.focus();
      }
    });
  };
  App.reminderPreview = function () {
    var items = D.reminders.filter(function (item) { return !item.done; });
    return '<div class="h-reminder-head"><button class="label" data-go="reminders">Reminders</button><button class="h-reminder-add" data-reminder-add aria-label="Add reminder">' + App.icon('plus', 20) + '</button></div><div class="h-reminder-list">' +
      (items.length ? items.slice(0, 3).map(function (item) {
        return '<button class="h-reminder-row" data-reminder-toggle="' + item.id + '" aria-label="Complete ' + App.esc(item.title) + '"><span class="reminder-box"></span><span>' + App.esc(item.title) + '</span></button>';
      }).join('') : '<button class="h-reminder-empty" data-reminder-add>No reminders. Add one.</button>') + '</div>' +
      '<button class="h-reminder-all" data-go="reminders">View all' + (items.length ? ' · ' + items.length : '') + '</button>';
  };
  function render() {
    var items = D.reminders.filter(function (item) { return !item.done; }).concat(D.reminders.filter(function (item) { return item.done; }));
    view.innerHTML = '<div class="reminders"><header class="reminders-head"><h1 class="serif">Reminders</h1><button class="btn btn--solid" data-reminder-add>Add reminder</button></header><div class="reminders-list">' +
      (items.length ? items.map(function (item) {
        return '<div class="reminder-row' + (item.done ? ' is-done' : '') + '"><button class="reminder-toggle" data-reminder-toggle="' + item.id + '" aria-pressed="' + item.done + '"><span class="reminder-box">' + (item.done ? App.icon('check', 20) : '') + '</span><span>' + App.esc(item.title) + '</span></button><button class="btn btn--ghost" data-reminder-edit="' + item.id + '" aria-label="Edit ' + App.esc(item.title) + '">Edit</button><button class="btn btn--ghost" data-reminder-remove="' + item.id + '" aria-label="Remove ' + App.esc(item.title) + '">Remove</button></div>';
      }).join('') : '<div class="reminders-empty serif">Nothing to remember.<br><i>Add a reminder whenever you need one.</i></div>') + '</div></div>';
  }
  App.register('reminders', { show: function (el) {
    if (!view) {
      view = el;
      el.addEventListener('click', function (event) {
        try {
          var button;
          if (event.target.closest('[data-reminder-add]')) return App.reminderSheet();
          if ((button = event.target.closest('[data-reminder-edit]'))) return App.reminderSheet(button.dataset.reminderEdit);
          if ((button = event.target.closest('[data-reminder-toggle]'))) return App.toggleReminder(button.dataset.reminderToggle);
          if ((button = event.target.closest('[data-reminder-remove]'))) return App.removeReminder(button.dataset.reminderRemove);
        } catch (_) { App.toast('Could not save reminders on this device.'); }
      });
    }
    render();
  }, resume: render });
  window.addEventListener('storage', function (event) {
    if (event.key === key || event.key === null) { D.reminders = read(); if (view) render(); App.emit('reminders'); }
  });
})();
