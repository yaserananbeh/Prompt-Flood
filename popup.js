const CONTENT_VERSION = 9;
const SUPPORTED_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "gemini.google.com",
  "claude.ai",
  "kimi.com",
  "chat.deepseek.com",
  "doubao.com",
  "perplexity.ai"
];
const IGNORED_TABS_KEY = "ignoredTabIds";

const queueBtn = document.getElementById("queueBtn");
const promptText = document.getElementById("promptText");
const statusDiv = document.getElementById("status");
const connectionDot = document.getElementById("connectionDot");
const connectionText = document.getElementById("connectionText");
const tabsToggle = document.getElementById("tabsToggle");
const reconnectBtn = document.getElementById("reconnectBtn");
const linkedTabsPanel = document.getElementById("linkedTabsPanel");
const queueList = document.getElementById("queueList");
const queueStatus = document.getElementById("queueStatus");
const pauseBtn = document.getElementById("pauseBtn");
const retryBtn = document.getElementById("retryBtn");
const clearBtn = document.getElementById("clearBtn");
const personaSelect = document.getElementById("personaSelect");
const managePersonaBtn = document.getElementById("managePersonaBtn");
const personaPanel = document.getElementById("personaPanel");
const personaList = document.getElementById("personaList");
const addPersonaBtn = document.getElementById("addPersonaBtn");
const pauseHereAdd = document.getElementById("pauseHereAdd");
const broadcastToggle = document.getElementById("broadcastToggle");
const broadcastPanel = document.getElementById("broadcastPanel");
const broadcastTabList = document.getElementById("broadcastTabList");
const broadcastSelectAll = document.getElementById("broadcastSelectAll");
const broadcastSelectNone = document.getElementById("broadcastSelectNone");
const queuePanel = document.getElementById("queuePanel");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");
const tabButtons = document.querySelectorAll(".tab-btn");

let activeTabId = null;
let managedTabId = null;
let isConnected = false;
let latestState = null;
let personas = [];
let pollTimer = null;
let linkedTabsCache = [];
let linkedTabsExpanded = false;
let ignoredTabsCache = [];
let lastQueueStateSignature = "";
let lastLinkedTabsSignature = "";

function setStatus(message, color = "") {
  statusDiv.innerText = message;
  statusDiv.style.color = color;
}

function getSiteFromUrl(url) {
  if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) return "ChatGPT";
  if (url.includes("gemini.google.com")) return "Gemini";
  if (url.includes("claude.ai")) return "Claude";
  if (url.includes("kimi.com")) return "Kimi";
  if (url.includes("chat.deepseek.com")) return "DeepSeek";
  if (url.includes("doubao.com")) return "Doubao";
  if (url.includes("perplexity.ai")) return "Perplexity";
  return "Unknown";
}

function getChatIdFromUrl(url) {
  try {
    const { pathname } = new URL(url);

    if (url.includes("chatgpt.com")) {
      const match = pathname.match(/\/c\/([a-f0-9-]+)/i);
      return match ? match[1] : null;
    }

    if (url.includes("gemini.google.com")) {
      const match = pathname.match(/\/app\/([^/?#]+)/i);
      return match ? match[1] : null;
    }

    if (url.includes("claude.ai")) {
      const match = pathname.match(/\/chat\/([a-f0-9-]+)/i);
      return match ? match[1] : null;
    }

    if (url.includes("kimi.com")) {
      const match = pathname.match(/\/chat\/([a-z0-9-]+)/i);
      return match ? match[1] : null;
    }

    if (url.includes("chat.deepseek.com")) {
      const match = pathname.match(/\/a\/chat\/s\/([a-z0-9-]+)/i);
      return match ? match[1] : null;
    }

    if (url.includes("doubao.com")) {
      const match = pathname.match(/(?:\/code)?\/chat\/([^/?#]+)/i);
      return match ? match[1] : null;
    }

    if (url.includes("perplexity.ai")) {
      const searchMatch = pathname.match(/\/search\/([^/?#]+)/i);
      if (searchMatch) return searchMatch[1];

      const pageMatch = pathname.match(/\/p\/([^/?#]+)/i);
      return pageMatch ? pageMatch[1] : null;
    }
  } catch (_error) {
    return null;
  }

  return null;
}

function getSelectedBroadcastTabIds() {
  return Array.from(
    broadcastTabList.querySelectorAll("input[data-broadcast-tab]:checked")
  )
    .map((input) => Number(input.dataset.broadcastTab))
    .filter((tabId) => Number.isInteger(tabId) && tabId > 0);
}

async function loadBroadcastTabs() {
  const previouslySelected = new Set(getSelectedBroadcastTabIds());
  const ignored = await getIgnoredTabIds();
  const tabs = await chrome.tabs.query({});
  const supported = tabs.filter(
    (tab) => isSupportedChatUrl(tab.url) && tab.id && !ignored.has(tab.id)
  );
  const activeTab = await getActiveTab();

  broadcastTabList.innerHTML = "";

  if (supported.length === 0) {
    const empty = document.createElement("li");
    empty.className = "broadcast-empty";
    empty.innerText = "No supported tabs open";
    broadcastTabList.appendChild(empty);
    return;
  }

  supported.forEach((tab) => {
    const li = document.createElement("li");
    li.className = "broadcast-tab-item";

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.broadcastTab = String(tab.id);
    checkbox.checked =
      previouslySelected.size > 0
        ? previouslySelected.has(tab.id)
        : tab.id === activeTab?.id;

    const textWrap = document.createElement("span");
    const site = getSiteFromUrl(tab.url);
    const chatId = getChatIdFromUrl(tab.url);
    const isActive = tab.id === activeTab?.id;

    const title = document.createElement("span");
    title.className = "broadcast-tab-title";
    title.innerText = truncate(tab.title || "Untitled tab", 50);

    const meta = document.createElement("span");
    meta.className = "broadcast-tab-meta";
    const metaParts = [site];
    if (chatId) metaParts.push(truncate(chatId, 24));
    if (isActive) metaParts.push("active");
    meta.innerText = metaParts.join(" | ");

    textWrap.appendChild(title);
    textWrap.appendChild(document.createElement("br"));
    textWrap.appendChild(meta);

    label.appendChild(checkbox);
    label.appendChild(textWrap);
    li.appendChild(label);
    broadcastTabList.appendChild(li);
  });
}

async function broadcastToSelectedTabs(payload) {
  const tabIds = getSelectedBroadcastTabIds();

  if (tabIds.length === 0) {
    setStatus("Select at least one tab for broadcast.", "red");
    return null;
  }

  let successCount = 0;

  for (const tabId of tabIds) {
    const response = await sendMessageToTab(tabId, {
      action: "add_to_queue",
      ...payload
    });

    if (isActionSuccess(response)) {
      successCount += 1;
    }
  }

  return { successCount, total: tabIds.length };
}

function setBroadcastPanelVisible(visible) {
  broadcastPanel.classList.toggle("hidden", !visible);

  if (visible) {
    loadBroadcastTabs();
  }
}

function setBroadcastTabSelection(checked) {
  broadcastTabList.querySelectorAll("input[data-broadcast-tab]").forEach((input) => {
    input.checked = checked;
  });
}

function truncate(text, max = 80) {
  return text.length > max ? `${text.substring(0, max)}...` : text;
}

function formatConnectionLabel(site, chatId) {
  if (!chatId) return `Connected to ${site}`;
  return `Connected to ${site} | ${chatId}`;
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

function getLinkedTabsSignature(linked, ignored, managedTabId, expanded) {
  return JSON.stringify({
    managedTabId,
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

async function selectManagedTab(tabId) {
  managedTabId = tabId;
  activeTabId = tabId;
  lastQueueStateSignature = "";
  lastLinkedTabsSignature = "";

  const linked = linkedTabsCache.find((entry) => entry.tabId === tabId);
  if (linked) {
    applyState(linked.state);
    lastQueueStateSignature = getQueueStateSignature(linked.state);
  }

  renderConnectionBar(linkedTabsCache, ignoredTabsCache);
  lastLinkedTabsSignature = getLinkedTabsSignature(
    linkedTabsCache,
    ignoredTabsCache,
    managedTabId,
    linkedTabsExpanded
  );
}

function renderConnectionBar(linked, ignoredEntries = ignoredTabsCache) {
  const managed = linked.find((entry) => entry.tabId === managedTabId);
  const extraCount = Math.max(0, linked.length - 1) + ignoredEntries.length;

  if (!managed) {
    tabsToggle.classList.add("hidden");
    linkedTabsPanel.classList.add("hidden");
    return;
  }

  setConnectionStatus("connected", {
    site: managed.state.site,
    chatId: managed.state.chatId ?? null
  });

  if (extraCount > 0) {
    tabsToggle.classList.remove("hidden");
    tabsToggle.innerText = linkedTabsExpanded
      ? `${extraCount} more ^`
      : `+${extraCount} tab${extraCount === 1 ? "" : "s"} v`;
  } else {
    tabsToggle.classList.add("hidden");
    linkedTabsPanel.classList.add("hidden");
    linkedTabsExpanded = false;
  }

  linkedTabsPanel.innerHTML = "";

  if (!linkedTabsExpanded || extraCount === 0) {
    linkedTabsPanel.classList.add("hidden");
    return;
  }

  linkedTabsPanel.classList.remove("hidden");

  linked.forEach((entry) => {
    if (entry.tabId === managedTabId) return;

    linkedTabsPanel.appendChild(
      createLinkedTabRow(entry, {
        selected: false,
        onSelect: () => selectManagedTab(entry.tabId),
        onIgnore: () => ignoreTab(entry.tabId)
      })
    );
  });

  if (ignoredEntries.length > 0) {
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
      row.appendChild(restoreBtn);
      linkedTabsPanel.appendChild(row);
    });
  }
}

function createLinkedTabRow(entry, { selected, onSelect, onIgnore }) {
  const row = document.createElement("div");
  row.className = "linked-tab-row";
  if (selected) row.classList.add("selected");

  const selectBtn = document.createElement("button");
  selectBtn.type = "button";
  selectBtn.className = "select-tab";
  const site = getSiteFromUrl(entry.url);
  const chatId = getChatIdFromUrl(entry.url);
  const labelParts = [site];
  if (chatId) labelParts.push(truncate(chatId, 16));
  if (entry.isActive) labelParts.push("active");
  selectBtn.innerText = `${truncate(entry.title || "Untitled", 28)} | ${labelParts.join(" | ")}`;
  selectBtn.title = entry.title || "";
  selectBtn.addEventListener("click", onSelect);

  const ignoreBtn = document.createElement("button");
  ignoreBtn.type = "button";
  ignoreBtn.className = "ignore-tab";
  ignoreBtn.innerText = "x";
  ignoreBtn.title = "Stop managing this tab";
  ignoreBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    onIgnore();
  });

  row.appendChild(selectBtn);
  row.appendChild(ignoreBtn);
  return row;
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
      connectionText.innerText = "Open a supported chat tab.";
    }

    latestState = null;
    renderQueue(null);
    renderQueueStatus(null);
    updateControls();
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
      chatId: managed.state.chatId ?? null
    });
  }

  const stateSignature = getQueueStateSignature(managed.state);
  if (stateSignature !== lastQueueStateSignature) {
    lastQueueStateSignature = stateSignature;
    applyState(managed.state);
  } else {
    latestState = managed.state;
    updateControls();
  }
}

function getPersonaName(personaId) {
  if (!personaId) return null;
  return personas.find((persona) => persona.id === personaId)?.name || "Persona";
}

function setConnectionStatus(status, { site = "", chatId = null } = {}) {
  connectionDot.classList.remove("connected", "disconnected", "checking");

  if (status === "connected") {
    connectionDot.classList.add("connected");
    connectionText.innerText = formatConnectionLabel(site, chatId);
    connectionText.title = chatId || "";
    isConnected = true;
  } else if (status === "disconnected") {
    connectionDot.classList.add("disconnected");
    connectionText.innerText = "Not connected to chat";
    connectionText.title = "";
    isConnected = false;
    latestState = null;
    tabsToggle.classList.add("hidden");
    linkedTabsPanel.classList.add("hidden");
    renderQueue(null);
  } else {
    connectionDot.classList.add("checking");
    connectionText.innerText = "Checking connection...";
    connectionText.title = "";
    isConnected = false;
  }

  updateControls();
}

function renderQueueStatus(state) {
  queueStatus.classList.add("hidden");
  queueStatus.innerHTML = "";

  if (!state || !state.connected) return;

  if (state.lastError) {
    queueStatus.classList.remove("hidden");
    queueStatus.className = "queue-status error";
    queueStatus.innerText = state.lastError;
    return;
  }

  if (isStaleContentScript(state)) {
    queueStatus.classList.remove("hidden");
    queueStatus.className = "queue-status paused";
    queueStatus.innerText =
      "Refresh the managed chat tab once to enable controls (F5).";
    return;
  }

  if (state.pauseReason === "checkpoint" && state.queueLength > 0) {
    queueStatus.classList.remove("hidden");
    queueStatus.className = "queue-status checkpoint";

    const text = document.createElement("span");
    text.innerText = "Checkpoint reached. Review the response, then resume.";

    const resumeBtn = document.createElement("button");
    resumeBtn.type = "button";
    resumeBtn.className = "checkpoint-resume-btn";
    resumeBtn.innerText = "Resume";
    resumeBtn.disabled = !canUseQueueControls(state);
    resumeBtn.addEventListener("click", () => sendQueueAction("resume_queue"));

    queueStatus.appendChild(text);
    queueStatus.appendChild(resumeBtn);
    return;
  }

  if (state.isPaused && state.queueLength > 0) {
    queueStatus.classList.remove("hidden");
    queueStatus.className = "queue-status paused";
    queueStatus.innerText = "Queue is paused. Resume to continue sending.";
    return;
  }

  if (state.isProcessing) {
    queueStatus.classList.remove("hidden");
    queueStatus.className = "queue-status";
    queueStatus.innerText = "Sending the first prompt in the queue...";
    return;
  }

  if (state.queueLength > 0) {
    queueStatus.classList.remove("hidden");
    queueStatus.className = "queue-status";
    queueStatus.innerText = `${state.queueLength} prompt${state.queueLength === 1 ? "" : "s"} waiting.`;
  }
}

function formatPersonaPreview(persona) {
  const parts = [];
  if (persona.prefix) parts.push(`Before: ${truncate(persona.prefix, 40)}`);
  if (persona.suffix) parts.push(`After: ${truncate(persona.suffix, 40)}`);
  return parts.length ? parts.join(" | ") : "No prefix or suffix";
}

function renderPersonaOptions() {
  const selectedId = personaSelect.value;
  personaSelect.innerHTML = '<option value="">None</option>';

  personas.forEach((persona) => {
    const option = document.createElement("option");
    option.value = persona.id;
    option.innerText = persona.name;
    personaSelect.appendChild(option);
  });

  if (selectedId && personas.some((persona) => persona.id === selectedId)) {
    personaSelect.value = selectedId;
  }

  renderPersonaList();
}

function renderPersonaList() {
  personaList.innerHTML = "";

  if (!personas.length) {
    const empty = document.createElement("li");
    empty.className = "persona-empty";
    empty.innerText = "No personas yet";
    personaList.appendChild(empty);
    return;
  }

  personas.forEach((persona) => {
    const li = document.createElement("li");
    li.className = "persona-item";

    const body = document.createElement("div");
    body.className = "persona-item-body";

    const name = document.createElement("div");
    name.className = "persona-item-name";
    name.innerText = persona.name;

    const preview = document.createElement("div");
    preview.className = "persona-item-preview";
    preview.innerText = formatPersonaPreview(persona);

    body.appendChild(name);
    body.appendChild(preview);

    const actions = document.createElement("div");
    actions.className = "persona-item-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.innerText = "Edit";
    editBtn.addEventListener("click", () => editPersona(persona));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger";
    deleteBtn.innerText = "Delete";
    deleteBtn.addEventListener("click", () => deletePersona(persona));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(body);
    li.appendChild(actions);
    personaList.appendChild(li);
  });
}

function setPersonaPanelVisible(visible) {
  personaPanel.classList.toggle("hidden", !visible);
}

async function promptForPersonaDetails(persona = null) {
  const name = prompt("Persona name:", persona?.name || "");
  if (!name) return null;

  const prefix =
    prompt(
      "Text to add BEFORE the prompt (optional).\nA blank line is added automatically:",
      persona?.prefix || ""
    ) ?? "";
  const suffix =
    prompt(
      "Text to add AFTER the prompt (optional).\nA blank line is added automatically:",
      persona?.suffix || ""
    ) ?? "";

  return {
    id: persona?.id,
    name,
    prefix,
    suffix
  };
}

async function savePersona(persona) {
  const response = await runtimeMessage({
    action: "save_persona",
    persona
  });

  if (!response.ok) {
    setStatus(response.error || "Could not save persona.", "red");
    return false;
  }

  personas = response.personas || [];
  renderPersonaOptions();
  return true;
}

async function addPersona() {
  const persona = await promptForPersonaDetails();
  if (!persona) return;

  const saved = await savePersona(persona);
  if (saved) {
    setStatus(`Persona "${persona.name}" saved.`, "green");
  }
}

async function editPersona(persona) {
  const updated = await promptForPersonaDetails(persona);
  if (!updated) return;

  const saved = await savePersona({ ...updated, id: persona.id });
  if (saved) {
    setStatus(`Persona "${updated.name}" updated.`, "green");
  }
}

async function deletePersona(persona) {
  const confirmed = confirm(`Delete persona "${persona.name}"?`);
  if (!confirmed) return;

  const response = await runtimeMessage({
    action: "delete_persona",
    personaId: persona.id
  });

  if (!response.ok) {
    setStatus(response.error || "Could not delete persona.", "red");
    return;
  }

  personas = response.personas || [];
  if (personaSelect.value === persona.id) {
    personaSelect.value = "";
  }
  renderPersonaOptions();
  setStatus(`Persona "${persona.name}" deleted.`, "green");
}

function renderQueue(state) {
  queueList.innerHTML = "";

  if (!state?.queue?.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "queue-empty";
    emptyItem.innerText = "Queue is empty";
    queueList.appendChild(emptyItem);
    return;
  }

  state.queue.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "queue-item";

    const isSending = state.isProcessing && index === 0;
    const isNextAtCheckpoint =
      state.pauseReason === "checkpoint" && index === 0 && !state.isProcessing;

    if (isSending || isNextAtCheckpoint) {
      li.classList.add("active");
    }

    const header = document.createElement("div");
    header.className = "queue-item-header";

    const badge = document.createElement("span");
    badge.className = "queue-badge";
    if (isSending) {
      badge.innerText = "Sending";
    } else if (index === 0) {
      badge.classList.add("next");
      badge.innerText = isNextAtCheckpoint ? "Next" : "Next";
    } else {
      badge.classList.add("next");
      badge.innerText = `#${index + 1}`;
    }

    const preview = document.createElement("span");
    preview.className = "queue-preview";
    preview.title = item.text;
    preview.innerText = truncate(item.text);

    header.appendChild(badge);
    header.appendChild(preview);

    const meta = document.createElement("div");
    meta.className = "queue-meta";
    const metaParts = [];
    if (item.personaId) metaParts.push(getPersonaName(item.personaId));
    if (item.pauseAfter) metaParts.push("Pause after send");
    meta.innerText = metaParts.join(" | ");

    const checkpointRow = document.createElement("label");
    checkpointRow.className = "checkpoint-row";
    const checkpointInput = document.createElement("input");
    checkpointInput.type = "checkbox";
    checkpointInput.checked = Boolean(item.pauseAfter);
    checkpointInput.disabled =
      !canUseQueueControls(state) || (state.isProcessing && index === 0);
    checkpointInput.addEventListener("change", () => {
      sendQueueAction("toggle_pause_after", { index });
    });
    checkpointRow.appendChild(checkpointInput);
    checkpointRow.append(" Pause here");

    const actions = document.createElement("div");
    actions.className = "queue-actions";

    actions.appendChild(
      createActionButton(
        "Send now",
        "primary",
        () => sendQueueAction("force_send", { index }),
        index === 0 && state.isProcessing
      )
    );
    actions.appendChild(
      createActionButton(
        "Edit",
        null,
        () => editQueueItem(index, item.text),
        state.isProcessing && index === 0
      )
    );
    actions.appendChild(
      createActionButton(
        "Duplicate",
        null,
        () => sendQueueAction("duplicate_queue_item", { index })
      )
    );
    actions.appendChild(
      createActionButton(
        "Top",
        null,
        () => sendQueueAction("move_to_top", { index }),
        index === 0 || state.isProcessing
      )
    );
    actions.appendChild(
      createActionButton(
        "Up",
        null,
        () => sendQueueAction("move_queue_item", { index, direction: "up" }),
        index === 0 || (state.isProcessing && index === 1)
      )
    );
    actions.appendChild(
      createActionButton(
        "Down",
        null,
        () => sendQueueAction("move_queue_item", { index, direction: "down" }),
        index === state.queue.length - 1 || (state.isProcessing && index === 0)
      )
    );
    actions.appendChild(
      createActionButton("Remove", "danger", () => removeQueueItem(index, item.text))
    );

    li.appendChild(header);
    if (metaParts.length) li.appendChild(meta);
    li.appendChild(checkpointRow);
    li.appendChild(actions);
    queueList.appendChild(li);
  });
}

function createActionButton(label, className, onClick, disabled = false, title = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.innerText = label;
  if (title) button.title = title;
  if (className) button.classList.add(className);
  button.disabled = disabled || !canUseQueueControls();
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

function updateControls() {
  const state = latestState;
  const hasQueue = Boolean(state?.queueLength);
  const controlsOk = canUseQueueControls(state);
  const atCheckpoint = state?.pauseReason === "checkpoint";

  const allowAdd = controlsOk || broadcastToggle.checked;
  queueBtn.disabled = !allowAdd;
  promptText.disabled = !allowAdd;
  queueBtn.innerText = broadcastToggle.checked
    ? "Broadcast to selected"
    : "Add to Queue";

  clearBtn.disabled = !controlsOk || !hasQueue;

  if (!controlsOk || !state) {
    pauseBtn.disabled = true;
    pauseBtn.innerText = "Pause";
    pauseBtn.classList.remove("checkpoint-action");
    retryBtn.disabled = true;
    return;
  }

  const canResume =
    state.isPaused &&
    (state.pauseReason === "checkpoint" || state.pauseReason === "manual");

  pauseBtn.disabled = !hasQueue && !state.isProcessing && !canResume;
  pauseBtn.innerText = state.isPaused ? "Resume" : "Pause";
  pauseBtn.classList.toggle("checkpoint-action", atCheckpoint);
  retryBtn.disabled = !state.lastError || !hasQueue;
}

function applyState(state) {
  latestState = state;
  renderQueueStatus(state);
  renderQueue(state);
  updateControls();
}

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
  const tab = await ensureManagedTab();

  if (!tab?.id || !tab.url || !isSupportedChatUrl(tab.url)) {
    setConnectionStatus("disconnected");
    setStatus("Open a supported chat tab first!", "red");
    return { ok: false, error: "Not connected." };
  }

  let response = await sendMessageToTab(tab.id, { action, ...payload });

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
  applyState(response);
  lastQueueStateSignature = getQueueStateSignature(response);
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

async function removeQueueItem(index, text) {
  const confirmed = confirm(`Remove "${truncate(text, 40)}" from the queue?`);
  if (!confirmed) return;
  await sendQueueAction("remove_from_queue", { index });
}

async function editQueueItem(index, currentPrompt) {
  const updated = prompt(`Edit prompt #${index + 1}:`, currentPrompt);
  if (updated === null) return;
  await sendQueueAction("edit_queue_item", { index, prompt: updated });
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

async function loadHistoryView() {
  const response = await runtimeMessage({ action: "get_history" });
  if (!response.ok) return;

  renderHistory(response.history || []);
}

function renderHistory(history) {
  historyList.innerHTML = "";

  if (!history.length) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.innerText = "No prompts sent yet";
    historyList.appendChild(empty);
    return;
  }

  history.slice(0, 50).forEach((entry) => {
    const li = document.createElement("li");
    li.className = "history-item";

    const header = document.createElement("div");
    header.className = "history-item-header";

    const meta = document.createElement("span");
    meta.className = "history-meta";
    meta.innerText = entry.site;

    const preview = document.createElement("span");
    preview.className = "history-preview";
    preview.title = entry.text;
    preview.innerText = truncate(entry.text, 70);

    header.appendChild(meta);
    header.appendChild(preview);

    const time = document.createElement("div");
    time.className = "queue-meta";
    time.innerText = new Date(entry.timestamp).toLocaleString();

    const actions = document.createElement("div");
    actions.className = "history-actions";
    actions.appendChild(
      createHistoryButton("Re-queue", "primary", () => requeueHistoryEntry(entry))
    );

    li.appendChild(header);
    li.appendChild(time);
    li.appendChild(actions);
    historyList.appendChild(li);
  });
}

function createHistoryButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.innerText = label;
  if (className) button.classList.add(className);
  button.addEventListener("click", onClick);
  return button;
}

async function requeueHistoryEntry(entry) {
  switchTab("queue");
  await sendQueueAction("add_to_queue", {
    prompt: entry.text,
    pauseAfter: entry.pauseAfter,
    personaId: entry.personaId
  });
}

function switchTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  queuePanel.classList.toggle("hidden", tabName !== "queue");
  historyPanel.classList.toggle("hidden", tabName !== "history");

  if (tabName === "history") {
    loadHistoryView();
  }
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

queueBtn.addEventListener("click", async () => {
  const text = promptText.value.trim();
  if (!text) return;

  const payload = {
    prompt: text,
    pauseAfter: pauseHereAdd.checked,
    personaId: personaSelect.value || null
  };

  if (broadcastToggle.checked) {
    const result = await broadcastToSelectedTabs(payload);

    if (!result) {
      return;
    }

    promptText.value = "";
    pauseHereAdd.checked = false;
    setStatus(
      `Broadcast to ${result.successCount}/${result.total} selected tab${result.total === 1 ? "" : "s"}`,
      result.successCount > 0 ? "green" : "red"
    );
    await refreshLinkedTabs({ showChecking: false });
    return;
  }

  const response = await sendQueueAction("add_to_queue", payload);
  if (!isActionSuccess(response)) return;

  promptText.value = "";
  pauseHereAdd.checked = false;
  setStatus(`Added! Queue size: ${response.queueLength}`, "green");

  setTimeout(() => {
    if (statusDiv.innerText.startsWith("Added!")) setStatus("", "");
  }, 2000);
});

pauseBtn.addEventListener("click", async () => {
  const action = latestState?.isPaused ? "resume_queue" : "pause_queue";
  await sendQueueAction(action);
});

retryBtn.addEventListener("click", async () => {
  await sendQueueAction("retry_failed");
});

clearBtn.addEventListener("click", async () => {
  if (!latestState?.queueLength) return;
  if (!confirm("Clear the entire queue?")) return;
  await sendQueueAction("clear_queue");
});

broadcastToggle.addEventListener("change", () => {
  setBroadcastPanelVisible(broadcastToggle.checked);
  updateControls();
});

tabsToggle.addEventListener("click", () => {
  linkedTabsExpanded = !linkedTabsExpanded;
  lastLinkedTabsSignature = "";
  renderConnectionBar(linkedTabsCache, ignoredTabsCache);
  lastLinkedTabsSignature = getLinkedTabsSignature(
    linkedTabsCache,
    ignoredTabsCache,
    managedTabId,
    linkedTabsExpanded
  );
});

reconnectBtn.addEventListener("click", async () => {
  await refreshLinkedTabs({ showChecking: true });
});

broadcastSelectAll.addEventListener("click", () => setBroadcastTabSelection(true));
broadcastSelectNone.addEventListener("click", () => setBroadcastTabSelection(false));

managePersonaBtn.addEventListener("click", () => {
  setPersonaPanelVisible(personaPanel.classList.contains("hidden"));
});

addPersonaBtn.addEventListener("click", () => addPersona());

loadPersonas();
refreshLinkedTabs({ showChecking: true });
pollTimer = setInterval(() => refreshLinkedTabs({ showChecking: false }), 3000);

window.addEventListener("unload", () => {
  clearInterval(pollTimer);
});
