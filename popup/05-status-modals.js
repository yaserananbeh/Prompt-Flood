// @module popup/05-status-modals.js — see AGENTS.md
function resetComposeFormAfterAdd() {
  promptText.value = "";
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
