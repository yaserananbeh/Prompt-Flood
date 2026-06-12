globalThis.LLM_PLATFORMS = (() => {
// @module platforms/constants — timing values for send waits
  const SEND_SETTLE_MS = 500;

// @module platforms/config — PLATFORMS selector definitions per LLM
  const PLATFORMS = {
    chatgpt: {
      id: "chatgpt",
      name: "ChatGPT",
      host: "chatgpt.com",
      editor: "#prompt-textarea",
      stopButton: 'button[data-testid="stop-button"]',
      sendButton: 'button[data-testid="send-button"]',
      visibleEditor: false,
      getChatId(pathname) {
        const match = pathname.match(/\/c\/([a-f0-9-]+)/i);
        return match ? match[1] : null;
      }
    },
    gemini: {
      id: "gemini",
      name: "Gemini",
      host: "gemini.google.com",
      editor: [
        "rich-textarea div[contenteditable='true']",
        "rich-textarea .ql-editor",
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"][aria-label*="Ask Gemini" i]',
        'div[contenteditable="true"][aria-label*="prompt" i]',
        'div[contenteditable="true"][aria-label*="message" i]',
        ".ql-editor[contenteditable='true']"
      ],
      stopButton: [
        'button[aria-label="Stop response"]',
        'button[aria-label*="Stop"]',
        'button[aria-label*="Cancel"]'
      ],
      sendButton: [
        'button[aria-label="Send message"]',
        'button[aria-label*="Send message"]',
        'button[aria-label*="Send" i]',
        "button.send-button",
        'button[mattooltip*="Send"]',
        'button[data-test-id="send-button"]'
      ],
      visibleEditor: true,
      strictSendConfirm: true,
      getChatId(pathname) {
        const match = pathname.match(/\/app\/([^/?#]+)/i);
        return match ? match[1] : null;
      }
    },
    claude: {
      id: "claude",
      name: "Claude",
      host: "claude.ai",
      editor: [
        "div.ProseMirror[contenteditable='true']",
        '[data-placeholder][contenteditable="true"]',
        '[data-testid="composer-input"]',
        '[aria-label*="Message Claude" i][contenteditable="true"]',
        'div[role="textbox"][contenteditable="true"]'
      ],
      stopButton: [
        'button[aria-label*="Stop" i]',
        'button[aria-label*="Cancel" i]'
      ],
      sendButton: [
        'button[aria-label="Send Message"]',
        'button[aria-label="Send message"]',
        'button[data-testid="send-button"]',
        'button[type="submit"]'
      ],
      visibleEditor: true,
      getChatId(pathname) {
        const match = pathname.match(/\/chat\/([a-f0-9-]+)/i);
        return match ? match[1] : null;
      }
    },
    kimi: {
      id: "kimi",
      name: "Kimi",
      host: "kimi.com",
      editor: [
        '.chat-input-editor[data-lexical-editor="true"]',
        '.chat-input-editor[contenteditable="true"]',
        '[role="textbox"].chat-input-editor',
        'div.chat-input-editor[contenteditable="true"]'
      ],
      stopButton: [
        ".send-button-container.stop",
        '.send-button-container:has(svg[name="stop"])'
      ],
      sendButton: ".send-button-container:not(.disabled):not(.stop)",
      visibleEditor: true,
      inputType: "lexical",
      getChatId(pathname) {
        const match = pathname.match(/\/chat\/([a-z0-9-]+)/i);
        return match ? match[1] : null;
      }
    },
    deepseek: {
      id: "deepseek",
      name: "DeepSeek",
      host: "chat.deepseek.com",
      editor: [
        "#chat-input",
        'textarea[placeholder*="DeepSeek" i]',
        "textarea.ds-scroll-area",
        "form textarea",
        "textarea"
      ],
      stopButton: [
        'button[aria-label*="Stop" i]',
        'button[aria-label*="Cancel" i]',
        'div[role="button"].ds-icon-button:has(svg path[d^="M2 4.88"])'
      ],
      sendButton: [
        'button[aria-label="Send message"]',
        'button[aria-label*="Send" i]',
        '[data-testid="send-button"]',
        'button[type="submit"]',
        'div[role="button"].ds-icon-button'
      ],
      visibleEditor: true,
      inputType: "textarea",
      getChatId(pathname) {
        const match = pathname.match(/\/a\/chat\/s\/([a-z0-9-]+)/i);
        return match ? match[1] : null;
      }
    }
  };

// @module platforms/dom — shadow DOM query helpers
  function isVisible(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    const style = window.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function collectDeepRoots(root = document, roots = [], visited = new Set()) {
    if (!root || visited.has(root)) return roots;

    visited.add(root);
    roots.push(root);

    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot) {
        collectDeepRoots(element.shadowRoot, roots, visited);
      }
    }

    return roots;
  }

  function queryAllDeep(selector, root = document) {
    const nodes = [];

    for (const scope of collectDeepRoots(root)) {
      nodes.push(...scope.querySelectorAll(selector));
    }

    return nodes;
  }

  function queryFirstDeep(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];

    for (const selector of list) {
      for (const scope of collectDeepRoots(document)) {
        const node = scope.querySelector(selector);
        if (node) return node;
      }
    }

    return null;
  }

  function queryVisibleFirstDeep(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];

    for (const selector of list) {
      for (const node of queryAllDeep(selector)) {
        if (isVisible(node)) return node;
      }
    }

    return null;
  }

  function queryFirst(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];

    for (const selector of list) {
      const node = document.querySelector(selector);
      if (node) return node;
    }

    return null;
  }

  function queryVisibleFirst(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];

    for (const selector of list) {
      for (const node of document.querySelectorAll(selector)) {
        if (isVisible(node)) return node;
      }
    }

    return null;
  }

// @module platforms/editor — editor/stop detection, isReady, detectPlatform
  function getEditor(platform) {
    if (platform.id === "gemini") {
      return queryVisibleFirstDeep(platform.editor);
    }

    return platform.visibleEditor
      ? queryVisibleFirst(platform.editor)
      : queryFirst(platform.editor);
  }

  function getStopButton(platform) {
    if (platform.id === "gemini") {
      return queryVisibleFirstDeep(platform.stopButton);
    }

    return platform.visibleEditor
      ? queryVisibleFirst(platform.stopButton)
      : queryFirst(platform.stopButton);
  }

  function isTextareaEditor(editor) {
    return editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement;
  }

  function getEditorText(editor) {
    if (isTextareaEditor(editor)) {
      return (editor.value || "").trim();
    }

    return (editor.innerText || editor.textContent || "").trim();
  }

  function editorContainsText(editor, text) {
    const current = getEditorText(editor);
    const expected = text.trim();

    if (!expected) return false;
    if (current === expected) return true;

    const sample = expected.slice(0, Math.min(30, expected.length));
    return sample.length > 0 && current.includes(sample);
  }

  function detectPlatform() {
    const host = window.location.hostname;

    if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) {
      return PLATFORMS.chatgpt;
    }

    for (const platform of Object.values(PLATFORMS)) {
      if (host.includes(platform.host)) {
        return platform;
      }
    }

    return null;
  }

  function isReady(platform) {
    const editor = getEditor(platform);
    const stopBtn = getStopButton(platform);
    return Boolean(editor && !stopBtn);
  }

// @module platforms/inject — generic text injection strategies
  async function injectLexicalText(editor, text) {
    editor.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);

    let inserted = false;

    try {
      inserted = document.execCommand("insertText", false, text);
    } catch (_error) {
      inserted = false;
    }

    if (!inserted) {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", text);
      editor.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true
        })
      );
      editor.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: text
        })
      );
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }

    await new Promise((resolve) => setTimeout(resolve, SEND_SETTLE_MS));
    editor.focus();
  }

  async function injectProseMirrorText(editor, text) {
    editor.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);

    let inserted = false;

    try {
      inserted = document.execCommand("insertText", false, text);
    } catch (_error) {
      inserted = false;
    }

    if (!inserted) {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", text);
      editor.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true
        })
      );
    }

    if (!editorContainsText(editor, text)) {
      const textNode = document.createTextNode(text);

      if (selection && selection.rangeCount > 0) {
        const insertRange = selection.getRangeAt(0);
        insertRange.insertNode(textNode);
        insertRange.setStartAfter(textNode);
        insertRange.collapse(true);
      } else {
        editor.appendChild(textNode);
      }
    }

    editor.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text
      })
    );
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, SEND_SETTLE_MS));
    editor.focus();
  }

  async function injectTextareaText(editor, text) {
    editor.focus();

    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(editor, text);
    } else {
      editor.value = text;
    }

    editor.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        composed: true,
        data: text
      })
    );
    editor.dispatchEvent(new Event("change", { bubbles: true }));
    editor.setSelectionRange(text.length, text.length);

    await new Promise((resolve) => setTimeout(resolve, SEND_SETTLE_MS));
    editor.focus();
  }

  async function injectChatGPTText(editor, text) {
    editor.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);

    let inserted = false;

    try {
      inserted = document.execCommand("insertText", false, text);
    } catch (_error) {
      inserted = false;
    }

    if (!inserted) {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", text);
      editor.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true
        })
      );
    }

    editor.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text
      })
    );
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, SEND_SETTLE_MS));
  }

// @module platforms/send-button — send button and confirmation waits
  function isSendButtonEnabled(button) {
    return (
      Boolean(button) &&
      !button.disabled &&
      button.getAttribute("aria-disabled") !== "true"
    );
  }

  function findEnabledSendButton(platform) {
    const selectors = [].concat(platform.sendButton);
    const nodes =
      platform.id === "gemini"
        ? selectors.flatMap((selector) => queryAllDeep(selector))
        : selectors.flatMap((selector) => [...document.querySelectorAll(selector)]);

    for (const button of nodes) {
      if (!isSendButtonEnabled(button)) continue;

      if (platform.visibleEditor && !isVisible(button)) continue;

      return button;
    }

    return null;
  }

  async function waitForEnabledSendButton(platform, timeoutMs = 3000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const sendBtn = findEnabledSendButton(platform);
      if (sendBtn) return sendBtn;

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return null;
  }

  async function waitForSendConfirmation(platform, editor) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < 8000) {
      if (getStopButton(platform)) return true;

      const textRemaining = editor ? getEditorText(editor).length > 0 : false;

      if (editor && !textRemaining) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return !platform.strictSendConfirm;
  }

// @module platforms/prompt-inject — Gemini text inject and pre-send guards
  async function injectGeminiText(editor, text) {
    const target = editor.closest(".ql-editor") || editor;
    target.focus();
    await new Promise((resolve) => setTimeout(resolve, 150));

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);

    let inserted = false;

    try {
      inserted = document.execCommand("insertText", false, text);
    } catch (_error) {
      inserted = false;
    }

    if (!inserted && !editorContainsText(target, text)) {
      const textNode = document.createTextNode(text);
      if (selection && selection.rangeCount > 0) {
        const insertRange = selection.getRangeAt(0);
        insertRange.insertNode(textNode);
        insertRange.setStartAfter(textNode);
        insertRange.collapse(true);
      } else {
        target.appendChild(textNode);
      }
    }

    target.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        composed: true,
        inputType: "insertText",
        data: text
      })
    );
    target.dispatchEvent(new Event("input", { bubbles: true, composed: true }));

    await new Promise((resolve) => setTimeout(resolve, SEND_SETTLE_MS));
    return editorContainsText(target, text) || editorContainsText(editor, text);
  }

  async function ensurePromptTextBeforeSend(platform, editor, text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return true;

    if (editorContainsText(editor, trimmed)) {
      return true;
    }

    if (platform.id === "gemini") {
      if (!(await injectGeminiText(editor, trimmed))) {
        console.error(`${platform.name} text injection failed.`);
        return false;
      }
    } else {
      const injected = await injectPromptText(platform, editor, trimmed);
      if (!injected || !editorContainsText(editor, trimmed)) {
        console.error(`${platform.name} text injection failed.`);
        return false;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, SEND_SETTLE_MS));
    return true;
  }

  async function injectPromptText(platform, editor, text) {
    if (platform.id === "chatgpt") {
      await injectChatGPTText(editor, text);
      return true;
    }

    if (isTextareaEditor(editor)) {
      await injectTextareaText(editor, text);
      return editorContainsText(editor, text);
    }

    if (platform.inputType === "lexical") {
      await injectLexicalText(editor, text);
      return true;
    }

    await injectProseMirrorText(editor, text);
    return editorContainsText(editor, text);
  }

// @module platforms/send — sendPrompt
  async function sendPrompt(platform, text) {
    const trimmedText = (text || "").trim();

    if (!trimmedText) {
      console.error(`${platform.name} prompt is empty.`);
      return false;
    }

    const editor = getEditor(platform);
    if (!editor) {
      console.error(`${platform.name} editor not found.`);
      return false;
    }

    if (!(await ensurePromptTextBeforeSend(platform, editor, trimmedText))) {
      return false;
    }

    const sendBtn = await waitForEnabledSendButton(platform, 3000);
    if (!sendBtn) {
      if (platform.id === "chatgpt" || isTextareaEditor(editor)) {
        editor.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key: "Enter",
            code: "Enter",
            keyCode: 13
          })
        );
        return waitForSendConfirmation(platform, editor);
      }

      console.error(`${platform.name} send button not enabled.`);
      return false;
    }

    sendBtn.click();
    return waitForSendConfirmation(platform, editor);
  }

  function isSupportedUrl(url) {
    if (!url) return false;
    return Object.values(PLATFORMS).some((platform) => url.includes(platform.host));
  }

// @module platforms/api — public LLM_PLATFORMS exports
  return {
    PLATFORMS,
    detectPlatform,
    isReady,
    getEditor,
    getStopButton,
    sendPrompt,
    isSupportedUrl
  };
})();
