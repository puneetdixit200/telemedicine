(function () {
  var root = document.getElementById('appointmentRuntime');
  if (!root) return;

  var appointmentId = root.getAttribute('data-appointment-id');
  var isDoctor = root.getAttribute('data-is-doctor') === 'true';
  var callHref = root.getAttribute('data-call-href');

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
      parent.innerHTML = '<a id="joinCallLink" href="' + callHref + '">Join Call (Video/Audio/Text)</a>';
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
      status.textContent = 'Uploading...';
      var data = new FormData(form);
      var res = await fetch('/documents/upload', { method: 'POST', body: data });
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

  pingPresence();
  refreshPresence();
  setInterval(function () {
    pingPresence();
    refreshPresence();
  }, isDoctor ? 15000 : 20000);
})();
