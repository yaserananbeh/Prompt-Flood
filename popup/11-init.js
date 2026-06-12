// @module popup/11-init.js — see AGENTS.md
tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

async function submitPrompt() {
  if (queueBtn.disabled) return;

  const text = promptText.value.trim();
  if (!text) return;

  const tabIds = getEffectiveTargetTabIds();
  if (!tabIds.length) {
    setStatus("Select at least one chat below.", "error");
    return;
  }

  const payload = {
    prompt: text,
    pauseAfter: pauseHereAdd.checked,
    personaId: usePersonaToggle.checked ? personaSelect.value || null : null
  };

  const result = await addPromptToTargets(payload);
  if (!result) return;

  if (settings.clearPromptAfterAdd) {
    resetComposeFormAfterAdd();
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
}

queueBtn.addEventListener("click", submitPrompt);

promptText.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) return;
  event.preventDefault();
  void submitPrompt();
});

pauseBtn.addEventListener("click", async () => {
  const controlsState = getControlsState();
  const action = controlsState?.isPaused ? "resume_queue" : "pause_queue";
  await sendQueueAction(action, { tabId: queueViewTabId ?? managedTabId });
});

retryBtn.addEventListener("click", async () => {
  await sendQueueAction("retry_failed", { tabId: queueViewTabId ?? managedTabId });
});

clearBtn.addEventListener("click", async () => {
  const queueLength = queueViewTabId
    ? getControlsState()?.queueLength
    : getTotalQueueLength();
  if (!queueLength) return;

  if (settings.confirmClearQueue) {
    const confirmed = await showConfirmDialog({
      title: "Clear queue",
      message: "Remove all prompts from the queue? This cannot be undone.",
      confirmLabel: "Clear all"
    });
    if (!confirmed) return;
  }

  await sendQueueAction("clear_queue", { tabId: queueViewTabId ?? managedTabId });
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
  goToTab(queueViewTabId ?? managedTabId);
});

addPersonaBtn.addEventListener("click", () => addPersona());

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
