const queueBtn = document.getElementById("queueBtn");
const promptText = document.getElementById("promptText");
const statusDiv = document.getElementById("status");
const connectionDot = document.getElementById("connectionDot");
const connectionText = document.getElementById("connectionText");
const queueList = document.getElementById("queueList");
const queueStatus = document.getElementById("queueStatus");
const pauseBtn = document.getElementById("pauseBtn");
const retryBtn = document.getElementById("retryBtn");
const clearBtn = document.getElementById("clearBtn");

const CONTENT_VERSION = 3;

let activeTabId = null;
let isConnected = false;
let latestState = null;
let pollTimer = null;

function setStatus(message, color = "") {
  statusDiv.innerText = message;
  statusDiv.style.color = color;
}

function formatConnectionLabel(site, chatId) {
  if (!chatId) {
    return `Connected to ${site}`;
  }

  return `Connected to ${site} · ${chatId}`;
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
    renderQueue(null);
  } else {
    connectionDot.classList.add("checking");
    connectionText.innerText = "Checking connection...";
    connectionText.title = "";
    isConnected = false;
  }

  updateControls();
}

function truncate(text, max = 80) {
  return text.length > max ? `${text.substring(0, max)}...` : text;
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

function renderQueueStatus(state) {
  if (!state || !state.connected) {
    queueStatus.hidden = true;
    return;
  }

  if (state.lastError) {
    queueStatus.hidden = false;
    queueStatus.className = "queue-status error";
    queueStatus.innerText = state.lastError;
    return;
  }

  if (state.isPaused && state.queueLength > 0) {
    queueStatus.hidden = false;
    queueStatus.className = "queue-status paused";
    queueStatus.innerText = "Queue is paused. Resume to continue sending.";
    return;
  }

  if (isStaleContentScript(state)) {
    queueStatus.hidden = false;
    queueStatus.className = "queue-status paused";
    queueStatus.innerText =
      "Refresh the chat tab once to enable queue controls (F5).";
    return;
  }

  if (state.isProcessing) {
    queueStatus.hidden = false;
    queueStatus.className = "queue-status";
    queueStatus.innerText = "Sending the first prompt in the queue...";
    return;
  }

  if (state.queueLength > 0) {
    queueStatus.hidden = false;
    queueStatus.className = "queue-status";
    queueStatus.innerText = `${state.queueLength} prompt${state.queueLength === 1 ? "" : "s"} waiting.`;
    return;
  }

  queueStatus.hidden = true;
}

function renderQueue(state) {
  queueList.innerHTML = "";

  if (!state || !state.queue || state.queue.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "queue-empty";
    emptyItem.innerText = "Queue is empty";
    queueList.appendChild(emptyItem);
    return;
  }

  state.queue.forEach((prompt, index) => {
    const li = document.createElement("li");
    li.className = "queue-item";

    if (state.isProcessing && index === 0) {
      li.classList.add("active");
    }

    const header = document.createElement("div");
    header.className = "queue-item-header";

    const badge = document.createElement("span");
    badge.className = "queue-badge";
    if (state.isProcessing && index === 0) {
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
    preview.title = prompt;
    preview.innerText = truncate(prompt);

    header.appendChild(badge);
    header.appendChild(preview);

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
        () => editQueueItem(index, prompt),
        state.isProcessing && index === 0
      )
    );
    actions.appendChild(
      createActionButton("Copy", null, () =>
        sendQueueAction("duplicate_queue_item", { index }),
        false,
        "Duplicate"
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
      createActionButton("Remove", "danger", () => removeQueueItem(index))
    );

    li.appendChild(header);
    li.appendChild(actions);
    queueList.appendChild(li);
  });
}

function createActionButton(label, className, onClick, disabled = false, title = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.innerText = label;
  if (title) {
    button.title = title;
  }
  if (className) {
    button.classList.add(className);
  }
  button.disabled =
    disabled || !isConnected || isStaleContentScript(latestState);
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
  const staleScript = isStaleContentScript(state);

  queueBtn.disabled = !isConnected;
  promptText.disabled = !isConnected;
  clearBtn.disabled = !isConnected || !hasQueue || staleScript;

  if (!isConnected || !state) {
    pauseBtn.disabled = true;
    pauseBtn.innerText = "Pause";
    retryBtn.disabled = true;
    return;
  }

  pauseBtn.disabled = staleScript || (!hasQueue && !state.isProcessing);
  pauseBtn.innerText = state.isPaused ? "Resume" : "Pause";
  retryBtn.disabled = staleScript || !state.lastError || !hasQueue;
}

function applyState(state, siteName = "") {
  latestState = state;

  if (state?.connected) {
    setConnectionStatus("connected", {
      site: siteName || state.site,
      chatId: state.chatId ?? null
    });
  }

  renderQueueStatus(state);
  renderQueue(state);
  updateControls();
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

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

function isSupportedChatUrl(url) {
  return url.includes("chatgpt.com") || url.includes("gemini.google.com");
}

async function ensureContentScript(tabId) {
  if (!tabId) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  } catch (_error) {
    // The manifest may already inject this script on supported pages.
  }
}

function sendMessageToTab(message) {
  return new Promise((resolve) => {
    if (!activeTabId) {
      resolve({ ok: false, error: "No active tab." });
      return;
    }

    chrome.tabs.sendMessage(activeTabId, message, (response) => {
      if (chrome.runtime.lastError || !response) {
        resolve({
          ok: false,
          error: "Connection failed. Please refresh the chat page."
        });
        return;
      }

      resolve(response);
    });
  });
}

async function requestTabState({ allowInject = false } = {}) {
  const tab = await ensureActiveTab();

  if (!tab?.id || !tab.url || !isSupportedChatUrl(tab.url)) {
    setConnectionStatus("disconnected");
    return null;
  }

  let response = await sendMessageToTab({ action: "ping_connection" });

  if (
    allowInject &&
    (!response || response.error?.includes("Connection failed"))
  ) {
    await ensureContentScript(tab.id);
    await new Promise((resolve) => setTimeout(resolve, 100));
    response = await sendMessageToTab({ action: "ping_connection" });
  }

  if (!response?.connected) {
    setConnectionStatus("disconnected");
    return null;
  }

  return response;
}

async function refreshState() {
  const response = await requestTabState({ allowInject: true });

  if (!response) {
    return;
  }

  applyState(response);
}

async function sendQueueAction(action, payload = {}) {
  const tab = await ensureActiveTab();

  if (!tab?.id || !tab.url || !isSupportedChatUrl(tab.url)) {
    setConnectionStatus("disconnected");
    setStatus("Open ChatGPT or Gemini first!", "red");
    return { ok: false, error: "Not connected." };
  }

  let response = await sendMessageToTab({ action, ...payload });

  if (!isActionSuccess(response)) {
    if (response?.error?.includes("Connection failed")) {
      await ensureContentScript(tab.id);
      await new Promise((resolve) => setTimeout(resolve, 100));
      response = await sendMessageToTab({ action, ...payload });
    }
  }

  if (!isActionSuccess(response)) {
    setStatus(response?.error || "Action failed.", "red");
    if (response?.error?.includes("Connection failed")) {
      setConnectionStatus("disconnected");
    }
    return response || { ok: false, error: "Action failed." };
  }

  applyState(response);

  if (response.error) {
    setStatus(response.error, "red");
  } else {
    setStatus("", "");
  }

  return response;
}

async function removeQueueItem(index) {
  const prompt = latestState?.queue?.[index];
  const preview = prompt ? truncate(prompt, 40) : "this prompt";
  const confirmed = confirm(`Remove "${preview}" from the queue?`);

  if (!confirmed) {
    return;
  }

  await sendQueueAction("remove_from_queue", { index });
}

async function editQueueItem(index, currentPrompt) {
  const updated = prompt(`Edit prompt #${index + 1}:`, currentPrompt);

  if (updated === null) {
    return;
  }

  await sendQueueAction("edit_queue_item", { index, prompt: updated });
}

queueBtn.addEventListener("click", async () => {
  const text = promptText.value.trim();
  if (!text) return;

  const response = await sendQueueAction("add_to_queue", { prompt: text });

  if (!isActionSuccess(response)) {
    return;
  }

  promptText.value = "";
  setStatus(`Added! Queue size: ${response.queueLength}`, "green");

  setTimeout(() => {
    if (statusDiv.innerText.startsWith("Added!")) {
      setStatus("", "");
    }
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

  const confirmed = confirm("Clear the entire queue?");
  if (!confirmed) return;

  await sendQueueAction("clear_queue");
});

refreshState();
pollTimer = setInterval(refreshState, 2000);

window.addEventListener("unload", () => {
  clearInterval(pollTimer);
});
