importScripts('presets.js');

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(DEFAULT_SETTINGS).catch(() => ({}));
  if (!current.fields) await chrome.storage.sync.set(DEFAULT_SETTINGS);
});
