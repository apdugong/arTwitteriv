(function () {
  function hasChromeI18n() {
    return typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function';
  }

  function message(key, substitutions) {
    if (!hasChromeI18n()) return '';
    const values = Array.isArray(substitutions) ? substitutions.map(String) : substitutions == null ? undefined : String(substitutions);
    return (values === undefined ? chrome.i18n.getMessage(key) : chrome.i18n.getMessage(key, values)) || '';
  }

  function i18n(key, substitutions) {
    return message(key, substitutions) || key;
  }

  function i18nLocale() {
    return hasChromeI18n() && chrome.i18n.getUILanguage ? chrome.i18n.getUILanguage() : 'en';
  }

  function applyI18n(root = document) {
    document.documentElement.lang = i18nLocale().toLowerCase().startsWith('ja') ? 'ja' : 'en';
    root.querySelectorAll('[data-i18n]').forEach(element => {
      const value = message(element.dataset.i18n);
      if (value) element.textContent = value;
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const value = message(element.dataset.i18nPlaceholder);
      if (value) element.setAttribute('placeholder', value);
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
      const value = message(element.dataset.i18nAriaLabel);
      if (value) element.setAttribute('aria-label', value);
    });
    root.querySelectorAll('[data-i18n-title]').forEach(element => {
      const value = message(element.dataset.i18nTitle);
      if (value) element.setAttribute('title', value);
    });
  }

  globalThis.i18n = i18n;
  globalThis.i18nLocale = i18nLocale;
  globalThis.applyI18n = applyI18n;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => applyI18n());
  else applyI18n();
})();
