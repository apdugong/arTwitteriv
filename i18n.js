(function () {
  const DEFAULT_LANGUAGE = 'en';
  const SUPPORTED_LOCALES = new Set(['en', 'ja']);
  let messages = {};
  let currentLocale = DEFAULT_LANGUAGE;
  let currentLanguage = DEFAULT_LANGUAGE;

  function hasChromeRuntime() {
    return typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function';
  }

  function hasChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;
  }

  function browserLocale() {
    const language = typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage ? chrome.i18n.getUILanguage() : navigator.language;
    return String(language || '').toLowerCase().startsWith('ja') ? 'ja' : 'en';
  }

  function localeForLanguage(language) {
    if (SUPPORTED_LOCALES.has(language)) return language;
    if (language === 'auto') return browserLocale();
    return DEFAULT_LANGUAGE;
  }

  async function storedLanguage() {
    if (!hasChromeStorage()) return DEFAULT_LANGUAGE;
    const values = await chrome.storage.sync.get({ uiLanguage: DEFAULT_LANGUAGE }).catch(() => ({ uiLanguage: DEFAULT_LANGUAGE }));
    return values.uiLanguage || DEFAULT_LANGUAGE;
  }

  async function loadMessages(locale) {
    if (!hasChromeRuntime()) return {};
    const response = await fetch(chrome.runtime.getURL(`_locales/${locale}/messages.json`));
    return response.ok ? response.json() : {};
  }

  function interpolate(record, substitutions) {
    const values = Array.isArray(substitutions) ? substitutions.map(String) : substitutions == null ? [] : [String(substitutions)];
    let output = record?.message || '';
    Object.entries(record?.placeholders || {}).forEach(([name, placeholder]) => {
      const match = /^\$(\d+)$/.exec(placeholder.content || '');
      const value = match ? values[Number(match[1]) - 1] || '' : placeholder.content || '';
      output = output.replaceAll(`$${name}$`, value);
    });
    values.forEach((value, index) => {
      output = output.replaceAll(`$${index + 1}`, value);
    });
    return output;
  }

  function message(key, substitutions) {
    return interpolate(messages[key], substitutions);
  }

  function i18n(key, substitutions) {
    return message(key, substitutions) || key;
  }

  function i18nLocale() {
    return currentLocale;
  }

  function i18nLanguage() {
    return currentLanguage;
  }

  function applyI18n(root = document) {
    document.documentElement.lang = currentLocale;
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

  async function initI18n(language) {
    currentLanguage = language || await storedLanguage();
    currentLocale = localeForLanguage(currentLanguage);
    messages = await loadMessages(currentLocale);
    applyI18n();
    return currentLocale;
  }

  globalThis.i18n = i18n;
  globalThis.i18nLocale = i18nLocale;
  globalThis.i18nLanguage = i18nLanguage;
  globalThis.applyI18n = applyI18n;
  globalThis.initI18n = initI18n;
  globalThis.i18nReady = initI18n();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => globalThis.i18nReady.then(() => applyI18n()));
  else globalThis.i18nReady.then(() => applyI18n());
})();
