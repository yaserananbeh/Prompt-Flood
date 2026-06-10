(() => {
  const CONTENT_VERSION = 10;

  if (!globalThis.LLM_PLATFORMS) {
    console.error("Prompt Flood: platforms.js must load before content.js.");
    return;
  }

  const { detectPlatform, isReady, sendPrompt } = globalThis.LLM_PLATFORMS;

  if (globalThis.__LLM_PROMPT_QUEUE__?.dispose) {
    globalThis.__LLM_PROMPT_QUEUE__.dispose();
  }

  const READY_TIMEOUT_MS = 120000;
  const READY_POLL_MS = 1000;

  let tabId = null;
  let promptQueue = [];
  let isProcessing = false;
  let isPaused = false;
  let pauseReason = null;
  let lastError = null;

  function createQueueItem(text, { pauseAfter = false, personaId = null } = {}) {
    return {
      id: crypto.randomUUID(),
      text: text.trim(),
      pauseAfter: Boolean(pauseAfter),
      personaId: personaId || null
    };
  }

  function normalizeQueueItem(item) {
    if (typeof item === "string") {
      return createQueueItem(item);
    }

    if (!item || typeof item.text !== "string") {
      return null;
    }

    return {
      id: item.id || crypto.randomUUID(),
      text: item.text.trim(),
      pauseAfter: Boolean(item.pauseAfter),
      personaId: item.personaId || null
    };
  }

  function getPlatform() {
    return detectPlatform();
  }

  function getTabId() {
    return new Promise((resolve) => {
      let settled = false;

      const finish = (tabId) => {
        if (!settled) {
          settled = true;
          resolve(tabId);
        }
      };

      chrome.runtime.sendMessage({ action: "get_tab_id" }, (response) => {
        if (chrome.runtime.lastError) {
          finish(null);
          return;
        }

        finish(response?.tabId ?? null);
      });

      setTimeout(() => finish(null), 1500);
    });
  }

  function storageKey() {
    return `queueState_${tabId}`;
  }

  async function loadPersonas() {
    const data = await chrome.storage.local.get("personas");
    return Array.isArray(data.personas) ? data.personas : [];
  }

  async function wrapWithPersona(text, personaId) {
    if (!personaId) return text;

    const personas = await loadPersonas();
    const persona = personas.find((entry) => entry.id === personaId);
    if (!persona) return text;

    const prefix = (persona.prefix || "").trimEnd();
    const suffix = (persona.suffix || "").trimStart();
    const parts = [];

    if (prefix) parts.push(prefix);
    if (text) parts.push(text);
    if (suffix) parts.push(suffix);

    return parts.join("\n\n");
  }

  async function loadState() {
    if (!tabId) return;

    const data = await chrome.storage.local.get(storageKey());
    const state = data[storageKey()];

    if (!state) return;

    promptQueue = Array.isArray(state.queue)
      ? state.queue.map(normalizeQueueItem).filter(Boolean)
      : [];
    isPaused = Boolean(state.paused);
    pauseReason = state.pauseReason || null;
    lastError = state.lastError || null;
  }

  async function persistState() {
    if (!tabId) return;

    await chrome.storage.local.set({
      [storageKey()]: {
        queue: promptQueue,
        paused: isPaused,
        pauseReason,
        lastError
      }
    });
  }

  function buildStateResponse() {
    const platform = getPlatform();

    return {
      connected: Boolean(platform),
      site: platform?.name || "Unknown",
      platformId: platform?.id || null,
      chatId: platform ? platform.getChatId(window.location.pathname) : null,
      queue: promptQueue.map((item) => ({ ...item })),
      queueLength: promptQueue.length,
      isProcessing,
      isPaused,
      pauseReason,
      lastError,
      version: CONTENT_VERSION
    };
  }

  function successResponse() {
    return { ...buildStateResponse(), ok: true };
  }

  function errorResponse(error) {
    return { ...buildStateResponse(), ok: false, error };
  }

  function parseQueueIndex(value) {
    const index = Number(value);
    return Number.isInteger(index) ? index : NaN;
  }

  function playCheckpointChime() {
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.18);
    } catch (_error) {
      // Ignore if audio is blocked.
    }
  }

  async function logSuccessfulSend(item) {
    const platform = getPlatform();
    if (!platform) return;

    chrome.runtime.sendMessage({
      action: "log_history",
      entry: {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        site: platform.name,
        platformId: platform.id,
        chatId: platform.getChatId(window.location.pathname),
        text: item.text,
        personaId: item.personaId,
        pauseAfter: item.pauseAfter
      }
    });
  }

  async function init() {
    tabId = await getTabId();
    await loadState();

    if (promptQueue.length > 0 && !isPaused && !isProcessing) {
      processQueue();
    }
  }

  const initPromise = init();

  async function handleMessage(request) {
    if (request.action === "ping_connection") {
      return successResponse();
    }

    await initPromise;

    switch (request.action) {
      case "add_to_queue": {
        const prompt = request.prompt?.trim();
        if (!prompt) {
          return errorResponse("Prompt cannot be empty.");
        }

        const wasEmpty = promptQueue.length === 0;

        promptQueue.push(
          createQueueItem(prompt, {
            pauseAfter: request.pauseAfter,
            personaId: request.personaId
          })
        );
        await persistState();

        if (request.pauseAfter && wasEmpty) {
          isPaused = true;
          pauseReason = "manual";
          await persistState();
          return successResponse();
        }

        if (!isProcessing && !isPaused) {
          processQueue();
        }

        return successResponse();
      }

      case "remove_from_queue": {
        const index = parseQueueIndex(request.index);
        if (!Number.isInteger(index) || index < 0 || index >= promptQueue.length) {
          return errorResponse("Invalid queue index.");
        }

        promptQueue.splice(index, 1);

        if (promptQueue.length === 0) {
          isProcessing = false;
          lastError = null;
        }

        await persistState();
        return successResponse();
      }

      case "move_queue_item": {
        const index = parseQueueIndex(request.index);
        const direction = request.direction;

        if (!Number.isInteger(index) || index < 0 || index >= promptQueue.length) {
          return errorResponse("Invalid queue index.");
        }

        if (isProcessing && index === 0) {
          return errorResponse("Cannot move the prompt that is currently sending.");
        }

        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= promptQueue.length) {
          return errorResponse("Cannot move item further.");
        }

        if (isProcessing && targetIndex === 0) {
          return errorResponse("Cannot move an item ahead of the active send.");
        }

        [promptQueue[index], promptQueue[targetIndex]] = [
          promptQueue[targetIndex],
          promptQueue[index]
        ];

        await persistState();
        return successResponse();
      }

      case "move_to_top": {
        const index = parseQueueIndex(request.index);

        if (!Number.isInteger(index) || index <= 0 || index >= promptQueue.length) {
          return errorResponse("Invalid queue index.");
        }

        if (isProcessing) {
          return errorResponse("Wait for the current send to finish before reordering to top.");
        }

        const [item] = promptQueue.splice(index, 1);
        promptQueue.unshift(item);

        await persistState();
        return successResponse();
      }

      case "force_send": {
        const index = parseQueueIndex(request.index);

        if (!Number.isInteger(index) || index < 0 || index >= promptQueue.length) {
          return errorResponse("Invalid queue index.");
        }

        const [item] = promptQueue.splice(index, 1);
        promptQueue.unshift(item);
        isPaused = false;
        pauseReason = null;
        lastError = null;
        await persistState();

        if (!isProcessing) {
          processQueue();
        }

        return successResponse();
      }

      case "duplicate_queue_item": {
        const index = parseQueueIndex(request.index);

        if (!Number.isInteger(index) || index < 0 || index >= promptQueue.length) {
          return errorResponse("Invalid queue index.");
        }

        const copy = { ...promptQueue[index], id: crypto.randomUUID() };
        promptQueue.splice(index + 1, 0, copy);
        await persistState();
        return successResponse();
      }

      case "edit_queue_item": {
        const index = parseQueueIndex(request.index);
        const prompt = request.prompt?.trim();

        if (!Number.isInteger(index) || index < 0 || index >= promptQueue.length) {
          return errorResponse("Invalid queue index.");
        }

        if (!prompt) {
          return errorResponse("Prompt cannot be empty.");
        }

        if (isProcessing && index === 0) {
          return errorResponse("Cannot edit the prompt that is currently sending.");
        }

        promptQueue[index] = { ...promptQueue[index], text: prompt };
        await persistState();
        return successResponse();
      }

      case "toggle_pause_after": {
        const index = parseQueueIndex(request.index);

        if (!Number.isInteger(index) || index < 0 || index >= promptQueue.length) {
          return errorResponse("Invalid queue index.");
        }

        if (isProcessing && index === 0) {
          return errorResponse("Cannot change checkpoint on the prompt that is sending.");
        }

        promptQueue[index].pauseAfter = !promptQueue[index].pauseAfter;
        await persistState();
        return successResponse();
      }

      case "clear_queue":
        promptQueue = [];
        isProcessing = false;
        isPaused = false;
        pauseReason = null;
        lastError = null;
        await persistState();
        return successResponse();

      case "pause_queue":
        isPaused = true;
        pauseReason = "manual";
        await persistState();
        return successResponse();

      case "resume_queue":
        isPaused = false;
        pauseReason = null;
        lastError = null;
        await persistState();

        if (!isProcessing && promptQueue.length > 0) {
          processQueue();
        }

        return successResponse();

      case "retry_failed":
        if (!lastError || promptQueue.length === 0) {
          return errorResponse("Nothing to retry.");
        }

        lastError = null;
        await persistState();

        if (!isProcessing && !isPaused) {
          processQueue();
        }

        return successResponse();

      default:
        return errorResponse("Unknown action.");
    }
  }

  const messageListener = (request, _sender, sendResponse) => {
    handleMessage(request)
      .then(sendResponse)
      .catch((error) => {
        sendResponse(errorResponse(error.message));
      });

    return true;
  };

  chrome.runtime.onMessage.addListener(messageListener);

  globalThis.__LLM_PROMPT_QUEUE__ = {
    version: CONTENT_VERSION,
    dispose() {
      chrome.runtime.onMessage.removeListener(messageListener);
    }
  };

  function waitForReadyState(platform) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();

      const checkInterval = setInterval(() => {
        if (isReady(platform)) {
          clearInterval(checkInterval);
          resolve();
          return;
        }

        if (Date.now() - startedAt >= READY_TIMEOUT_MS) {
          clearInterval(checkInterval);
          reject(
            new Error(
              "Timed out waiting for chat to be ready. Pause the queue, refresh the page, then resume."
            )
          );
        }
      }, READY_POLL_MS);
    });
  }

  async function processQueue() {
    if (isPaused || promptQueue.length === 0) {
      isProcessing = false;
      await persistState();
      return;
    }

    const platform = getPlatform();
    if (!platform) {
      lastError = "Unsupported chat page.";
      isProcessing = false;
      await persistState();
      return;
    }

    isProcessing = true;
    lastError = null;
    await persistState();

    try {
      await waitForReadyState(platform);
    } catch (error) {
      lastError = error.message;
      isProcessing = false;
      await persistState();
      return;
    }

    if (isPaused || promptQueue.length === 0) {
      isProcessing = false;
      await persistState();
      return;
    }

    const currentItem = promptQueue[0];
    const wrappedText = await wrapWithPersona(currentItem.text, currentItem.personaId);
    const success = await sendPrompt(platform, wrappedText);

    if (!success) {
      lastError = "Failed to send prompt. Check the chat page or use Retry.";
      isProcessing = false;
      await persistState();
      return;
    }

    const sentItem = promptQueue.shift();
    await logSuccessfulSend(sentItem);
    lastError = null;
    await persistState();

    if (promptQueue.length === 0) {
      isProcessing = false;
      await persistState();
      return;
    }

    try {
      await waitForReadyState(platform);
    } catch (error) {
      lastError = error.message;
      isProcessing = false;
      await persistState();
      return;
    }

    if (sentItem.pauseAfter) {
      isPaused = true;
      pauseReason = "checkpoint";
      isProcessing = false;
      playCheckpointChime();
      await persistState();
      return;
    }

    processQueue();
  }
})();
