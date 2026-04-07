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
  const wrappers = document.querySelectorAll('.gtranslate_wrapper');
  if (!wrappers.length) return;

  wrappers.forEach((wrapper) => {
    const selects = wrapper.querySelectorAll('select');

    selects.forEach((select) => {
      const options = Array.from(select.querySelectorAll('option'));

      options.forEach((option) => {
        const rawValue = String(option.value || '').trim();
        const text = String(option.textContent || '').trim();

        // Keep the placeholder option for native mobile select behavior.
        if (!rawValue) {
          if (!text || text.toLowerCase() === 'undefined') {
            option.textContent = 'Choose language';
          }
          return;
        }

        // GTranslate dropdown uses values like "en|hi". Keep only allowed target codes.
        const normalized = rawValue.toLowerCase();
        const languageCode = normalized.includes('|') ? normalized.split('|').pop() : normalized;

        if (!languageCode || !LANGUAGE_LABELS[languageCode]) {
          option.remove();
          return;
        }

        if (!text || text.toLowerCase() === 'undefined') {
          option.textContent = LANGUAGE_LABELS[languageCode];
        }
      });
    });
  });
}

function TranslationService({ variant = 'dock' }) {
  useEffect(() => {
    // Remove previously injected floating widget artifacts from older integrations.
    document.querySelectorAll('#gt_float_wrapper, .gt_float_switcher, .gt_switcher_wrapper').forEach((node) => {
      node.remove();
    });

    document.querySelectorAll('script[data-gtranslate-widget="true"], script[src*="cdn.gtranslate.net/widgets/latest/"]').forEach((node) => {
      node.remove();
    });

    document.querySelectorAll('style.gtranslate_css').forEach((node) => {
      node.remove();
    });

    window.gtranslateSettings = {
      default_language: 'en',
      detect_browser_language: true,
      languages: INDIAN_LANGUAGE_CODES,
      wrapper_selector: '.gtranslate_wrapper',
      horizontal_position: 'inline',
      select_language_label: 'Choose language'
    };

    preserveMaterialIcons();
    sanitizeLanguageDropdown();

    const observer = new MutationObserver(() => {
      preserveMaterialIcons();
      sanitizeLanguageDropdown();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const script = document.createElement('script');
    script.src = 'https://cdn.gtranslate.net/widgets/latest/dropdown.js';
    script.defer = true;
    script.setAttribute('data-gtranslate-widget', 'true');
    document.body.appendChild(script);

    return () => observer.disconnect();
  }, []);

  return (
    <section className={variant === 'inline' ? 'translation-service-inline' : 'translation-service-dock'} aria-label="Language translation">
      <div className="gtranslate_wrapper" />
    </section>
  );
}

export default TranslationService;
