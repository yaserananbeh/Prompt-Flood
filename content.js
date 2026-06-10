(() => {
  const CONTENT_VERSION = 2;

  if (globalThis.__LLM_PROMPT_QUEUE__?.version >= CONTENT_VERSION) {
    return;
  }

  if (globalThis.__LLM_PROMPT_QUEUE__?.dispose) {
    globalThis.__LLM_PROMPT_QUEUE__.dispose();
  }

  const SELECTORS = {
    chatgpt: {
      editor: "#prompt-textarea",
      stopButton: 'button[data-testid="stop-button"]',
      sendButton: 'button[data-testid="send-button"]'
    },
    gemini: {
      editor: [".ql-editor", 'rich-textarea div[contenteditable="true"]'],
      stopButton: 'button[aria-label*="Stop"]',
      sendButton: [
        ".send-button",
        'button[aria-label*="Send"]',
        'button[mattooltip*="Send"]'
      ]
    }
  };

  const READY_TIMEOUT_MS = 120000;
  const READY_POLL_MS = 1000;
  const SEND_SETTLE_MS = 500;

  let tabId = null;
  let promptQueue = [];
  let isProcessing = false;
  let isPaused = false;
  let lastError = null;

  function queryFirst(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];

    for (const selector of list) {
      const node = document.querySelector(selector);
      if (node) {
        return node;
      }
    }

    return null;
  }

  function isChatGPTSite() {
    return window.location.hostname.includes("chatgpt.com");
  }

  function isGeminiSite() {
    return window.location.hostname.includes("gemini.google.com");
  }

  function getSiteName() {
    if (isChatGPTSite()) return "ChatGPT";
    if (isGeminiSite()) return "Gemini";
    return "Unknown";
  }

  function getTabId() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "get_tab_id" }, (response) => {
        resolve(response?.tabId ?? null);
      });
    });
  }

  function storageKey() {
    return `queueState_${tabId}`;
  }

  async function loadState() {
    if (!tabId) return;

    const data = await chrome.storage.local.get(storageKey());
    const state = data[storageKey()];

    if (!state) return;

    promptQueue = Array.isArray(state.queue) ? state.queue : [];
    isPaused = Boolean(state.paused);
    lastError = state.lastError || null;
  }

  async function persistState() {
    if (!tabId) return;

    await chrome.storage.local.set({
      [storageKey()]: {
        queue: promptQueue,
        paused: isPaused,
        lastError
      }
    });
  }

  function buildStateResponse() {
    const connected = isChatGPTSite() || isGeminiSite();

    return {
      connected,
      site: getSiteName(),
      queue: [...promptQueue],
      queueLength: promptQueue.length,
      isProcessing,
      isPaused,
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

  async function init() {
    tabId = await getTabId();
    await loadState();

    if (promptQueue.length > 0 && !isPaused && !isProcessing) {
      processQueue();
    }
  }

  const initPromise = init();

  async function handleMessage(request) {
    await initPromise;

    switch (request.action) {
      case "ping_connection":
        return successResponse();

      case "add_to_queue": {
        const prompt = request.prompt?.trim();
        if (!prompt) {
          return errorResponse("Prompt cannot be empty.");
        }

        promptQueue.push(prompt);
        await persistState();

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

        promptQueue.splice(index + 1, 0, promptQueue[index]);
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

        promptQueue[index] = prompt;
        await persistState();
        return successResponse();
      }

      case "clear_queue":
        promptQueue = [];
        isProcessing = false;
        lastError = null;
        await persistState();
        return successResponse();

      case "pause_queue":
        isPaused = true;
        await persistState();
        return successResponse();

      case "resume_queue":
        isPaused = false;
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

  async function processQueue() {
    if (isPaused || promptQueue.length === 0) {
      isProcessing = false;
      await persistState();
      return;
    }

    isProcessing = true;
    lastError = null;
    await persistState();

    const isChatGPT = isChatGPTSite();

    try {
      await waitForReadyState(isChatGPT);
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

    const nextPrompt = promptQueue[0];
    const success = isChatGPT
      ? await handleChatGPT(nextPrompt)
      : await handleGemini(nextPrompt);

    if (success) {
      promptQueue.shift();
      lastError = null;
      await persistState();
      processQueue();
      return;
    }

    lastError = "Failed to send prompt. Check the chat page or use Retry.";
    isProcessing = false;
    await persistState();
  }

  function waitForReadyState(isChatGPT) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();

      const checkInterval = setInterval(() => {
        const selectors = isChatGPT ? SELECTORS.chatgpt : SELECTORS.gemini;
        const editor = queryFirst(selectors.editor);
        const stopBtn = queryFirst(selectors.stopButton);
        const isReady = Boolean(editor && !stopBtn);

        if (isReady) {
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

  async function injectText(editor, text) {
    editor.focus();

    const pNode = editor.querySelector("p");
    if (pNode) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(pNode);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", text);
    const pasteEvent = new ClipboardEvent("paste", {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true
    });

    editor.dispatchEvent(pasteEvent);
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, SEND_SETTLE_MS));
  }

  async function clickSend(editor, sendButtonSelector) {
    const sendBtn = queryFirst(sendButtonSelector);

    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
      return true;
    }

    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
        code: "Enter",
        keyCode: 13
      })
    );

    return true;
  }

  async function handleChatGPT(text) {
    const editor = queryFirst(SELECTORS.chatgpt.editor);
    if (!editor) {
      console.error("ChatGPT editor not found.");
      return false;
    }

    await injectText(editor, text);
    return clickSend(editor, SELECTORS.chatgpt.sendButton);
  }

  async function handleGemini(text) {
    const editor = queryFirst(SELECTORS.gemini.editor);
    if (!editor) {
      console.error("Gemini editor not found.");
      return false;
    }

    await injectText(editor, text);
    return clickSend(editor, SELECTORS.gemini.sendButton);
  }
})();
