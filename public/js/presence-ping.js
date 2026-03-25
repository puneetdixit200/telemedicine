(function () {
  if (document.body.getAttribute('data-authenticated') !== 'true') return;

  function ping() {
    fetch('/users/presence/ping', { method: 'POST' }).catch(function () {});
  }

  ping();
  setInterval(ping, 25000);
})();
