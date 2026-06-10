globalThis.LLM_PLATFORMS = (() => {
  const SEND_SETTLE_MS = 500;

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
        'rich-textarea div[contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
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
        "button.send-button",
        'button[aria-label*="Send"]',
        'button[mattooltip*="Send"]'
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
    }
  };

  function isVisible(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    const style = window.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none";
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

  function getEditor(platform) {
    return platform.visibleEditor
      ? queryVisibleFirst(platform.editor)
      : queryFirst(platform.editor);
  }

  function getStopButton(platform) {
    return platform.visibleEditor
      ? queryVisibleFirst(platform.stopButton)
      : queryFirst(platform.stopButton);
  }

  function getEditorText(editor) {
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

  async function injectChatGPTText(editor, text) {
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
    editor.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      })
    );
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, SEND_SETTLE_MS));
  }

  function findVisibleSendButton(platform) {
    for (const selector of [].concat(platform.sendButton)) {
      for (const button of document.querySelectorAll(selector)) {
        if (
          isVisible(button) &&
          !button.disabled &&
          button.getAttribute("aria-disabled") !== "true"
        ) {
          return button;
        }
      }
    }

    return null;
  }

  async function waitForEnabledSendButton(platform, timeoutMs = 3000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const sendBtn = findVisibleSendButton(platform);
      if (sendBtn) return sendBtn;

      const chatgptBtn = platform.id === "chatgpt" ? queryFirst(platform.sendButton) : null;
      if (chatgptBtn && !chatgptBtn.disabled) return chatgptBtn;

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return null;
  }

  async function waitForSendConfirmation(platform, editor) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < 5000) {
      if (getStopButton(platform)) return true;
      if (editor && getEditorText(editor).length === 0) return true;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return !platform.strictSendConfirm;
  }

  async function sendPrompt(platform, text) {
    const editor = getEditor(platform);
    if (!editor) {
      console.error(`${platform.name} editor not found.`);
      return false;
    }

    if (platform.id === "chatgpt") {
      await injectChatGPTText(editor, text);
    } else {
      await injectProseMirrorText(editor, text);

      if (!editorContainsText(editor, text)) {
        console.error(`${platform.name} text injection failed.`);
        return false;
      }
    }

    const sendBtn = await waitForEnabledSendButton(platform);
    if (!sendBtn) {
      if (platform.id === "chatgpt") {
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

      console.error(`${platform.name} send button not found.`);
      return false;
    }

    sendBtn.click();
    return waitForSendConfirmation(platform, editor);
  }

  function isSupportedUrl(url) {
    if (!url) return false;
    return Object.values(PLATFORMS).some((platform) => url.includes(platform.host));
  }

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
