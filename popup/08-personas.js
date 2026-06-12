// @module popup/08-personas.js — see AGENTS.md
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
    applyQueueDisplay();
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

  if (state._aggregateMessage) {
    setQueueStatusBanner("", state._aggregateMessage);
    return;
  }

  if (state.pauseReason === "checkpoint" && state.queueLength > 0) {
    const resumeBtn = document.createElement("button");
    resumeBtn.type = "button";
    resumeBtn.className = "checkpoint-resume-btn";
    resumeBtn.innerText = "Resume";
    resumeBtn.disabled = !canUseQueueControls(state);
    const resumeTabId = state._controlTabId ?? queueViewTabId ?? managedTabId;
    resumeBtn.addEventListener("click", () =>
      sendQueueAction("resume_queue", { tabId: resumeTabId })
    );

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
