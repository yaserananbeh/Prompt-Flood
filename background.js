chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "get_tab_id") {
    sendResponse({ tabId: sender.tab?.id ?? null });
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`queueState_${tabId}`);
});
