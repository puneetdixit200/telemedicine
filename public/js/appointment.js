(function () {
  var root = document.getElementById('appointmentRuntime');
  if (!root) return;

  var appointmentId = root.getAttribute('data-appointment-id');
  var isDoctor = root.getAttribute('data-is-doctor') === 'true';
  var callHref = root.getAttribute('data-call-href');
  var preconsultForm = document.getElementById('preconsultForm');
  var preconsultSyncStatus = document.getElementById('preconsultSyncStatus');

  var preconsultQueueKey = 'telemed.preconsult.queue.' + appointmentId;
  var preconsultDraftKey = 'telemed.preconsult.draft.' + appointmentId;

  function setPreconsultStatus(text, className) {
    if (!preconsultSyncStatus) return;
    preconsultSyncStatus.textContent = text;
    preconsultSyncStatus.className = className || 'page-subtitle';
  }

  function readQueuedPreconsult() {
    try {
      var raw = localStorage.getItem(preconsultQueueKey);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeQueuedPreconsult(payload) {
    try {
      localStorage.setItem(preconsultQueueKey, JSON.stringify(payload));
    } catch (_) {}
  }

  function clearQueuedPreconsult() {
    try {
      localStorage.removeItem(preconsultQueueKey);
    } catch (_) {}
  }

  function readDraft() {
    try {
      var raw = localStorage.getItem(preconsultDraftKey);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeDraft(payload) {
    try {
      localStorage.setItem(preconsultDraftKey, JSON.stringify(payload));
    } catch (_) {}
  }

  function clearDraft() {
    try {
      localStorage.removeItem(preconsultDraftKey);
    } catch (_) {}
  }

  function getPreconsultPayloadFromForm() {
    if (!preconsultForm) return null;
    var formData = new FormData(preconsultForm);
    return {
      problemDescription: String(formData.get('problemDescription') || ''),
      medicationsText: String(formData.get('medicationsText') || ''),
      savedAt: new Date().toISOString()
    };
  }

  function applyPayloadToForm(payload) {
    if (!preconsultForm || !payload) return;
    var problemField = preconsultForm.querySelector('[name="problemDescription"]');
    var medicationsField = preconsultForm.querySelector('[name="medicationsText"]');
    if (problemField) problemField.value = payload.problemDescription || '';
    if (medicationsField) medicationsField.value = payload.medicationsText || '';
  }

  async function syncQueuedPreconsult() {
    var queued = readQueuedPreconsult();
    if (!queued || !navigator.onLine) return;
    try {
      setPreconsultStatus('Syncing saved pre-consult data...', 'page-subtitle');
      var body = new URLSearchParams();
      body.set('problemDescription', queued.problemDescription || '');
      body.set('medicationsText', queued.medicationsText || '');

      var res = await fetch('/appointments/' + appointmentId + '/prep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          accept: 'text/html'
        },
        body: body.toString()
      });

      if (!res.ok) {
        setPreconsultStatus('Saved locally. Sync will retry automatically.', 'error');
        return;
      }

      clearQueuedPreconsult();
      clearDraft();
      setPreconsultStatus('Pre-consult data synced successfully.', 'success');
      window.location.reload();
    } catch (_) {
      setPreconsultStatus('Saved locally. Sync will retry automatically.', 'error');
    }
  }

  async function pingPresence() {
    try {
      await fetch('/users/presence/ping', { method: 'POST' });
    } catch (_) {}
  }

  function setJoinCta(enabled) {
    var old = document.getElementById('joinCallLink');
    if (!old) return;
    var parent = old.parentElement;
    if (!parent) return;

    if (enabled && old.tagName !== 'A') {
      parent.innerHTML = '<a id="joinCallLink" class="btn-primary" href="' + callHref + '">Join Call (Video/Audio/Text)</a>';
      return;
    }
    if (!enabled && old.tagName === 'A') {
      parent.innerHTML = '<span id="joinCallLink" class="badge">Call locked: both users must be online</span>';
    }
  }

  async function refreshPresence() {
    try {
      var res = await fetch('/appointments/' + appointmentId + '/presence', { headers: { accept: 'application/json' } });
      if (!res.ok) return;
      var json = await res.json();
      var doctorBadge = document.getElementById('doctorOnlineBadge');
      var patientBadge = document.getElementById('patientOnlineBadge');
      if (doctorBadge) doctorBadge.textContent = json.doctorOnline ? 'online' : 'offline';
      if (patientBadge) patientBadge.textContent = json.patientOnline ? 'online' : 'offline';
      setJoinCta(Boolean(json.canStartCall));
    } catch (_) {}
  }

  var form = document.getElementById('uploadForm');
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var status = document.getElementById('uploadStatus');
      if (!navigator.onLine) {
        if (status) {
          status.textContent = 'You are offline. Upload will work when internet is back.';
          status.className = 'error';
        }
        return;
      }
      if (!status) return;
      status.textContent = 'Uploading...';
      var data = new FormData(form);
      var res = await fetch('/documents/upload', {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' }
      });
      var json = await res.json().catch(function () {
        return null;
      });
      if (!res.ok) {
        status.textContent = json && json.error ? json.error : 'Upload failed';
        status.className = 'error';
        return;
      }
      status.textContent = 'Uploaded.';
      status.className = 'success';
      window.location.reload();
    });
  }

  if (preconsultForm) {
    var existingDraft = readDraft();
    if (existingDraft) {
      applyPayloadToForm(existingDraft);
      setPreconsultStatus('Draft restored locally.', 'page-subtitle');
    }

    var queuedDraft = readQueuedPreconsult();
    if (queuedDraft) {
      applyPayloadToForm(queuedDraft);
      setPreconsultStatus('Saved offline. Waiting to sync.', 'error');
    }

    preconsultForm.addEventListener('input', function () {
      var payload = getPreconsultPayloadFromForm();
      if (payload) writeDraft(payload);
    });

    preconsultForm.addEventListener('submit', function (e) {
      if (navigator.onLine) return;
      e.preventDefault();
      var payload = getPreconsultPayloadFromForm();
      if (!payload) return;
      writeQueuedPreconsult(payload);
      writeDraft(payload);
      setPreconsultStatus('Saved offline. Will auto-sync when internet returns.', 'success');
    });

    window.addEventListener('online', syncQueuedPreconsult);
    window.addEventListener('offline', function () {
      setPreconsultStatus('Offline mode active. Changes are stored on this device.', 'error');
    });
  }

  pingPresence();
  refreshPresence();
  syncQueuedPreconsult();
  setInterval(function () {
    pingPresence();
    refreshPresence();
  }, isDoctor ? 15000 : 20000);
})();
