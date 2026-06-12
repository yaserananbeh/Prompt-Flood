// @module popup/09-queue.js — see AGENTS.md
function renderQueue() {
  queueList.innerHTML = "";

  if (!isConnected) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "queue-empty";
    emptyItem.innerText = "Queue is empty";
    queueList.appendChild(emptyItem);
    return;
  }

  const entries = collectQueueEntries();
  if (!entries.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "queue-empty";
    emptyItem.innerText = queueViewTabId ? "Queue is empty" : "No prompts in any queue";
    queueList.appendChild(emptyItem);
    return;
  }

  const showSource = !queueViewTabId && linkedTabsCache.length > 1;

  entries.forEach(({ tabId, index, item, state, site }) => {
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
      badge.innerText = "Next";
    } else {
      badge.classList.add("next");
      badge.innerText = `#${index + 1}`;
    }

    const preview = document.createElement("span");
    preview.className = "queue-preview";
    preview.title = item.text || "";
    preview.innerText = formatQueuePreview(item);

    header.appendChild(badge);
    header.appendChild(preview);

    if ((isSending || isNextAtCheckpoint) && tabId) {
      header.appendChild(
        createGoToTabButton(tabId, {
          compact: true,
          title: "Go to chat tab"
        })
      );
    }

    const meta = document.createElement("div");
    meta.className = "queue-meta";
    const metaParts = [];
    if (showSource) metaParts.push(site);
    if (item.personaId) metaParts.push(getPersonaName(item.personaId));
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
      sendQueueAction("toggle_pause_after", { index, tabId });
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
        () => sendQueueAction("force_send", { index, tabId }),
        index === 0 && state.isProcessing
      )
    );
    actions.appendChild(
      createActionButton(
        "Edit",
        null,
        () => editQueueItem(index, item.text, tabId),
        state.isProcessing && index === 0
      )
    );
    actions.appendChild(
      createActionButton(
        "Duplicate",
        null,
        () => sendQueueAction("duplicate_queue_item", { index, tabId })
      )
    );
    actions.appendChild(
      createActionButton(
        "Top",
        null,
        () => sendQueueAction("move_to_top", { index, tabId }),
        index === 0 || state.isProcessing
      )
    );
    actions.appendChild(
      createActionButton(
        "Up",
        null,
        () => sendQueueAction("move_queue_item", { index, direction: "up", tabId }),
        index === 0 || (state.isProcessing && index === 1)
      )
    );
    actions.appendChild(
      createActionButton(
        "Down",
        null,
        () => sendQueueAction("move_queue_item", { index, direction: "down", tabId }),
        index === state.queue.length - 1 || (state.isProcessing && index === 0)
      )
    );
    actions.appendChild(
      createActionButton("Remove", "danger", () => removeQueueItem(index, item.text, tabId))
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
  const state = getControlsState();
  const hasQueue = queueViewTabId
    ? Boolean(state?.queueLength)
    : getTotalQueueLength() > 0;
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

function applyQueueDisplay() {
  renderQueueStatus(getQueueStatusState());
  renderQueue();
  updateControls();
}

function applyState(state) {
  latestState = state;
  applyQueueDisplay();
}
