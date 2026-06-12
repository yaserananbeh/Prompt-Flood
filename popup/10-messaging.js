// @module popup/10-messaging.js — see AGENTS.md
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureActiveTab() {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url) {
    activeTabId = null;
    return null;
  }

  activeTabId = tab.id;
  return tab;
}

async function ensureManagedTab() {
  if (managedTabId) {
    try {
      const tab = await chrome.tabs.get(managedTabId);
      if (tab?.id && isSupportedChatUrl(tab.url)) {
        activeTabId = managedTabId;
        return tab;
      }
    } catch (_error) {
      managedTabId = null;
    }
  }

  const tab = await ensureActiveTab();
  if (tab?.id && isSupportedChatUrl(tab.url)) {
    managedTabId = tab.id;
    return tab;
  }

  return null;
}

async function ensureContentScript(tabId) {
  if (!tabId) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["platforms.js", "content.js"]
    });
  } catch (_error) {
    // Script may already be injected.
  }
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: "relay_to_tab", tabId, payload: message },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            connected: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        resolve(
          response || { ok: false, connected: false, error: "No response from extension." }
        );
      }
    );
  });
}

async function sendQueueAction(action, payload = {}) {
  const { tabId: routeTabId, ...contentPayload } = payload;
  const targetTabId = routeTabId ?? queueViewTabId ?? managedTabId;
  let tab = null;

  if (targetTabId) {
    try {
      tab = await chrome.tabs.get(targetTabId);
    } catch (_error) {
      tab = null;
    }
  }

  if (!tab?.id) {
    tab = await ensureManagedTab();
  }

  if (!tab?.id || !tab.url || !isSupportedChatUrl(tab.url)) {
    setConnectionStatus("disconnected");
    setStatus("Open a supported chat tab first!", "red");
    return { ok: false, error: "Not connected." };
  }

  let response = await sendMessageToTab(tab.id, { action, ...contentPayload });

  if (!isActionSuccess(response)) {
    setStatus(response?.error || "Action failed.", "red");
    if (response?.error?.includes("Connection failed")) {
      setConnectionStatus("disconnected");
    }
    return response || { ok: false, error: "Action failed." };
  }

  const linked = linkedTabsCache.find((entry) => entry.tabId === tab.id);
  if (linked) {
    linked.state = response;
  }

  lastQueueStateSignature = "";
  latestState = tab.id === managedTabId ? response : latestState;
  applyQueueDisplay();
  lastQueueStateSignature = getAllQueuesStateSignature(linkedTabsCache);
  lastLinkedTabsSignature = "";
  renderConnectionBar(linkedTabsCache, ignoredTabsCache);
  lastLinkedTabsSignature = getLinkedTabsSignature(
    linkedTabsCache,
    ignoredTabsCache,
    managedTabId,
    linkedTabsExpanded
  );

  if (response.error) {
    setStatus(response.error, "red");
  } else {
    setStatus("", "");
  }

  return response;
}

async function removeQueueItem(index, text, tabId) {
  const confirmed = await showConfirmDialog({
    title: "Remove from queue",
    message: `Remove "${truncate(text, 40)}" from the queue?`,
    confirmLabel: "Remove"
  });
  if (!confirmed) return;
  await sendQueueAction("remove_from_queue", { index, tabId });
}

async function editQueueItem(index, currentPrompt, tabId) {
  const updated = await showEditPromptDialog(index, currentPrompt);
  if (updated === null) return;
  await sendQueueAction("edit_queue_item", { index, prompt: updated, tabId });
}

function runtimeMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || { ok: false, error: "No response from background." });
    });
  });
}

async function loadPersonas() {
  const response = await runtimeMessage({ action: "get_personas" });
  if (response.ok) {
    personas = response.personas || [];
    renderPersonaOptions();
  }
}

function switchTab(tabName) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  queueChrome.classList.toggle("hidden", tabName !== "queue");
  queuePanel.classList.toggle("hidden", tabName !== "queue");
  settingsPanel.classList.toggle("hidden", tabName !== "settings");

  if (tabName === "settings") {
    applySettingsToForm();
    renderPersonaList();
  }
}
