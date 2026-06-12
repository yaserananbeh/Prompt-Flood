// @module popup/07-connection.js — see AGENTS.md
function normalizeSendTargetTabIds() {
  const validIds = new Set(linkedTabsCache.map((entry) => entry.tabId));
  sendTargetTabIds = new Set([...sendTargetTabIds].filter((tabId) => validIds.has(tabId)));

  if (sendTargetTabIds.size === 0 && managedTabId && validIds.has(managedTabId)) {
    sendTargetTabIds.add(managedTabId);
  }

  if (!lastSendTargetTabId || !validIds.has(lastSendTargetTabId)) {
    lastSendTargetTabId = managedTabId || [...sendTargetTabIds][0] || null;
  }
}

function getSelectedTargetTabIds() {
  normalizeSendTargetTabIds();
  return [...sendTargetTabIds];
}

function getEffectiveTargetTabIds() {
  if (linkedTabsCache.length === 1 && managedTabId) {
    return [managedTabId];
  }
  return getSelectedTargetTabIds();
}

function toggleSendTarget(tabId) {
  normalizeSendTargetTabIds();

  if (sendTargetTabIds.has(tabId)) {
    if (sendTargetTabIds.size <= 1) return;
    sendTargetTabIds.delete(tabId);
  } else {
    sendTargetTabIds.add(tabId);
  }

  markSendTargetInteraction(tabId);
  updateConnectionSummary();
  updateControls();
  renderConnectionTabPicker(linkedTabsCache);
}

function updateConnectionSummary() {
  const selectedIds = getEffectiveTargetTabIds();
  const managed = linkedTabsCache.find((entry) => entry.tabId === managedTabId);

  connectionBox?.classList.toggle("multi-target-mode", selectedIds.length > 1);

  if (selectedIds.length === 0) {
    connectionText.innerText = "No chats selected";
    connectionText.title = "Check at least one chat below.";
    connectionTargetIcon.classList.add("hidden");
    return;
  }

  if (selectedIds.length === 1) {
    const entry =
      linkedTabsCache.find((item) => item.tabId === selectedIds[0]) || managed;
    const site = entry?.state?.site || getSiteFromUrl(entry?.url);
    const chatId = entry?.state?.chatId ?? getChatIdFromUrl(entry?.url);
    connectionText.innerText = formatConnectionLabel(site);
    connectionText.title = chatId
      ? `Chat ID: ${chatId}. Prompts you add go to this tab.`
      : "Prompts you add from this panel go to this chat tab.";
    updateConnectionTargetIcon(entry?.url);
    updateGoToTabButtons();
    return;
  }

  connectionText.innerText = `${selectedIds.length} chats selected`;
  connectionText.title = "Prompts will be sent to all highlighted chips.";
  connectionTargetIcon.classList.add("hidden");
  updateGoToTabButtons();
}

function getTotalQueueLength(linked = linkedTabsCache) {
  return linked.reduce((sum, entry) => sum + (entry.state?.queueLength || 0), 0);
}

function collectQueueEntries(linked = linkedTabsCache, filterTabId = queueViewTabId) {
  const entries = [];

  linked.forEach((entry) => {
    if (filterTabId && entry.tabId !== filterTabId) return;
    const state = entry.state;
    if (!state?.queue?.length) return;

    const site = state.site || getSiteFromUrl(entry.url);
    state.queue.forEach((item, index) => {
      entries.push({ tabId: entry.tabId, index, item, state, site });
    });
  });

  return entries;
}

function getQueueStatusState() {
  if (queueViewTabId) {
    return linkedTabsCache.find((entry) => entry.tabId === queueViewTabId)?.state || null;
  }

  const connectedStates = linkedTabsCache
    .map((entry) => entry.state)
    .filter((state) => state?.connected);

  if (!connectedStates.length) return latestState;

  const errorEntry = linkedTabsCache.find((entry) => entry.state?.lastError);
  if (errorEntry) {
    const site = errorEntry.state.site || getSiteFromUrl(errorEntry.url);
    return {
      ...errorEntry.state,
      lastError: `[${site}] ${errorEntry.state.lastError}`,
      _controlTabId: errorEntry.tabId
    };
  }

  const checkpointEntry = linkedTabsCache.find(
    (entry) => entry.state?.pauseReason === "checkpoint" && entry.state?.queueLength > 0
  );
  if (checkpointEntry) {
    return { ...checkpointEntry.state, _controlTabId: checkpointEntry.tabId };
  }

  const pausedEntry = linkedTabsCache.find(
    (entry) => entry.state?.isPaused && entry.state?.queueLength > 0
  );
  if (pausedEntry) {
    return { ...pausedEntry.state, _controlTabId: pausedEntry.tabId };
  }

  const processingEntry = linkedTabsCache.find((entry) => entry.state?.isProcessing);
  if (processingEntry) {
    return { ...processingEntry.state, _controlTabId: processingEntry.tabId };
  }

  const totalQueueLength = getTotalQueueLength();
  if (totalQueueLength > 0) {
    const chatCount = linkedTabsCache.filter((entry) => entry.state?.queueLength > 0).length;
    return {
      connected: true,
      queueLength: totalQueueLength,
      version: CONTENT_VERSION,
      _aggregateMessage: `${totalQueueLength} prompt${totalQueueLength === 1 ? "" : "s"} waiting across ${chatCount} chat${chatCount === 1 ? "" : "s"}.`
    };
  }

  return latestState;
}

function getControlsState() {
  if (queueViewTabId) {
    return linkedTabsCache.find((entry) => entry.tabId === queueViewTabId)?.state ?? latestState;
  }
  return latestState;
}

function renderQueueViewPicker(linked) {
  if (!queueViewPicker || !queueViewRow) return;

  if (linked.length <= 1) {
    queueViewRow.classList.add("hidden");
    return;
  }

  queueViewRow.classList.remove("hidden");
  queueViewPicker.innerHTML = "";

  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = "queue-view-chip";
  allChip.setAttribute("role", "tab");
  allChip.setAttribute("aria-selected", queueViewTabId === null ? "true" : "false");
  if (queueViewTabId === null) allChip.classList.add("active");

  const allLabel = document.createElement("span");
  const totalCount = getTotalQueueLength(linked);
  allLabel.innerText = totalCount > 0 ? `All (${totalCount})` : "All";
  allChip.appendChild(allLabel);
  allChip.title = "Show queues from every connected chat";
  allChip.addEventListener("click", () => selectQueueViewFilter(null));
  queueViewPicker.appendChild(allChip);

  linked.forEach((entry) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "queue-view-chip";
    chip.setAttribute("role", "tab");
    chip.setAttribute(
      "aria-selected",
      entry.tabId === queueViewTabId ? "true" : "false"
    );

    if (entry.tabId === queueViewTabId) {
      chip.classList.add("active");
    }

    const llm = getLlmForUrl(entry.url);
    if (llm) {
      const icon = document.createElement("img");
      icon.src = getLlmFaviconUrl(llm.host);
      icon.alt = "";
      icon.setAttribute("aria-hidden", "true");
      chip.appendChild(icon);
    }

    const label = document.createElement("span");
    const site = entry.state?.site || getSiteFromUrl(entry.url);
    const count = entry.state?.queueLength || 0;
    label.innerText = count > 0 ? `${site} (${count})` : site;
    chip.appendChild(label);

    chip.title = truncate(entry.title || "Untitled", 60);
    chip.addEventListener("click", () => selectQueueViewFilter(entry.tabId));
    queueViewPicker.appendChild(chip);
  });

  updateGoToTabButtons();
}

function renderConnectionTabPicker(linked) {
  connectionTabPicker.innerHTML = "";

  if (linked.length <= 1) {
    connectionTabPicker.classList.add("hidden");
    connectionTargetHint.classList.add("hidden");
    connectionChipLabel?.classList.add("hidden");
    return;
  }

  connectionTabPicker.classList.remove("hidden");
  connectionTargetHint.classList.remove("hidden");
  connectionChipLabel?.classList.remove("hidden");
  normalizeSendTargetTabIds();

  linked.forEach((entry) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "connection-tab-chip";
    chip.setAttribute("role", "checkbox");
    chip.setAttribute(
      "aria-checked",
      sendTargetTabIds.has(entry.tabId) ? "true" : "false"
    );

    if (sendTargetTabIds.has(entry.tabId)) chip.classList.add("target");

    const llm = getLlmForUrl(entry.url);
    if (llm) {
      const icon = document.createElement("img");
      icon.src = getLlmFaviconUrl(llm.host);
      icon.alt = "";
      icon.setAttribute("aria-hidden", "true");
      chip.appendChild(icon);
    }

    const label = document.createElement("span");
    label.innerText = entry.state?.site || getSiteFromUrl(entry.url);
    chip.appendChild(label);

    if (sendTargetTabIds.has(entry.tabId)) {
      const check = document.createElement("span");
      check.className = "connection-tab-chip-check";
      check.setAttribute("aria-hidden", "true");
      check.innerText = "✓";
      chip.appendChild(check);
    }

    chip.title = `${truncate(entry.title || "Untitled", 40)} — Click to send here. Ctrl+click to add more. Right-click to hide.`;

    chip.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      ignoreTab(entry.tabId);
    });

    chip.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        toggleSendTarget(entry.tabId);
        return;
      }

      sendTargetTabIds = new Set([entry.tabId]);
      markSendTargetInteraction(entry.tabId);
      updateConnectionSummary();
      updateControls();
      renderConnectionTabPicker(linkedTabsCache);
    });

    connectionTabPicker.appendChild(chip);
  });
}

async function broadcastToSelectedTabs(payload) {
  const tabIds = getEffectiveTargetTabIds();

  if (tabIds.length === 0) {
    setStatus("Select at least one chat below.", "error");
    return null;
  }

  for (const tabId of tabIds) {
    await ensureContentScript(tabId);
  }

  const response = await runtimeMessage({
    action: "broadcast_prompt",
    payload,
    tabIds
  });

  if (!response?.ok) {
    setStatus(response?.error || "Could not send to selected chats.", "error");
    return null;
  }

  return {
    successCount: response.successCount ?? 0,
    total: response.total ?? tabIds.length
  };
}

async function addPromptToSingleTab(tabId, payload) {
  await ensureContentScript(tabId);
  const response = await sendMessageToTab(tabId, { action: "add_to_queue", ...payload });

  if (!isActionSuccess(response)) {
    setStatus(response?.error || "Could not add to queue.", "error");
    if (response?.error?.includes("Connection failed") && tabId === managedTabId) {
      setConnectionStatus("disconnected");
    }
    return null;
  }

  return response;
}

async function addPromptToTargets(payload) {
  const tabIds = getEffectiveTargetTabIds();

  if (tabIds.length === 0) {
    setStatus("Select at least one chat below.", "error");
    return null;
  }

  if (tabIds.length > 1) {
    return broadcastToSelectedTabs(payload);
  }

  return addPromptToSingleTab(tabIds[0], payload);
}

function truncate(text, max = 80) {
  return text.length > max ? `${text.substring(0, max)}...` : text;
}

function getLlmForUrl(url) {
  if (!url) return null;
  return SUPPORTED_LLMS.find((llm) => url.includes(llm.host)) || null;
}

function formatConnectionLabel(site) {
  return site || "Chat";
}

function updateConnectionTargetIcon(url) {
  const llm = getLlmForUrl(url);
  if (!llm) {
    connectionTargetIcon.classList.add("hidden");
    connectionTargetIcon.removeAttribute("src");
    return;
  }

  connectionTargetIcon.src = getLlmFaviconUrl(llm.host);
  connectionTargetIcon.classList.remove("hidden");
}

function renderConnectionBar(linked, ignoredEntries = ignoredTabsCache) {
  const managed = linked.find((entry) => entry.tabId === managedTabId);
  const ignoredCount = ignoredEntries.length;

  if (!managed) {
    tabsToggle.classList.add("hidden");
    linkedTabsPanel.classList.add("hidden");
    connectionTabPicker.classList.add("hidden");
    connectionTargetHint.classList.add("hidden");
    connectionChipLabel?.classList.add("hidden");
    queueViewRow?.classList.add("hidden");
    connectionTargetIcon.classList.add("hidden");
    return;
  }

  setConnectionStatus("connected", {
    site: managed.state.site,
    chatId: managed.state.chatId ?? null,
    url: managed.url
  });

  renderConnectionTabPicker(linked);
  renderQueueViewPicker(linked);
  updateConnectionSummary();
  updateGoToTabButtons();

  if (ignoredCount > 0) {
    tabsToggle.classList.remove("hidden");
    tabsToggle.innerText = linkedTabsExpanded
      ? `Ignored (${ignoredCount}) ▴`
      : `Ignored (${ignoredCount}) ▾`;
  } else {
    tabsToggle.classList.add("hidden");
    linkedTabsPanel.classList.add("hidden");
    linkedTabsExpanded = false;
  }

  linkedTabsPanel.innerHTML = "";

  if (!linkedTabsExpanded || ignoredCount === 0) {
    linkedTabsPanel.classList.add("hidden");
    return;
  }

  linkedTabsPanel.classList.remove("hidden");

  const heading = document.createElement("div");
  heading.className = "linked-tabs-heading";
  heading.innerText = "Ignored tabs";
  linkedTabsPanel.appendChild(heading);

  ignoredEntries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "linked-tab-row ignored";

    const label = document.createElement("span");
    label.className = "ignored-tab-label";
    const site = getSiteFromUrl(entry.url);
    label.innerText = `${truncate(entry.title || "Untitled", 28)} | ${site}`;

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "restore-tab";
    restoreBtn.innerText = "Restore";
    restoreBtn.title = "Manage this tab again";
    restoreBtn.addEventListener("click", () => restoreTab(entry.tabId));

    row.appendChild(label);
    row.appendChild(
      createGoToTabButton(entry.tabId, {
        compact: true,
        title: `Go to ${truncate(entry.title || "tab", 40)}`
      })
    );
    row.appendChild(restoreBtn);
    linkedTabsPanel.appendChild(row);
  });
}

function getQueueStateSignature(state) {
  if (!state) return "";
  return JSON.stringify({
    connected: state.connected,
    site: state.site,
    chatId: state.chatId,
    version: state.version,
    queueLength: state.queueLength,
    isPaused: state.isPaused,
    isProcessing: state.isProcessing,
    pauseReason: state.pauseReason,
    lastError: state.lastError,
    queue: state.queue
  });
}

function getAllQueuesStateSignature(linked) {
  return JSON.stringify(
    linked.map((entry) => ({
      tabId: entry.tabId,
      sig: getQueueStateSignature(entry.state)
    }))
  );
}

function getLinkedTabsSignature(linked, ignored, managedTabId, expanded, queueView = queueViewTabId) {
  return JSON.stringify({
    managedTabId,
    queueViewTabId: queueView,
    expanded,
    linked: linked.map((entry) => ({
      tabId: entry.tabId,
      title: entry.title,
      isActive: entry.isActive,
      chatId: entry.state?.chatId,
      site: entry.state?.site
    })),
    ignored: ignored.map((entry) => ({
      tabId: entry.tabId,
      title: entry.title
    }))
  });
}

function isSupportedChatUrl(url) {
  return Boolean(url && SUPPORTED_HOSTS.some((host) => url.includes(host)));
}

function isActionSuccess(response) {
  if (!response) return false;
  if (response.ok === false) return false;
  if (response.ok === true) return true;
  if (response.error) return false;
  return response.connected === true || Number.isInteger(response.queueLength);
}

function isStaleContentScript(response) {
  return !response?.version || response.version < CONTENT_VERSION;
}

function canUseQueueControls(state = latestState) {
  return Boolean(isConnected && state && !isStaleContentScript(state));
}

async function getIgnoredTabIds() {
  const data = await chrome.storage.local.get(IGNORED_TABS_KEY);
  return new Set(
    Array.isArray(data[IGNORED_TABS_KEY]) ? data[IGNORED_TABS_KEY] : []
  );
}

async function getIgnoredTabEntries() {
  const ignored = await getIgnoredTabIds();
  if (ignored.size === 0) return [];

  const tabs = await chrome.tabs.query({});
  return tabs
    .filter((tab) => tab.id && ignored.has(tab.id) && isSupportedChatUrl(tab.url))
    .map((tab) => ({
      tabId: tab.id,
      title: tab.title,
      url: tab.url
    }));
}

async function ignoreTab(tabId) {
  const ignored = await getIgnoredTabIds();
  ignored.add(tabId);
  await chrome.storage.local.set({ [IGNORED_TABS_KEY]: [...ignored] });

  if (managedTabId === tabId) {
    managedTabId = null;
  }
  if (queueViewTabId === tabId) {
    queueViewTabId = null;
  }

  lastLinkedTabsSignature = "";
  await refreshLinkedTabs();
}

async function restoreTab(tabId) {
  const ignored = await getIgnoredTabIds();
  ignored.delete(tabId);
  await chrome.storage.local.set({ [IGNORED_TABS_KEY]: [...ignored] });
  lastLinkedTabsSignature = "";
  await refreshLinkedTabs();
}

function selectQueueViewFilter(tabId) {
  queueViewTabId = tabId;
  renderQueueViewPicker(linkedTabsCache);
  applyQueueDisplay();
  updateGoToTabButtons();
}

async function pingTab(tabId) {
  const response = await sendMessageToTab(tabId, { action: "ping_connection" });
  return response?.connected ? response : null;
}

async function refreshLinkedTabs({ showChecking = false } = {}) {
  if (showChecking) {
    setConnectionStatus("checking");
    reconnectBtn.classList.add("hidden");
  }

  const ignored = await getIgnoredTabIds();
  ignoredTabsCache = await getIgnoredTabEntries();
  const tabs = await chrome.tabs.query({});
  const activeTab = await getActiveTab();
  const eligible = tabs.filter(
    (tab) => tab.id && isSupportedChatUrl(tab.url) && !ignored.has(tab.id)
  );

  const linked = [];

  const tryTab = async (tab, isActive) => {
    const state = await pingTab(tab.id);
    if (!state) return null;

    const entry = {
      tabId: tab.id,
      title: tab.title,
      url: tab.url,
      state,
      isActive
    };
    linked.push(entry);
    return entry;
  };

  for (const tab of eligible) {
    await tryTab(tab, tab.id === activeTab?.id);
  }

  let managed = linked.find((entry) => entry.tabId === managedTabId);

  if (!managed && managedTabId) {
    const remembered = eligible.find((tab) => tab.id === managedTabId);
    if (remembered) {
      managed = await tryTab(remembered, remembered.id === activeTab?.id);
    }
  }

  if (!managed) {
    const checkpointEntry = linked.find((entry) => entry.state.pauseReason === "checkpoint");
    const activeEntry = linked.find((entry) => entry.isActive);
    managed = checkpointEntry || activeEntry || linked[0] || null;
    if (managed) {
      managedTabId = managed.tabId;
    }
  }

  linkedTabsCache = linked;
  normalizeSendTargetTabIds();

  if (queueViewTabId && !linked.some((entry) => entry.tabId === queueViewTabId)) {
    queueViewTabId = null;
  }

  if (!managed) {
    const allSupportedCount = tabs.filter(
      (tab) => tab.id && isSupportedChatUrl(tab.url)
    ).length;

    lastQueueStateSignature = "";
    lastLinkedTabsSignature = "";
    setConnectionStatus("disconnected");

    if (allSupportedCount > 0 && ignored.size >= allSupportedCount) {
      connectionText.innerHTML =
        'All tabs ignored. <button type="button" class="link-btn" id="resetIgnoredBtn">Reset all</button>';
      document.getElementById("resetIgnoredBtn")?.addEventListener("click", async () => {
        await chrome.storage.local.remove(IGNORED_TABS_KEY);
        lastLinkedTabsSignature = "";
        await refreshLinkedTabs({ showChecking: true });
      });
    } else if (allSupportedCount > 0) {
      connectionText.innerText = "Can't reach chat tab.";
      reconnectBtn.classList.remove("hidden");
    } else {
      connectionText.innerText = "No chat tabs open — pick one below";
    }

    updateLlmLauncher(allSupportedCount);
    latestState = null;
    applyQueueDisplay();
    return;
  }

  activeTabId = managedTabId;
  reconnectBtn.classList.add("hidden");

  const linkedSignature = getLinkedTabsSignature(
    linked,
    ignoredTabsCache,
    managedTabId,
    linkedTabsExpanded
  );
  if (linkedSignature !== lastLinkedTabsSignature) {
    lastLinkedTabsSignature = linkedSignature;
    renderConnectionBar(linked, ignoredTabsCache);
  } else {
    setConnectionStatus("connected", {
      site: managed.state.site,
      chatId: managed.state.chatId ?? null,
      url: managed.url
    });
    updateConnectionSummary();
  }

  latestState = managed.state;
  const stateSignature = getAllQueuesStateSignature(linked);
  if (stateSignature !== lastQueueStateSignature) {
    lastQueueStateSignature = stateSignature;
    applyQueueDisplay();
  } else {
    updateControls();
  }

  const supportedTabCount = tabs.filter(
    (tab) => tab.id && isSupportedChatUrl(tab.url)
  ).length;
  updateLlmLauncher(supportedTabCount);
}
