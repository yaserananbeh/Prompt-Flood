const CONTENT_VERSION = 11;
const ATTACHMENT_PLATFORM_IDS = new Set(["chatgpt", "gemini", "claude"]);
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf"
]);
const SUPPORTED_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "gemini.google.com",
  "claude.ai",
  "kimi.com",
  "chat.deepseek.com"
];
const IGNORED_TABS_KEY = "ignoredTabIds";
const SETTINGS_KEY = "extensionSettings";

const DEFAULT_SETTINGS = {
  refreshIntervalMs: 3000,
  checkpointSound: true,
  clearPromptAfterAdd: true,
  defaultHoldBeforeSending: false,
  defaultPersonaId: "",
  openChatsInBackground: true,
  confirmClearQueue: true
};

function normalizeSettings(rawSettings = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...rawSettings };
  const allowedIntervals = [1000, 3000, 5000, 10000];

  if (!allowedIntervals.includes(merged.refreshIntervalMs)) {
    merged.refreshIntervalMs = DEFAULT_SETTINGS.refreshIntervalMs;
  }

  merged.checkpointSound = Boolean(merged.checkpointSound);
  merged.clearPromptAfterAdd = Boolean(merged.clearPromptAfterAdd);
  merged.defaultHoldBeforeSending = Boolean(merged.defaultHoldBeforeSending);
  merged.defaultPersonaId =
    typeof merged.defaultPersonaId === "string" ? merged.defaultPersonaId : "";
  merged.openChatsInBackground = Boolean(merged.openChatsInBackground);
  merged.confirmClearQueue = Boolean(merged.confirmClearQueue);

  return merged;
}
const SUPPORTED_LLMS = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com/",
    host: "chatgpt.com",
    accent: "#10a37f"
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com/app",
    host: "gemini.google.com",
    accent: "#4285f4"
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai/new",
    host: "claude.ai",
    accent: "#d97757"
  },
  {
    id: "kimi",
    name: "Kimi",
    url: "https://www.kimi.com/",
    host: "kimi.com",
    accent: "#111827"
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://chat.deepseek.com/",
    host: "chat.deepseek.com",
    accent: "#4d6bfe"
  }
];

const queueBtn = document.getElementById("queueBtn");
const promptText = document.getElementById("promptText");
const attachmentFileInput = document.getElementById("attachmentFileInput");
const attachFileBtn = document.getElementById("attachFileBtn");
const attachmentList = document.getElementById("attachmentList");
const statusDiv = document.getElementById("status");
const connectionDot = document.getElementById("connectionDot");
const connectionText = document.getElementById("connectionText");
const connectionTargetIcon = document.getElementById("connectionTargetIcon");
const connectionTargetHint = document.getElementById("connectionTargetHint");
const connectionTabPicker = document.getElementById("connectionTabPicker");
const connectionChipLabel = document.getElementById("connectionChipLabel");
const connectionBox = document.getElementById("connectionBox");
const goToSendTargetBtn = document.getElementById("goToSendTargetBtn");
const goToQueueViewBtn = document.getElementById("goToQueueViewBtn");
const tabsToggle = document.getElementById("tabsToggle");
const reconnectBtn = document.getElementById("reconnectBtn");
const linkedTabsPanel = document.getElementById("linkedTabsPanel");
const queueList = document.getElementById("queueList");
const queueStatus = document.getElementById("queueStatus");
const pauseBtn = document.getElementById("pauseBtn");
const retryBtn = document.getElementById("retryBtn");
const clearBtn = document.getElementById("clearBtn");
const queueViewRow = document.getElementById("queueViewRow");
const queueViewPicker = document.getElementById("queueViewPicker");
const personaSelect = document.getElementById("personaSelect");
const personaFieldGroup = document.getElementById("personaFieldGroup");
const usePersonaToggle = document.getElementById("usePersonaToggle");
const personaList = document.getElementById("personaList");
const addPersonaBtn = document.getElementById("addPersonaBtn");
const pauseHereAdd = document.getElementById("pauseHereAdd");
const queueChrome = document.getElementById("queueChrome");
const queuePanel = document.getElementById("queuePanel");
const settingsPanel = document.getElementById("settingsPanel");
const settingsDefaultPersona = document.getElementById("settingsDefaultPersona");
const settingsDefaultHold = document.getElementById("settingsDefaultHold");
const settingsClearPrompt = document.getElementById("settingsClearPrompt");
const settingsConfirmClear = document.getElementById("settingsConfirmClear");
const settingsRefreshInterval = document.getElementById("settingsRefreshInterval");
const settingsCheckpointSound = document.getElementById("settingsCheckpointSound");
const settingsOpenBackground = document.getElementById("settingsOpenBackground");
const settingsResetIgnored = document.getElementById("settingsResetIgnored");
const tabButtons = document.querySelectorAll(".tab-btn");
const personaModal = document.getElementById("personaModal");
const personaModalTitle = document.getElementById("personaModalTitle");
const personaNameInput = document.getElementById("personaNameInput");
const personaPrefixInput = document.getElementById("personaPrefixInput");
const personaSuffixInput = document.getElementById("personaSuffixInput");
const personaModalCancel = document.getElementById("personaModalCancel");
const personaModalSave = document.getElementById("personaModalSave");
const confirmModal = document.getElementById("confirmModal");
const confirmModalTitle = document.getElementById("confirmModalTitle");
const confirmModalMessage = document.getElementById("confirmModalMessage");
const confirmModalCancel = document.getElementById("confirmModalCancel");
const confirmModalOk = document.getElementById("confirmModalOk");
const editPromptModal = document.getElementById("editPromptModal");
const editPromptModalTitle = document.getElementById("editPromptModalTitle");
const editPromptInput = document.getElementById("editPromptInput");
const editPromptCancel = document.getElementById("editPromptCancel");
const editPromptSave = document.getElementById("editPromptSave");
const llmLauncher = document.getElementById("llmLauncher");
const llmLauncherToggle = document.getElementById("llmLauncherToggle");
const llmLauncherLabel = document.getElementById("llmLauncherLabel");
const llmLauncherChevron = document.getElementById("llmLauncherChevron");
const llmLauncherGrid = document.getElementById("llmLauncherGrid");

let activeTabId = null;
let openingLlmId = null;
let llmLauncherUserExpanded = null;
let lastSupportedTabCount = 0;
let managedTabId = null;
let isConnected = false;
let latestState = null;
let personas = [];
let composeAttachments = [];
let pollTimer = null;
let linkedTabsCache = [];
let linkedTabsExpanded = false;
let ignoredTabsCache = [];
let sendTargetTabIds = new Set();
let lastSendTargetTabId = null;
let lastQueueStateSignature = "";
let lastLinkedTabsSignature = "";
let settings = { ...DEFAULT_SETTINGS };
let statusClearTimer = null;

const GO_TO_TAB_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
const INFO_TIP_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

const TOOLTIP_LAYER_MS = 150;
const TOOLTIP_EDGE_PADDING = 12;
let infoTipMeasurer = null;

function getInfoTipMeasurer() {
  if (!infoTipMeasurer) {
    infoTipMeasurer = document.createElement("div");
    infoTipMeasurer.className = "info-tip-measurer";
    document.body.appendChild(infoTipMeasurer);
  }
  return infoTipMeasurer;
}

function positionInfoTip(button) {
  const text = button.dataset.tip || "";
  if (!text) return;

  button.classList.remove("tooltip-align-start", "tooltip-align-end", "tooltip-above");

  const measurer = getInfoTipMeasurer();
  measurer.textContent = text;
  const tipRect = measurer.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  const panelWidth = document.documentElement.clientWidth;
  const centerX = buttonRect.left + buttonRect.width / 2;
  const halfWidth = tipRect.width / 2;

  if (centerX + halfWidth > panelWidth - TOOLTIP_EDGE_PADDING) {
    button.classList.add("tooltip-align-end");
  } else if (centerX - halfWidth < TOOLTIP_EDGE_PADDING) {
    button.classList.add("tooltip-align-start");
  }

  const spaceBelow = window.innerHeight - buttonRect.bottom - 8;
  const spaceAbove = buttonRect.top - 8;
  if (spaceBelow < tipRect.height + 8 && spaceAbove > spaceBelow) {
    button.classList.add("tooltip-above");
  }
}

function setInfoTipLayers(button, open) {
  const layerTargets = [
    button.closest(".toggle-row"),
    button.closest(".queue-item"),
    button.closest(".card"),
    button.closest(".sub-panel-header")
  ];

  layerTargets.forEach((element) => {
    if (!element) return;
    element.classList.toggle("tip-layer-open", open);
  });
}

function bindInfoTip(button) {
  if (button.dataset.infoTipBound) return;
  button.dataset.infoTipBound = "1";

  let closeTimer = null;

  const openTip = () => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    positionInfoTip(button);
    button.classList.add("is-open");
    setInfoTipLayers(button, true);
  };

  const scheduleCloseTip = () => {
    if (closeTimer) clearTimeout(closeTimer);
    button.classList.remove("is-open");
    closeTimer = setTimeout(() => {
      button.classList.remove("tooltip-align-start", "tooltip-align-end", "tooltip-above");
      setInfoTipLayers(button, false);
      closeTimer = null;
    }, TOOLTIP_LAYER_MS);
  };

  button.addEventListener("mouseenter", openTip);
  button.addEventListener("mouseleave", scheduleCloseTip);
  button.addEventListener("focus", openTip);
  button.addEventListener("blur", scheduleCloseTip);
  button.addEventListener("click", (event) => event.preventDefault());
}

function createInfoTip(text, ariaLabel = "More info", { above = false } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = above ? "info-tip tooltip-above" : "info-tip";
  button.dataset.tip = text;
  button.setAttribute("aria-label", ariaLabel);
  button.innerHTML = INFO_TIP_ICON;
  bindInfoTip(button);
  return button;
}

function initInfoTips() {
  document.querySelectorAll(".info-tip").forEach((button) => bindInfoTip(button));
}

function updateSettingsCard(card, expanded) {
  card.classList.toggle("settings-card-collapsed", !expanded);
  const toggle = card.querySelector(".settings-card-toggle");
  const chevron = card.querySelector(".settings-card-chevron");
  if (toggle) toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  if (chevron) chevron.textContent = expanded ? "▴" : "▾";
}

function toggleSettingsCard(card) {
  const expanded = card.classList.contains("settings-card-collapsed");
  updateSettingsCard(card, expanded);
}

function initSettingsCards() {
  document.querySelectorAll(".settings-card").forEach((card) => {
    const toggle = card.querySelector(".settings-card-toggle");
    if (!toggle || toggle.dataset.settingsCardBound) return;
    toggle.dataset.settingsCardBound = "1";
    toggle.addEventListener("click", () => toggleSettingsCard(card));
  });
}

async function goToTab(tabId) {
  if (!Number.isInteger(tabId) || tabId <= 0) return false;

  try {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    return true;
  } catch (_error) {
    setStatus("That tab is no longer open.", "error");
    return false;
  }
}

function createGoToTabButton(tabId, { title = "Go to tab", compact = false } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = compact ? "go-to-tab-btn go-to-tab-btn-compact" : "go-to-tab-btn";
  button.title = title;
  button.setAttribute("aria-label", title);
  button.innerHTML = GO_TO_TAB_ICON;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    goToTab(tabId);
  });
  return button;
}

function getSendTargetGoTabId() {
  const targets = getEffectiveTargetTabIds();
  if (targets.length === 1) return targets[0];
  if (lastSendTargetTabId && targets.includes(lastSendTargetTabId)) {
    return lastSendTargetTabId;
  }
  return targets[0] ?? managedTabId ?? null;
}

function markSendTargetInteraction(tabId) {
  if (Number.isInteger(tabId) && tabId > 0) {
    lastSendTargetTabId = tabId;
  }
}

function getTabSiteLabel(tabId) {
  const entry = linkedTabsCache.find((item) => item.tabId === tabId);
  return formatConnectionLabel(entry?.state?.site || getSiteFromUrl(entry?.url));
}

function updateGoToTabButtons() {
  const sendTabId = getSendTargetGoTabId();
  const showSend = Boolean(isConnected && sendTabId);
  goToSendTargetBtn?.classList.toggle("hidden", !showSend);
  if (showSend && sendTabId) {
    const title = `Go to ${getTabSiteLabel(sendTabId)} tab (send target)`;
    goToSendTargetBtn.title = title;
    goToSendTargetBtn.setAttribute("aria-label", title);
  }

  const showQueue = Boolean(isConnected && managedTabId && linkedTabsCache.length > 1);
  goToQueueViewBtn?.classList.toggle("hidden", !showQueue);
  if (showQueue && managedTabId) {
    const title = `Go to ${getTabSiteLabel(managedTabId)} tab (queue view)`;
    goToQueueViewBtn.title = title;
    goToQueueViewBtn.setAttribute("aria-label", title);
  }
}

function updateLlmLauncher(supportedTabCount = lastSupportedTabCount) {
  lastSupportedTabCount = supportedTabCount;
  const hasTabs = supportedTabCount > 0;

  llmLauncherLabel.innerText = hasTabs ? "Open another chat" : "Start a chat";
  llmLauncherToggle.title = hasTabs
    ? "Open more AI chat tabs in the background"
    : "Pick an AI chat to connect";

  const expanded = llmLauncherUserExpanded ?? !hasTabs;
  llmLauncher.classList.toggle("llm-launcher-collapsed", !expanded);
  llmLauncherChevron.innerText = expanded ? "▴" : "▾";
  llmLauncherToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
}

function toggleLlmLauncher() {
  const isCollapsed = llmLauncher.classList.contains("llm-launcher-collapsed");
  llmLauncherUserExpanded = isCollapsed;
  updateLlmLauncher();
}

function getLlmFaviconUrl(host) {
  return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
}

function createLlmLauncherIcon(llm) {
  const img = document.createElement("img");
  img.className = "llm-launcher-icon";
  img.alt = `${llm.name} logo`;
  img.width = 32;
  img.height = 32;
  img.src = getLlmFaviconUrl(llm.host);
  img.addEventListener("error", () => {
    const fallback = document.createElement("span");
    fallback.className = "llm-launcher-fallback";
    fallback.style.setProperty("--llm-accent", llm.accent);
    fallback.innerText = llm.name.charAt(0);
    img.replaceWith(fallback);
  });
  return img;
}

function renderLlmLauncher() {
  llmLauncherGrid.innerHTML = "";

  SUPPORTED_LLMS.forEach((llm) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "llm-launcher-btn";
    button.dataset.llmId = llm.id;
    button.title = `Open ${llm.name} in the background`;
    button.setAttribute("aria-label", `Open ${llm.name} in the background`);
    button.style.setProperty("--llm-accent", llm.accent);

    button.appendChild(createLlmLauncherIcon(llm));

    const name = document.createElement("span");
    name.className = "llm-launcher-name";
    name.innerText = llm.name;
    button.appendChild(name);

    button.addEventListener("click", () => openLlmChat(llm));
    llmLauncherGrid.appendChild(button);
  });
}

function setLlmLauncherBusy(llmId) {
  openingLlmId = llmId;
  llmLauncherGrid.querySelectorAll(".llm-launcher-btn").forEach((button) => {
    button.disabled = Boolean(llmId);
  });
}

async function openLlmChat(llm) {
  if (openingLlmId) return;

  llmLauncherUserExpanded = true;
  updateLlmLauncher();
  setLlmLauncherBusy(llm.id);
  const openInBackground = settings.openChatsInBackground;
  setStatus(
    openInBackground
      ? `Opening ${llm.name} in the background...`
      : `Opening ${llm.name}...`,
    ""
  );

  try {
    const tab = await chrome.tabs.create({
      url: llm.url,
      active: !openInBackground
    });
    if (tab?.id && !managedTabId) {
      managedTabId = tab.id;
    }

    setStatus(
      openInBackground
        ? `${llm.name} opened in a background tab.`
        : `${llm.name} opened in a new tab.`,
      "success"
    );
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await refreshLinkedTabs({ showChecking: false });
  } catch (_error) {
    setStatus(`Could not open ${llm.name}.`, "error");
  } finally {
    setLlmLauncherBusy(null);
  }
}

async function persistSettings(partial) {
  try {
    const data = await chrome.storage.local.get(SETTINGS_KEY);
    settings = normalizeSettings({ ...data[SETTINGS_KEY], ...partial });
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    return true;
  } catch (_error) {
    setStatus("Could not save settings.", "error");
    return false;
  }
}

function applyPersonaSelectDefault() {
  if (
    settings.defaultPersonaId &&
    personas.some((persona) => persona.id === settings.defaultPersonaId)
  ) {
    personaSelect.value = settings.defaultPersonaId;
  } else {
    personaSelect.value = "";
  }
}

function updatePersonaFieldVisibility() {
  const visible = Boolean(usePersonaToggle.checked);
  personaFieldGroup.classList.toggle("hidden", !visible);
  if (visible) {
    applyPersonaSelectDefault();
  }
}

function supportsAttachmentsForUrl(url) {
  const llm = getLlmForUrl(url);
  return Boolean(llm && ATTACHMENT_PLATFORM_IDS.has(llm.id));
}

function getComposeFileMimeType(file) {
  const reportedType = (file.type || "").toLowerCase();
  if (reportedType) return reportedType;

  const extension = (file.name || "").split(".").pop()?.toLowerCase();
  const extensionMap = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf"
  };

  return extensionMap[extension] || "";
}

function isAllowedComposeFile(file) {
  const mimeType = getComposeFileMimeType(file);

  if (!ALLOWED_ATTACHMENT_TYPES.has(mimeType)) {
    return `"${file.name}" must be an image or PDF.`;
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    return `"${file.name}" exceeds the 5 MB limit.`;
  }

  return null;
}

function renderComposeAttachments() {
  attachmentList.innerHTML = "";

  composeAttachments.forEach((file, index) => {
    const chip = document.createElement("span");
    chip.className = "attachment-chip";

    const name = document.createElement("span");
    name.className = "attachment-chip-name";
    name.title = file.name;
    name.innerText = file.name;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", `Remove ${file.name}`);
    removeBtn.innerText = "×";
    removeBtn.addEventListener("click", () => {
      composeAttachments.splice(index, 1);
      renderComposeAttachments();
    });

    chip.appendChild(name);
    chip.appendChild(removeBtn);
    attachmentList.appendChild(chip);
  });

  attachFileBtn.disabled = composeAttachments.length >= MAX_ATTACHMENTS;
}

function clearComposeAttachments() {
  composeAttachments = [];
  if (attachmentFileInput) {
    attachmentFileInput.value = "";
  }
  renderComposeAttachments();
}

async function validateAttachmentTargets(tabIds) {
  for (const tabId of tabIds) {
    const entry = linkedTabsCache.find((item) => item.tabId === tabId);
    const url = entry?.url;

    if (!supportsAttachmentsForUrl(url)) {
      const label = entry?.state?.site || getLlmForUrl(url)?.name || "Selected chat";
      setStatus(`Attachments aren't supported for ${label}. Use ChatGPT, Gemini, or Claude.`, "error");
      return false;
    }
  }

  return true;
}

async function storeComposeAttachments() {
  const attachments = [];
  const attachmentBytes = [];

  for (const file of composeAttachments) {
    const validationError = isAllowedComposeFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    const buffer = await file.arrayBuffer();
    const bytes = [...new Uint8Array(buffer)];
    const response = await runtimeMessage({
      action: "store_attachment",
      name: file.name,
      mimeType: getComposeFileMimeType(file),
      data: bytes
    });

    if (!response?.ok || !response.attachment) {
      throw new Error(response?.error || `Could not store "${file.name}".`);
    }

    attachments.push(response.attachment);
    attachmentBytes.push({
      id: response.attachment.id,
      name: response.attachment.name,
      mimeType: response.attachment.mimeType,
      data: bytes
    });
  }

  return { attachments, attachmentBytes };
}

function formatQueuePreview(item) {
  if (item.text) {
    return truncate(item.text);
  }

  if (item.attachments?.length) {
    const names = item.attachments.map((entry) => entry.name).join(", ");
    return truncate(`Attachment: ${names}`);
  }

  return "(empty)";
}

function resetComposeFormAfterAdd() {
  promptText.value = "";
  clearComposeAttachments();
  pauseHereAdd.checked = settings.defaultHoldBeforeSending;
  usePersonaToggle.checked = false;
  updatePersonaFieldVisibility();
}

function applyQueueDefaultsFromSettings() {
  pauseHereAdd.checked = Boolean(settings.defaultHoldBeforeSending);
  usePersonaToggle.checked = false;
  updatePersonaFieldVisibility();
}

function renderSettingsPersonaOptions() {
  const selected = settingsDefaultPersona.value;
  settingsDefaultPersona.innerHTML = '<option value="">None</option>';

  personas.forEach((persona) => {
    const option = document.createElement("option");
    option.value = persona.id;
    option.innerText = persona.name;
    settingsDefaultPersona.appendChild(option);
  });

  const preferred = settings.defaultPersonaId || selected;
  if (preferred && personas.some((persona) => persona.id === preferred)) {
    settingsDefaultPersona.value = preferred;
  }
}

function applySettingsToForm() {
  settingsDefaultHold.checked = Boolean(settings.defaultHoldBeforeSending);
  settingsClearPrompt.checked = Boolean(settings.clearPromptAfterAdd);
  settingsConfirmClear.checked = Boolean(settings.confirmClearQueue);
  settingsRefreshInterval.value = String(settings.refreshIntervalMs);
  settingsCheckpointSound.checked = Boolean(settings.checkpointSound);
  settingsOpenBackground.checked = Boolean(settings.openChatsInBackground);
  renderSettingsPersonaOptions();
}

async function loadSettings() {
  try {
    const data = await chrome.storage.local.get(SETTINGS_KEY);
    settings = normalizeSettings(data[SETTINGS_KEY]);
  } catch (_error) {
    settings = { ...DEFAULT_SETTINGS };
  }

  applySettingsToForm();
  applyQueueDefaultsFromSettings();
  restartPollTimer();
}

function restartPollTimer() {
  if (pollTimer) {
    clearInterval(pollTimer);
  }

  pollTimer = setInterval(
    () => refreshLinkedTabs({ showChecking: false }),
    settings.refreshIntervalMs || 3000
  );
}

function bindSettingsControls() {
  settingsDefaultPersona.addEventListener("change", async () => {
    const saved = await persistSettings({
      defaultPersonaId: settingsDefaultPersona.value
    });
    if (saved) applyQueueDefaultsFromSettings();
  });

  settingsDefaultHold.addEventListener("change", async () => {
    const saved = await persistSettings({
      defaultHoldBeforeSending: settingsDefaultHold.checked
    });
    if (saved) pauseHereAdd.checked = settings.defaultHoldBeforeSending;
  });

  settingsClearPrompt.addEventListener("change", () => {
    persistSettings({ clearPromptAfterAdd: settingsClearPrompt.checked });
  });

  settingsConfirmClear.addEventListener("change", () => {
    persistSettings({ confirmClearQueue: settingsConfirmClear.checked });
  });

  settingsRefreshInterval.addEventListener("change", async () => {
    const saved = await persistSettings({
      refreshIntervalMs: Number(settingsRefreshInterval.value)
    });
    if (saved) restartPollTimer();
  });

  settingsCheckpointSound.addEventListener("change", () => {
    persistSettings({ checkpointSound: settingsCheckpointSound.checked });
  });

  settingsOpenBackground.addEventListener("change", () => {
    persistSettings({ openChatsInBackground: settingsOpenBackground.checked });
  });

  settingsResetIgnored.addEventListener("click", async () => {
    const confirmed = await showConfirmDialog({
      title: "Reset ignored tabs",
      message: "Start managing all supported chat tabs again?",
      confirmLabel: "Reset"
    });
    if (!confirmed) return;

    try {
      await chrome.storage.local.remove(IGNORED_TABS_KEY);
    } catch (_error) {
      setStatus("Could not reset ignored tabs.", "error");
      return;
    }

    lastLinkedTabsSignature = "";
    await refreshLinkedTabs({ showChecking: true });
    switchTab("queue");
    setStatus("Ignored tabs reset.", "success");
  });
}

function getStatusAutoClearMs(tone, duration) {
  if (duration === 0) return 0;
  if (typeof duration === "number" && duration > 0) return duration;
  if (tone === "green" || tone === "success") return 3500;
  if (tone === "red" || tone === "error") return 5000;
  return 0;
}

function setStatus(message, tone = "", { tabId = null, duration } = {}) {
  if (statusClearTimer) {
    clearTimeout(statusClearTimer);
    statusClearTimer = null;
  }

  statusDiv.innerHTML = "";
  statusDiv.classList.remove("success", "error", "has-go-to-tab");

  if (!message) return;

  const text = document.createElement("span");
  text.innerText = message;
  statusDiv.appendChild(text);

  if (tabId) {
    statusDiv.classList.add("has-go-to-tab");
    statusDiv.appendChild(
      createGoToTabButton(tabId, { title: "Go to chat tab", compact: true })
    );
  }

  if (tone === "green" || tone === "success") {
    statusDiv.classList.add("success");
  } else if (tone === "red" || tone === "error") {
    statusDiv.classList.add("error");
  }

  const autoClearMs = getStatusAutoClearMs(tone, duration);
  if (autoClearMs > 0) {
    statusClearTimer = setTimeout(() => {
      statusClearTimer = null;
      setStatus("", "", { duration: 0 });
    }, autoClearMs);
  }
}

function setQueueStatusBanner(className, text, { extraButtons = [] } = {}) {
  queueStatus.classList.remove("hidden");
  queueStatus.className = `queue-status ${className}`.trim();
  queueStatus.innerHTML = "";

  const message = document.createElement("span");
  message.className = "queue-status-text";
  message.innerText = text;
  queueStatus.appendChild(message);

  const actions = document.createElement("div");
  actions.className = "queue-status-actions";

  if (managedTabId) {
    actions.appendChild(
      createGoToTabButton(managedTabId, { title: "Go to chat tab", compact: true })
    );
  }

  extraButtons.forEach((button) => actions.appendChild(button));

  if (actions.childNodes.length) {
    queueStatus.appendChild(actions);
  }
}

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

function showConfirmDialog({ title, message, confirmLabel = "Confirm" }) {
  return new Promise((resolve) => {
    confirmModalTitle.innerText = title;
    confirmModalMessage.innerText = message;
    confirmModalOk.innerText = confirmLabel;

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      confirmModalCancel.removeEventListener("click", onCancel);
      confirmModalOk.removeEventListener("click", onConfirm);
      closeModal(confirmModal);
    };

    confirmModalCancel.addEventListener("click", onCancel);
    confirmModalOk.addEventListener("click", onConfirm);
    openModal(confirmModal);
  });
}

function showPersonaDialog(persona = null) {
  return new Promise((resolve) => {
    personaModalTitle.innerText = persona ? "Edit persona" : "New persona";
    personaNameInput.value = persona?.name || "";
    personaPrefixInput.value = persona?.prefix || "";
    personaSuffixInput.value = persona?.suffix || "";

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    const onSave = () => {
      const name = personaNameInput.value.trim();
      if (!name) {
        personaNameInput.focus();
        return;
      }

      cleanup();
      resolve({
        id: persona?.id,
        name,
        prefix: personaPrefixInput.value,
        suffix: personaSuffixInput.value
      });
    };

    const cleanup = () => {
      personaModalCancel.removeEventListener("click", onCancel);
      personaModalSave.removeEventListener("click", onSave);
      closeModal(personaModal);
    };

    personaModalCancel.addEventListener("click", onCancel);
    personaModalSave.addEventListener("click", onSave);
    openModal(personaModal);
    personaNameInput.focus();
  });
}

function showEditPromptDialog(index, currentPrompt) {
  return new Promise((resolve) => {
    editPromptModalTitle.innerText = `Edit prompt #${index + 1}`;
    editPromptInput.value = currentPrompt;

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    const onSave = () => {
      cleanup();
      resolve(editPromptInput.value);
    };

    const cleanup = () => {
      editPromptCancel.removeEventListener("click", onCancel);
      editPromptSave.removeEventListener("click", onSave);
      closeModal(editPromptModal);
    };

    editPromptCancel.addEventListener("click", onCancel);
    editPromptSave.addEventListener("click", onSave);
    openModal(editPromptModal);
    editPromptInput.focus();
  });
}

function getSiteFromUrl(url) {
  if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) return "ChatGPT";
  if (url.includes("gemini.google.com")) return "Gemini";
  if (url.includes("claude.ai")) return "Claude";
  if (url.includes("kimi.com")) return "Kimi";
  if (url.includes("chat.deepseek.com")) return "DeepSeek";
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
  } catch (_error) {
    return null;
  }

  return null;
}

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

function renderQueueViewPicker(linked) {
  if (!queueViewPicker || !queueViewRow) return;

  if (linked.length <= 1) {
    queueViewRow.classList.add("hidden");
    return;
  }

  queueViewRow.classList.remove("hidden");
  queueViewPicker.innerHTML = "";

  linked.forEach((entry) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "queue-view-chip";
    chip.setAttribute("role", "tab");
    chip.setAttribute(
      "aria-selected",
      entry.tabId === managedTabId ? "true" : "false"
    );

    if (entry.tabId === managedTabId) {
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
    label.innerText = entry.state?.site || getSiteFromUrl(entry.url);
    chip.appendChild(label);

    if (entry.tabId === managedTabId) {
      const dot = document.createElement("span");
      dot.className = "queue-view-chip-dot";
      dot.setAttribute("aria-hidden", "true");
      chip.appendChild(dot);
    }

    chip.title = truncate(entry.title || "Untitled", 60);
    chip.addEventListener("click", () => selectManagedTab(entry.tabId));
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
      chatId: managed.state.chatId ?? null,
      url: managed.url
    });
    updateConnectionSummary();
  }

  const stateSignature = getQueueStateSignature(managed.state);
  if (stateSignature !== lastQueueStateSignature) {
    lastQueueStateSignature = stateSignature;
    applyState(managed.state);
  } else {
    latestState = managed.state;
    updateControls();
  }

  const supportedTabCount = tabs.filter(
    (tab) => tab.id && isSupportedChatUrl(tab.url)
  ).length;
  updateLlmLauncher(supportedTabCount);
}

function getPersonaName(personaId) {
  if (!personaId) return null;
  return personas.find((persona) => persona.id === personaId)?.name || "Persona";
}

function setConnectionStatus(status, { site = "", chatId = null, url = null } = {}) {
  connectionDot.classList.remove("connected", "disconnected", "checking");

  if (status === "connected") {
    connectionDot.classList.add("connected");
    isConnected = true;
    updateConnectionSummary();
  } else if (status === "disconnected") {
    connectionDot.classList.add("disconnected");
    connectionText.innerText = "No chat selected";
    connectionText.title = "";
    connectionTargetIcon.classList.add("hidden");
    connectionTabPicker.classList.add("hidden");
    connectionTargetHint.classList.add("hidden");
    isConnected = false;
    latestState = null;
    tabsToggle.classList.add("hidden");
    linkedTabsPanel.classList.add("hidden");
    renderQueue(null);
  } else {
    connectionDot.classList.add("checking");
    connectionText.innerText = "Checking...";
    connectionText.title = "";
    connectionTargetIcon.classList.add("hidden");
    isConnected = false;
  }

  updateGoToTabButtons();
  updateControls();
}

function renderQueueStatus(state) {
  queueStatus.classList.add("hidden");
  queueStatus.innerHTML = "";

  if (!state || !state.connected) return;

  if (state.lastError) {
    setQueueStatusBanner("error", state.lastError);
    return;
  }

  if (isStaleContentScript(state)) {
    setQueueStatusBanner(
      "paused",
      "Refresh the managed chat tab once to enable controls (F5)."
    );
    return;
  }

  if (state.pauseReason === "checkpoint" && state.queueLength > 0) {
    const resumeBtn = document.createElement("button");
    resumeBtn.type = "button";
    resumeBtn.className = "checkpoint-resume-btn";
    resumeBtn.innerText = "Resume";
    resumeBtn.disabled = !canUseQueueControls(state);
    resumeBtn.addEventListener("click", () => sendQueueAction("resume_queue"));

    setQueueStatusBanner("checkpoint", "Checkpoint reached. Review the response, then resume.", {
      extraButtons: [resumeBtn]
    });
    return;
  }

  if (state.isPaused && state.queueLength > 0) {
    setQueueStatusBanner("paused", "Queue is paused. Resume to continue sending.");
    return;
  }

  if (state.isProcessing) {
    setQueueStatusBanner("", "Sending the first prompt in the queue...");
    return;
  }

  if (state.queueLength > 0) {
    setQueueStatusBanner(
      "",
      `${state.queueLength} prompt${state.queueLength === 1 ? "" : "s"} waiting.`
    );
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
  } else if (usePersonaToggle.checked) {
    applyPersonaSelectDefault();
  }

  renderPersonaList();
  renderSettingsPersonaOptions();
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

async function promptForPersonaDetails(persona = null) {
  return showPersonaDialog(persona);
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
  const confirmed = await showConfirmDialog({
    title: "Delete persona",
    message: `Delete "${persona.name}"? This cannot be undone.`,
    confirmLabel: "Delete"
  });
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
    preview.title = item.text || item.attachments?.map((entry) => entry.name).join(", ") || "";
    preview.innerText = formatQueuePreview(item);

    header.appendChild(badge);
    header.appendChild(preview);

    if ((isSending || isNextAtCheckpoint) && managedTabId) {
      header.appendChild(
        createGoToTabButton(managedTabId, {
          compact: true,
          title: "Go to chat tab"
        })
      );
    }

    const meta = document.createElement("div");
    meta.className = "queue-meta";
    const metaParts = [];
    if (item.personaId) metaParts.push(getPersonaName(item.personaId));
    if (item.attachments?.length) {
      metaParts.push(
        `${item.attachments.length} attachment${item.attachments.length === 1 ? "" : "s"}`
      );
    }
    if (item.pauseAfter) metaParts.push("Pause after send");
    meta.innerText = metaParts.join(" | ");

    const checkpointWrap = document.createElement("div");
    checkpointWrap.className = "toggle-row";

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
    checkpointWrap.appendChild(checkpointRow);
    checkpointWrap.appendChild(
      createInfoTip(
        "Pauses the queue after this prompt sends so you can review the response before the next one goes out.",
        "About pause here"
      )
    );

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
    li.appendChild(checkpointWrap);
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

  const selectedIds = getEffectiveTargetTabIds();
  const targetConnected = selectedIds.some((tabId) =>
    linkedTabsCache.some((entry) => entry.tabId === tabId)
  );
  const allowAdd = selectedIds.length > 0 && (selectedIds.length > 1 || targetConnected);
  queueBtn.disabled = !allowAdd;
  promptText.disabled = !allowAdd;

  let targetSite = "";
  if (selectedIds.length === 1) {
    const entry = linkedTabsCache.find((item) => item.tabId === selectedIds[0]);
    targetSite = entry?.state?.site || getSiteFromUrl(entry?.url) || "";
  }

  if (selectedIds.length > 1) {
    queueBtn.innerText = `Send to ${selectedIds.length} chats`;
  } else if (targetSite) {
    queueBtn.innerText = `Add to ${targetSite}`;
  } else {
    queueBtn.innerText = "Add to Queue";
  }

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
  const confirmed = await showConfirmDialog({
    title: "Remove from queue",
    message: `Remove "${truncate(text, 40)}" from the queue?`,
    confirmLabel: "Remove"
  });
  if (!confirmed) return;
  await sendQueueAction("remove_from_queue", { index });
}

async function editQueueItem(index, currentPrompt) {
  const updated = await showEditPromptDialog(index, currentPrompt);
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

tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

attachFileBtn?.addEventListener("click", () => {
  attachmentFileInput?.click();
});

attachmentFileInput?.addEventListener("change", () => {
  const files = [...(attachmentFileInput.files || [])];
  attachmentFileInput.value = "";

  if (!files.length) return;

  const remainingSlots = MAX_ATTACHMENTS - composeAttachments.length;
  if (remainingSlots <= 0) {
    setStatus(`You can attach up to ${MAX_ATTACHMENTS} files.`, "error");
    return;
  }

  for (const file of files.slice(0, remainingSlots)) {
    const validationError = isAllowedComposeFile(file);
    if (validationError) {
      setStatus(validationError, "error");
      continue;
    }

    composeAttachments.push(file);
  }

  if (files.length > remainingSlots) {
    setStatus(`Only ${MAX_ATTACHMENTS} attachments are allowed per prompt.`, "error");
  }

  renderComposeAttachments();
});

queueBtn.addEventListener("click", async () => {
  const text = promptText.value.trim();
  if (!text && !composeAttachments.length) return;

  const tabIds = getEffectiveTargetTabIds();
  if (!tabIds.length) {
    setStatus("Select at least one chat below.", "error");
    return;
  }

  let storedAttachmentResult = { attachments: [], attachmentBytes: [] };

  try {
    if (composeAttachments.length) {
      const supported = await validateAttachmentTargets(tabIds);
      if (!supported) return;

      storedAttachmentResult = await storeComposeAttachments();
    }
  } catch (error) {
    if (storedAttachmentResult.attachments.length) {
      await runtimeMessage({
        action: "delete_attachments",
        ids: storedAttachmentResult.attachments.map((entry) => entry.id)
      });
    }

    setStatus(error.message || "Could not store attachments.", "error");
    return;
  }

  const payload = {
    prompt: text,
    pauseAfter: pauseHereAdd.checked,
    personaId: usePersonaToggle.checked ? personaSelect.value || null : null,
    attachments: storedAttachmentResult.attachments,
    attachmentBytes: storedAttachmentResult.attachmentBytes
  };

  const result = await addPromptToTargets(payload);
  if (!result) {
    if (storedAttachmentResult.attachments.length) {
      await runtimeMessage({
        action: "delete_attachments",
        ids: storedAttachmentResult.attachments.map((entry) => entry.id)
      });
    }
    return;
  }

  if (settings.clearPromptAfterAdd) {
    resetComposeFormAfterAdd();
  } else {
    clearComposeAttachments();
  }

  if ("successCount" in result) {
    setStatus(
      `Sent to ${result.successCount}/${result.total} chat${result.total === 1 ? "" : "s"}`,
      result.successCount > 0 ? "success" : "error"
    );
    await refreshLinkedTabs({ showChecking: false });
    return;
  }

  setStatus(`Added! Queue size: ${result.queueLength}`, "success", {
    tabId: getEffectiveTargetTabIds()[0] ?? managedTabId
  });
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

  if (settings.confirmClearQueue) {
    const confirmed = await showConfirmDialog({
      title: "Clear queue",
      message: "Remove all prompts from the queue? This cannot be undone.",
      confirmLabel: "Clear all"
    });
    if (!confirmed) return;
  }

  await sendQueueAction("clear_queue");
});

usePersonaToggle.addEventListener("change", updatePersonaFieldVisibility);

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

goToSendTargetBtn.addEventListener("click", () => {
  goToTab(getSendTargetGoTabId());
});

goToQueueViewBtn?.addEventListener("click", () => {
  goToTab(managedTabId);
});

addPersonaBtn.addEventListener("click", () => addPersona());

renderComposeAttachments();
renderLlmLauncher();
llmLauncherToggle.addEventListener("click", toggleLlmLauncher);
updateLlmLauncher(0);
initInfoTips();
initSettingsCards();
bindSettingsControls();
loadSettings().then(() => loadPersonas());
refreshLinkedTabs({ showChecking: true });

window.addEventListener("unload", () => {
  clearInterval(pollTimer);
  if (statusClearTimer) clearTimeout(statusClearTimer);
});
