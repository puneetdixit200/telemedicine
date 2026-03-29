import { useEffect } from 'react';

const INDIAN_LANGUAGE_CODES = [
  'en',
  'as',
  'bn',
  'gu',
  'hi',
  'kn',
  'ml',
  'mr',
  'ne',
  'or',
  'pa',
  'ta',
  'te',
  'ur'
];

const LANGUAGE_LABELS = {
  en: 'English',
  as: 'Assamese',
  bn: 'Bengali',
  gu: 'Gujarati',
  hi: 'Hindi',
  kn: 'Kannada',
  ml: 'Malayalam',
  mr: 'Marathi',
  ne: 'Nepali',
  or: 'Odia',
  pa: 'Punjabi',
  ta: 'Tamil',
  te: 'Telugu',
  ur: 'Urdu'
};

function preserveMaterialIcons() {
  const iconNodes = document.querySelectorAll('.material-symbols-outlined');

  iconNodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) return;

    node.classList.add('notranslate');
    node.setAttribute('translate', 'no');

    const currentToken = String(node.textContent || '').trim();
    const storedToken = node.getAttribute('data-icon-token');

    if (!storedToken && currentToken) {
      node.setAttribute('data-icon-token', currentToken);
      return;
    }

    if (storedToken && currentToken !== storedToken) {
      node.textContent = storedToken;
    }
  });
}

function sanitizeLanguageDropdown() {
  const wrapper = document.querySelector('.gtranslate_wrapper');
  if (!wrapper) return;

  const selects = wrapper.querySelectorAll('select');
  selects.forEach((select) => {
    const options = Array.from(select.querySelectorAll('option'));

    options.forEach((option) => {
      const value = String(option.value || '').trim().toLowerCase();
      const text = String(option.textContent || '').trim();

      if (!value || !LANGUAGE_LABELS[value]) {
        option.remove();
        return;
      }

      if (!text || text.toLowerCase() === 'undefined') {
        option.textContent = LANGUAGE_LABELS[value];
      }
    });
  });
}

function TranslationService() {
  useEffect(() => {
    window.gtranslateSettings = {
      default_language: 'en',
      detect_browser_language: true,
      languages: INDIAN_LANGUAGE_CODES,
      wrapper_selector: '.gtranslate_wrapper'
    };

    preserveMaterialIcons();
    sanitizeLanguageDropdown();

    const observer = new MutationObserver(() => {
      preserveMaterialIcons();
      sanitizeLanguageDropdown();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const existingScript = document.querySelector('script[data-gtranslate-widget="true"]');
    if (existingScript) {
      return () => observer.disconnect();
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.gtranslate.net/widgets/latest/float.js';
    script.defer = true;
    script.setAttribute('data-gtranslate-widget', 'true');
    document.body.appendChild(script);

    return () => observer.disconnect();
  }, []);

  return (
    <section className="translation-service-dock" aria-label="Language translation">
      <div className="gtranslate_wrapper" />
    </section>
  );
}

export default TranslationService;
