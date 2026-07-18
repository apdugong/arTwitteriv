document.querySelector('#openFeed').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('feed.html') });
});
document.querySelector('#openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
