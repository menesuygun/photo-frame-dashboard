// Personal photos stay in IndexedDB on the frame's browser.
(function () {
  'use strict';
  var database, records = [], ready;
  window.DATA.photos = [];
  function open() {
    if (database) return database;
    database = new Promise(function (resolve, reject) {
      var req = indexedDB.open('frame-photos', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('photos', { keyPath: 'id' }); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('Photo storage is blocked.')); };
    });
    return database;
  }
  async function transaction(mode, operation) {
    var db = await open();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('photos', mode), result;
      var request = operation(tx.objectStore('photos'));
      if (request) request.onsuccess = function () { result = request.result; };
      tx.oncomplete = function () { resolve(result); };
      tx.onerror = tx.onabort = function () { reject(tx.error || new Error('Photo storage failed.')); };
    });
  }
  async function reload() {
    records = await transaction('readonly', function (store) { return store.getAll(); });
    var old = window.DATA.photos;
    window.DATA.photos = records.map(function (p) { return Object.assign({}, p, { place: p.caption || p.location || '', date: p.dateSource ? p.date : '', url: URL.createObjectURL(p.blob), from: 'family', tag: 'uploads' }); });
    App.emit('photos'); App.emit('data');
    // Let old slides finish their image transition before releasing their URLs.
    setTimeout(function () { old.forEach(function (p) { if (p.url) URL.revokeObjectURL(p.url); }); }, 3000);
  }
  async function prepare(file, details) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use JPG, PNG or WebP files. Export HEIC photos as JPG first.');
    if (file.size > 20 * 1024 * 1024) throw new Error('Use photos smaller than 20 MB each.');
    details = details || await App.inspectPhoto(file);
    var url = URL.createObjectURL(file), image = new Image();
    try {
      await new Promise(function (resolve, reject) { image.onload = resolve; image.onerror = function () { reject(new Error('This photo could not be opened.')); }; image.src = url; });
      var scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', 0.9); });
      if (!blob) throw new Error('This photo could not be saved.');

      return { id: crypto.randomUUID(), blob: blob, o: canvas.height > canvas.width ? 'p' : 'l',
        date: details.date || '', dateSource: details.dateSource || 'unknown', location: details.location || '', caption: (details.caption || '').trim().slice(0, 160), fav: false };
    } finally { URL.revokeObjectURL(url); }
  }
  ready = reload().catch(function () { App.emit('photos'); });
  App.addPhotoFiles = async function (files, progress, details) {
    await ready;
    if (!files.length) throw new Error('Choose at least one photo.');
    if (records.length + files.length > 100) throw new Error('Keep your library to 100 photos. Remove some before adding more.');
    var added = [];
    for (var i = 0; i < files.length; i++) { if (progress) progress(i + 1, files.length); added.push(await prepare(files[i], details && details[i])); }
    await transaction('readwrite', function (store) { added.forEach(function (p) { store.put(p); }); });
    await reload(); return added.length;
  };
  App.openPhotoUpload = function () {
    var previews = [], details = [], files = [], generation = 0;
    App.sheet('<div class="sheet-pad photo-upload"><h2 class="serif sheet-h">Add photos</h2>' +
      '<p class="sheet-p">Choose JPG, PNG or WebP files. Add a caption or use the detected location. Photo date comes from metadata when available.</p>' +
      '<label>Choose photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-files></label>' +
      '<p class="photo-lookup-note">GPS coordinates are sent to Photon/Komoot for place names; photos stay on this device. Location data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>.</p>' +
      '<div data-details></div><p role="status" data-status></p><div class="sheet-actions"><button class="btn btn--ghost" data-cancel>Cancel</button><button class="btn btn--solid" data-save disabled>Add selected photos</button></div></div>', {
      onClose: function () { generation++; previews.forEach(URL.revokeObjectURL); },
      onMount: function (s, close) {
        var busy = false, status = s.querySelector('[data-status]');
        s.querySelector('[data-cancel]').addEventListener('click', close);
        s.querySelector('[data-files]').addEventListener('change', async function () {
          var token = ++generation; s.querySelector('[data-save]').disabled = true;
          previews.forEach(URL.revokeObjectURL); previews = []; details = [];
          files = Array.from(s.querySelector('[data-files]').files);
          s.querySelector('[data-details]').innerHTML = '';
          if (files.length + records.length > 100) { status.textContent = 'Keep your library to 100 photos.'; return; }
          for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) { status.textContent = 'Use JPG, PNG or WebP, under 20 MB each.'; return; }
            status.textContent = 'Reading photo details ' + (i + 1) + ' of ' + files.length + '…';
            var detail = await App.inspectPhoto(file);
            if (token !== generation) return;
            details.push(detail); previews.push(URL.createObjectURL(file));
          }
          if (token !== generation) return;
          s.querySelector('[data-details]').innerHTML = details.map(function (d, i) {
            return '<div class="photo-detail-row"><img src="' + previews[i] + '" alt="Photo ' + (i + 1) + '"><div><label>Caption<input maxlength="160" data-caption="' + i + '" placeholder="' + App.esc(d.location || 'Write a caption or location') + '"></label>' +
              '<label>Photo date<input type="date" data-date="' + i + '" value="' + App.esc(d.date) + '"></label>' +
              '<small>' + (d.date ? 'Date found in photo metadata.' : 'No photo date found. Add a date, or leave it unknown.') + '</small></div></div>';
          }).join('');
          status.textContent = files.length ? 'Review the captions and dates, then add your photos.' : 'Choose at least one photo.';
          s.querySelector('[data-save]').disabled = !files.length;
        });
        s.querySelector('[data-save]').addEventListener('click', async function () {
          if (busy || !files.length || details.length !== files.length) return;
          busy = true; s.querySelector('[data-save]').disabled = true; s.querySelector('[data-files]').disabled = true;
          try {
            var values = details.map(function (d, i) {
              var date = s.querySelector('[data-date="' + i + '"]').value;
              return Object.assign({}, d, { caption: s.querySelector('[data-caption="' + i + '"]').value, date: date, dateSource: date === d.date ? d.dateSource : 'manual' });
            });
            var count = await App.addPhotoFiles(files, function (i, total) { status.textContent = 'Saving photo ' + i + ' of ' + total + '…'; }, values);
            if (s.isConnected) close(); App.toast('Added ' + count + ' photos.');
          } catch (e) { status.textContent = e.message || 'Photo storage is unavailable or full on this device.'; }
          finally { busy = false; s.querySelector('[data-save]').disabled = false; s.querySelector('[data-files]').disabled = false; }
        });
      }
    });
  };
  App.editPhotoDetails = async function (id, caption, date) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a valid date.');
    if (date && App.choreDate(new Date(date + 'T12:00:00')) !== date) throw new Error('Choose a valid date.');
    var p = records.find(function (p) { return p.id === id; });
    if (!p) throw new Error('Photo not found.');
    var updated = Object.assign({}, p, { caption: String(caption || '').trim().slice(0, 160), date: date, dateSource: date ? 'manual' : 'unknown' });
    await transaction('readwrite', function (store) { return store.put(updated); }); await reload();
  };
  App.managePhotos = function () {
    App.sheet('<div class="sheet-pad"><h2 class="serif sheet-h">Your photos</h2><p class="sheet-p">Photos saved on this device.</p><p role="status" data-status></p>' +
      '<div>' + (window.DATA.photos.length ? window.DATA.photos.map(function (p) {
        return '<div class="photo-library-row"><img src="' + p.url + '" alt=""><span>' + App.esc(p.place || 'No caption') + '<small>' + App.esc(App.photoMeta(p).date) + '</small></span><button class="btn btn--ghost" data-edit="' + p.id + '">Edit</button><button class="btn btn--ghost" data-remove="' + p.id + '">Remove</button></div>';
      }).join('') : '<p>No photos yet. Use Add photos to upload your own.</p>') + '</div></div>', {
      onMount: function (s) {
        s.addEventListener('click', async function (e) {
          var edit = e.target.closest('[data-edit]');
          if (edit) {
            var p = window.DATA.photos.find(function (p) { return p.id === edit.dataset.edit; });
            App.sheet('<div class="sheet-pad photo-upload"><h2 class="serif sheet-h">Edit photo details</h2><label>Caption<input maxlength="160" data-caption value="' + App.esc(p.caption || '') + '" placeholder="' + App.esc(p.location || 'Write a caption or location') + '"></label><label>Photo date<input type="date" data-date value="' + App.esc(p.date) + '"></label><p role="status" data-status></p><div class="sheet-actions"><button class="btn btn--solid" data-save>Save details</button></div></div>', {
              onMount: function (sheet, close) { sheet.querySelector('[data-save]').addEventListener('click', async function () {
                try { await App.editPhotoDetails(p.id, sheet.querySelector('[data-caption]').value, sheet.querySelector('[data-date]').value); close(); App.managePhotos(); }
                catch (e) { sheet.querySelector('[data-status]').textContent = e.message; }
              }); }
            }); return;
          }
          var b = e.target.closest('[data-remove]'); if (!b || b.disabled) return;
          b.disabled = true;
          try {
            await transaction('readwrite', function (store) { return store.delete(b.dataset.remove); });
            await reload(); b.closest('.photo-library-row').remove();
            s.querySelector('[data-status]').textContent = 'Photo removed.';
          } catch (_) { s.querySelector('[data-status]').textContent = 'Could not remove the photo from storage.'; b.disabled = false; }
        });
      }
    });
  };
})();
