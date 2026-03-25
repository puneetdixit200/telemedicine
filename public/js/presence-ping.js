(function () {
  if (document.body.getAttribute('data-authenticated') !== 'true') return;
  var badge = document.getElementById('selfPresenceBadge');

  function refreshStatus() {
    if (!badge) return;
    fetch('/users/presence/status')
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (json) {
        if (!json) return;
        badge.textContent = json.isCallOnline ? 'online' : 'offline';
      })
      .catch(function () {});
  }

  function ping() {
    fetch('/users/presence/ping', { method: 'POST' })
      .then(function () {
        refreshStatus();
      })
      .catch(function () {});
  }

  refreshStatus();
  ping();
  setInterval(ping, 25000);
})();
