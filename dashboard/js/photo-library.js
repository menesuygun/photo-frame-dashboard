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
    window.DATA.photos = records.map(function (p) { return Object.assign({}, p, { url: URL.createObjectURL(p.blob), from: 'family', tag: 'uploads' }); });
    App.emit('photos'); App.emit('data');
    // Let old slides finish their image transition before releasing their URLs.
    setTimeout(function () { old.forEach(function (p) { if (p.url) URL.revokeObjectURL(p.url); }); }, 3000);
  }
  async function prepare(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use JPG, PNG or WebP files. Export HEIC photos as JPG first.');
    if (file.size > 20 * 1024 * 1024) throw new Error('Use photos smaller than 20 MB each.');
    var url = URL.createObjectURL(file), image = new Image();
    try {
      await new Promise(function (resolve, reject) { image.onload = resolve; image.onerror = function () { reject(new Error('This photo could not be opened.')); }; image.src = url; });
      var scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', 0.9); });
      if (!blob) throw new Error('This photo could not be saved.');
      var d = new Date(file.lastModified || Date.now());
      return { id: crypto.randomUUID(), blob: blob, o: canvas.height > canvas.width ? 'p' : 'l',
        date: App.choreDate(d), place: file.name.slice(0, 120), fav: false };
    } finally { URL.revokeObjectURL(url); }
  }
  ready = reload().catch(function () { App.emit('photos'); });
  App.addPhotoFiles = async function (files, progress) {
    await ready;
    if (!files.length) throw new Error('Choose at least one photo.');
    if (records.length + files.length > 100) throw new Error('Keep your library to 100 photos. Remove some before adding more.');
    var added = [];
    for (var i = 0; i < files.length; i++) { if (progress) progress(i + 1, files.length); added.push(await prepare(files[i])); }
    await transaction('readwrite', function (store) { added.forEach(function (p) { store.put(p); }); });
    await reload(); return added.length;
  };
  App.openPhotoUpload = function () {
    App.sheet('<div class="sheet-pad photo-upload"><h2 class="serif sheet-h">Add photos</h2>' +
      '<p class="sheet-p">Choose JPG, PNG or WebP files. Photos stay in this browser on this device. Up to 100 photos, 20 MB per file.</p>' +
      '<label>Choose photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-files></label>' +
      '<p role="status" data-status></p><div class="sheet-actions"><button class="btn btn--ghost" data-cancel>Cancel</button><button class="btn btn--solid" data-save>Add selected photos</button></div></div>', {
      onMount: function (s, close) {
        var busy = false;
        s.querySelector('[data-cancel]').addEventListener('click', close);
        s.querySelector('[data-save]').addEventListener('click', async function () {
          if (busy) return;
          var files = Array.from(s.querySelector('[data-files]').files);
          var status = s.querySelector('[data-status]');
          if (!files.length) { status.textContent = 'Choose at least one photo.'; return; }
          busy = true; s.querySelector('[data-save]').disabled = true;
          try {
            var count = await App.addPhotoFiles(files, function (i, total) { status.textContent = 'Preparing photo ' + i + ' of ' + total + '…'; });
            if (s.isConnected) close(); App.toast('Added ' + count + ' photos.');
          } catch (e) { status.textContent = e.message || 'Photo storage is unavailable or full on this device.'; }
          finally { busy = false; s.querySelector('[data-save]').disabled = false; }
        });
      }
    });
  };
  App.managePhotos = function () {
    App.sheet('<div class="sheet-pad"><h2 class="serif sheet-h">Your photos</h2><p class="sheet-p">Photos saved on this device.</p><p role="status" data-status></p>' +
      '<div>' + (window.DATA.photos.length ? window.DATA.photos.map(function (p) {
        return '<div class="photo-library-row"><img src="' + p.url + '" alt=""><span>' + App.esc(p.place) + '</span><button class="btn btn--ghost" data-remove="' + p.id + '">Remove</button></div>';
      }).join('') : '<p>No photos yet. Use Add photos to upload your own.</p>') + '</div></div>', {
      onMount: function (s) {
        s.addEventListener('click', async function (e) {
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
