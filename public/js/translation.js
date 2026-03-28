(function () {
  if (!document.getElementById('google_translate_element')) return;
  var selector = document.getElementById('languageSelector');
  var supported = ['en', 'hi', 'bn', 'gu', 'kn', 'ml', 'mr', 'pa', 'ta', 'te', 'ur'];
  var langStorageKey = 'telemed_language';

  function setGoogTransCookie(lang) {
    var value = '/en/' + lang;
    document.cookie = 'googtrans=' + value + ';path=/;max-age=31536000';
    document.cookie = 'googtrans=' + value + ';domain=' + window.location.hostname + ';path=/;max-age=31536000';
  }

  function getSelectedLanguageFromCookie() {
    var cookie = document.cookie
      .split(';')
      .map(function (item) {
        return item.trim();
      })
      .find(function (item) {
        return item.indexOf('googtrans=') === 0;
      });
    if (!cookie) return 'en';
    var parts = cookie.split('=')[1].split('/');
    var lang = parts[2] || 'en';
    return supported.indexOf(lang) >= 0 ? lang : 'en';
  }

  function setStoredLanguage(lang) {
    try {
      localStorage.setItem(langStorageKey, lang);
      sessionStorage.setItem(langStorageKey, lang);
    } catch (_err) {
      // Ignore storage failures (private mode / restricted environments).
    }
  }

  function getStoredLanguage() {
    try {
      var fromSession = sessionStorage.getItem(langStorageKey);
      if (fromSession && supported.indexOf(fromSession) >= 0) return fromSession;

      var fromLocal = localStorage.getItem(langStorageKey);
      if (fromLocal && supported.indexOf(fromLocal) >= 0) return fromLocal;
    } catch (_err) {
      // Ignore storage failures and rely on cookie.
    }
    return null;
  }

  function hideGoogleTopBar() {
    document.documentElement.style.top = '0px';
    document.body.style.top = '0px';
    var selectors = [
      '.goog-te-banner-frame.skiptranslate',
      'iframe.goog-te-banner-frame',
      'iframe.skiptranslate',
      'iframe[title*="Translate" i]',
      'iframe[src*="translate.google" i]',
      'iframe[src*="translate.googleapis" i]',
      '#goog-gt-tt',
      '.goog-tooltip',
      '.goog-text-highlight'
    ];

    selectors.forEach(function (selectorText) {
      var nodes = document.querySelectorAll(selectorText);
      nodes.forEach(function (node) {
        node.style.display = 'none';
        node.style.visibility = 'hidden';
      });
    });
  }

  var preferredLanguage = getStoredLanguage() || getSelectedLanguageFromCookie();
  if (supported.indexOf(preferredLanguage) === -1) preferredLanguage = 'en';

  setStoredLanguage(preferredLanguage);
  setGoogTransCookie(preferredLanguage);

  if (selector) {
    selector.value = preferredLanguage;
    selector.addEventListener('change', function () {
      var next = selector.value;
      if (supported.indexOf(next) === -1) next = 'en';
      setStoredLanguage(next);
      setGoogTransCookie(next);
      window.location.reload();
    });
  }

  // Reset container to avoid stale state if previous widget config was cached.
  var wrapper = document.getElementById('google_translate_element');
  if (wrapper) wrapper.innerHTML = '';

  window.googleTranslateElementInit = function () {
    if (!window.google || !window.google.translate) return;
    new window.google.translate.TranslateElement(
      {
        pageLanguage: 'en',
        autoDisplay: false,
        includedLanguages: 'en,hi,bn,gu,kn,ml,mr,pa,ta,te,ur',
        layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
      },
      'google_translate_element'
    );
  };

  var oldScript = document.querySelector('script[data-google-translate="true"]');
  if (oldScript) oldScript.remove();

  var script = document.createElement('script');
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  script.defer = true;
  script.setAttribute('data-google-translate', 'true');
  document.body.appendChild(script);

  hideGoogleTopBar();
  setInterval(hideGoogleTopBar, 500);

  var observer = new MutationObserver(function () {
    hideGoogleTopBar();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
