// @module popup/03-ui-settings.js — see AGENTS.md
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

  const goTabId = queueViewTabId ?? managedTabId;
  const showQueue = Boolean(isConnected && goTabId && linkedTabsCache.length > 1);
  goToQueueViewBtn?.classList.toggle("hidden", !showQueue);
  if (showQueue && goTabId) {
    const title = `Go to ${getTabSiteLabel(goTabId)} tab (queue view)`;
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
