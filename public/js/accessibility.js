(function () {
  var key = 'telemed.assisted_mode';
  var button = document.getElementById('assistedModeToggle');
  var body = document.body;
  if (!body || !button) return;

  function setMode(enabled) {
    body.classList.toggle('assisted-mode', enabled);
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    button.textContent = enabled ? 'Assisted mode: on' : 'Assisted mode';
    try {
      localStorage.setItem(key, enabled ? '1' : '0');
    } catch (_) {}
  }

  var enabled = false;
  try {
    enabled = localStorage.getItem(key) === '1';
  } catch (_) {
    enabled = false;
  }

  setMode(enabled);

  button.addEventListener('click', function () {
    setMode(!body.classList.contains('assisted-mode'));
  });
})();
