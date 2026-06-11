globalThis.LLM_PLATFORMS = (() => {
  const SEND_SETTLE_MS = 500;
  const ATTACH_SETTLE_MS = 800;
  const ATTACH_UPLOAD_TIMEOUT_MS = 60000;
  const ATTACH_PDF_UPLOAD_TIMEOUT_MS = 120000;
  const ATTACH_STRATEGY_STALL_MS = 20000;
  const ATTACH_SEND_TIMEOUT_MS = 15000;
  const ATTACH_PDF_SEND_TIMEOUT_MS = 30000;

  const PLATFORMS = {
    chatgpt: {
      id: "chatgpt",
      name: "ChatGPT",
      host: "chatgpt.com",
      editor: "#prompt-textarea",
      stopButton: 'button[data-testid="stop-button"]',
      sendButton: 'button[data-testid="send-button"]',
      visibleEditor: false,
      supportsAttachments: true,
      attachButton: [
        'button[data-testid="composer-plus-btn"]',
        'button[aria-label*="Attach" i]',
        'button[aria-label*="Add" i]'
      ],
      fileInput: 'input[type="file"]',
      attachmentReady: [
        '[data-testid="attachment-preview"]',
        '[data-testid="file-attachment"]',
        'button[aria-label*="Remove file" i]',
        '[class*="attachment"]'
      ],
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
      supportsAttachments: true,
      attachButton: [
        'button[aria-label*="Upload" i]',
        'button[aria-label*="Attach" i]',
        'button[aria-label*="Add file" i]',
        'button.upload-card-button'
      ],
      fileInput: 'input[type="file"]',
      attachmentReady: [
        'img[alt*="upload" i]',
        '[data-test-id="file-preview"]',
        '.file-preview',
        'button[aria-label*="Remove" i]'
      ],
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
      supportsAttachments: true,
      attachButton: [
        'button[aria-label*="Upload" i]',
        'button[aria-label*="Attach" i]',
        'button[aria-label*="Add content" i]',
        'button[data-testid="composer-action-file-upload"]'
      ],
      fileInput: 'input[type="file"]',
      attachmentReady: [
        '[data-testid="file-thumbnail"]',
        '[data-testid="file-chip"]',
        'button[aria-label*="Remove file" i]',
        '.attachment-preview'
      ],
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

  function isSendButtonEnabled(button) {
    return (
      Boolean(button) &&
      !button.disabled &&
      button.getAttribute("aria-disabled") !== "true"
    );
  }

  function findEnabledSendButton(platform) {
    for (const selector of [].concat(platform.sendButton)) {
      for (const button of document.querySelectorAll(selector)) {
        if (!isSendButtonEnabled(button)) continue;

        if (platform.visibleEditor && !isVisible(button)) continue;

        return button;
      }
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

  async function waitForSendConfirmation(platform, editor, { allowEmptyEditor = false } = {}) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < 5000) {
      if (getStopButton(platform)) return true;

      if (editor && getEditorText(editor).length === 0) {
        if (allowEmptyEditor && Date.now() - startedAt < 400) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          continue;
        }

        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return !platform.strictSendConfirm;
  }

  function isPdfFile(file) {
    return (
      file.type === "application/pdf" ||
      (file.name || "").toLowerCase().endsWith(".pdf")
    );
  }

  function isImageFile(file) {
    return (file.type || "").startsWith("image/");
  }

  function filesIncludePdf(files) {
    return files.some(isPdfFile);
  }

  function filesAreAllImages(files) {
    return files.length > 0 && files.every(isImageFile);
  }

  function getChatGPTDropTarget(editor) {
    return (
      editor.closest("form") ||
      document.querySelector("main") ||
      editor.parentElement ||
      editor
    );
  }

  function rankChatGPTFileInputs(inputs, files = []) {
    const hasPdf = filesIncludePdf(files);

    return inputs
      .map((input) => {
        const accept = (input.getAttribute("accept") || "").toLowerCase();
        let score = 0;

        if (hasPdf) {
          if (accept.includes(".pdf")) score += 12;
          if (accept.includes("pdf")) score += 10;
          if (accept.includes("*")) score += 8;
          if (!accept) score += 4;
          if (accept.match(/^image\/\*$/)) score -= 10;
        } else if (accept.includes("image")) {
          score += 5;
        }

        return { input, score };
      })
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.input);
  }

  function findFileInput(platform, files = []) {
    const inputs = [...document.querySelectorAll("input[type='file']")];
    if (!inputs.length) return null;

    if (platform.id === "chatgpt") {
      return rankChatGPTFileInputs(inputs, files)[0] || null;
    }

    const selectors = [].concat(platform.fileInput || "input[type='file']");

    for (const selector of selectors) {
      for (const input of document.querySelectorAll(selector)) {
        if (input instanceof HTMLInputElement) {
          return input;
        }
      }
    }

    return null;
  }

  function findChatGPTFileInput(inputs, files = []) {
    return rankChatGPTFileInputs(inputs, files)[0] || inputs[0] || null;
  }

  function removeComposerAttachments(platform) {
    const removeButtons = document.querySelectorAll(
      'button[aria-label*="Remove file" i], button[aria-label*="Remove attachment" i], button[aria-label*="Remove image" i]'
    );

    for (const button of removeButtons) {
      button.click();
    }
  }

  function hasBrokenAttachment(platform) {
    for (const selector of [].concat(platform.attachmentReady || [])) {
      for (const node of document.querySelectorAll(selector)) {
        for (const img of node.querySelectorAll("img")) {
          if (
            img.complete &&
            img.naturalWidth === 0 &&
            img.src &&
            !img.src.includes("svg")
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  function findAttachmentMenuAction(platform) {
    const labels = platform.id === "chatgpt"
      ? [/photo/i, /file/i, /upload/i, /attach/i]
      : [/upload/i, /file/i, /attach/i, /pdf/i, /image/i];

    const candidates = document.querySelectorAll(
      '[role="menuitem"], [role="menuitemradio"], button, a'
    );

    for (const node of candidates) {
      if (!isVisible(node)) continue;

      const text = `${node.textContent || ""} ${node.getAttribute("aria-label") || ""}`;
      if (labels.some((pattern) => pattern.test(text))) {
        return node;
      }
    }

    return null;
  }

  async function clickAttachButton(platform) {
    const button = queryVisibleFirst(platform.attachButton);
    if (!button) return false;

    button.click();
    await new Promise((resolve) => setTimeout(resolve, 300));

    const menuAction = findAttachmentMenuAction(platform);
    if (menuAction) {
      menuAction.click();
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return true;
  }

  async function waitForFileInput(platform, timeoutMs = 3000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const input = findFileInput(platform);
      if (input) return input;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return null;
  }

  function countAttachmentIndicators(platform) {
    const selectors = [].concat(platform.attachmentReady || []);
    let count = 0;

    for (const selector of selectors) {
      count += document.querySelectorAll(selector).length;
    }

    return count;
  }

  function hasAttachmentLoading(platform) {
    const selectors = [].concat(platform.attachmentReady || []);

    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        if (
          node.querySelector(
            '[aria-busy="true"], .animate-spin, [class*="spinner" i], [class*="loading" i], [role="progressbar"]'
          ) ||
          node.matches('[aria-busy="true"], .animate-spin, [class*="spinner" i], [class*="loading" i]')
        ) {
          return true;
        }

        for (const img of node.querySelectorAll("img")) {
          if (!img.complete || img.naturalWidth === 0) {
            return true;
          }
        }
      }
    }

    const sendBtn = queryFirst(platform.sendButton);
    if (countAttachmentIndicators(platform) > 0 && sendBtn?.disabled) {
      return true;
    }

    return false;
  }

  function getAttachmentWaitOptions(platform, files) {
    const hasPdf = filesIncludePdf(files);

    if (platform.id === "chatgpt" && hasPdf) {
      return {
        timeoutMs: ATTACH_PDF_UPLOAD_TIMEOUT_MS,
        strategyTimeoutMs: ATTACH_STRATEGY_STALL_MS
      };
    }

    return {
      timeoutMs: ATTACH_UPLOAD_TIMEOUT_MS,
      strategyTimeoutMs: ATTACH_STRATEGY_STALL_MS
    };
  }

  async function waitForAttachmentsProcessed(
    platform,
    expectedCount = 1,
    { timeoutMs = ATTACH_UPLOAD_TIMEOUT_MS, strategyTimeoutMs = ATTACH_STRATEGY_STALL_MS } = {}
  ) {
    const startedAt = Date.now();
    let sawPreview = false;
    let brokenSince = null;

    while (Date.now() - startedAt < timeoutMs) {
      const previewCount = countAttachmentIndicators(platform);
      if (previewCount >= expectedCount) {
        sawPreview = true;
      }

      if (
        sawPreview &&
        hasAttachmentLoading(platform) &&
        Date.now() - startedAt > strategyTimeoutMs &&
        !findEnabledSendButton(platform)
      ) {
        console.error(`${platform.name} attachment upload stalled.`);
        return false;
      }

      if (hasBrokenAttachment(platform)) {
        if (!brokenSince) brokenSince = Date.now();
        if (Date.now() - brokenSince > 2000) {
          console.error(`${platform.name} attachment failed to upload.`);
          return false;
        }
      } else {
        brokenSince = null;
      }

      const sendBtn = findEnabledSendButton(platform);
      const uploadSettled = sawPreview && !hasAttachmentLoading(platform) && Boolean(sendBtn);

      if (uploadSettled) {
        await new Promise((resolve) => setTimeout(resolve, ATTACH_SETTLE_MS));

        if (!hasAttachmentLoading(platform) && findEnabledSendButton(platform)) {
          return true;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    console.error(`${platform.name} attachment upload timed out.`);
    return false;
  }

  function setInputFiles(input, files) {
    const dataTransfer = new DataTransfer();

    for (const file of files) {
      dataTransfer.items.add(file);
    }

    const filesSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "files"
    )?.set;

    if (filesSetter) {
      filesSetter.call(input, dataTransfer.files);
    } else {
      input.files = dataTransfer.files;
    }
  }

  async function pasteImagesToEditor(editor, files) {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length || imageFiles.length !== files.length) {
      return false;
    }

    editor.focus();
    await new Promise((resolve) => setTimeout(resolve, 200));

    for (const file of imageFiles) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      editor.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertFromPaste",
          dataTransfer
        })
      );
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
          inputType: "insertFromPaste"
        })
      );
      editor.dispatchEvent(new Event("input", { bubbles: true }));

      await new Promise((resolve) => setTimeout(resolve, ATTACH_SETTLE_MS));
    }

    return true;
  }

  async function uploadViaFileInput(input, files) {
    if (!input) return false;

    setInputFiles(input, files);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  async function dropFilesOnComposer(editor, files) {
    const dataTransfer = new DataTransfer();

    for (const file of files) {
      dataTransfer.items.add(file);
    }

    const targets = [
      getChatGPTDropTarget(editor),
      editor.closest("form"),
      editor,
      document.querySelector("main"),
      document.body
    ].filter(Boolean);

    const seen = new Set();

    for (const target of targets) {
      if (seen.has(target)) continue;
      seen.add(target);

      for (const type of ["dragenter", "dragover", "drop"]) {
        target.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer
          })
        );
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    }

    return true;
  }

  async function beginChatGPTAttachmentUpload(platform, files) {
    const editor = getEditor(platform);
    if (!editor) return false;

    removeComposerAttachments(platform);

    if (filesAreAllImages(files)) {
      return pasteImagesToEditor(editor, files);
    }

    const input = findFileInput(platform, files);
    if (!input) {
      console.error("ChatGPT file input not found.");
      return false;
    }

    return uploadViaFileInput(input, files);
  }

  function getChatGPTFileInputStrategies(files) {
    const inputs = rankChatGPTFileInputs(
      [...document.querySelectorAll("input[type='file']")],
      files
    );

    return inputs.map(
      (input) => async () => uploadViaFileInput(input, files)
    );
  }

  function getAttachmentStrategies(platform, files) {
    const editor = getEditor(platform);

    if (platform.id === "chatgpt" && editor) {
      if (filesAreAllImages(files)) {
        return [
          async () => pasteImagesToEditor(editor, files),
          async (activePlatform) => {
            const input = findFileInput(activePlatform, files);
            return uploadViaFileInput(input, files);
          },
          async () => dropFilesOnComposer(editor, files)
        ];
      }

      if (filesIncludePdf(files)) {
        return [
          async () => dropFilesOnComposer(editor, files),
          async (activePlatform) => {
            const plusButton = queryVisibleFirst(activePlatform.attachButton);
            if (plusButton) {
              plusButton.click();
              await new Promise((resolve) => setTimeout(resolve, 400));
            }

            const input = findFileInput(activePlatform, files);
            return uploadViaFileInput(input, files);
          },
          ...getChatGPTFileInputStrategies(files)
        ];
      }
    }

    return [async (activePlatform) => beginAttachmentUpload(activePlatform, files)];
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

  async function beginAttachmentUpload(platform, files) {
    if (!files?.length) return true;

    if (!platform.supportsAttachments) {
      console.error(`${platform.name} does not support attachments.`);
      return false;
    }

    if (platform.id === "chatgpt") {
      return beginChatGPTAttachmentUpload(platform, files);
    }

    let input = findFileInput(platform, files);

    if (!input) {
      await clickAttachButton(platform);
      input = await waitForFileInput(platform);
    }

    if (!input) {
      const editor = getEditor(platform);
      if (editor && filesAreAllImages(files)) {
        return pasteImagesToEditor(editor, files);
      }

      console.error(`${platform.name} file input not found.`);
      return false;
    }

    return uploadViaFileInput(input, files);
  }

  async function attachFiles(platform, files) {
    const started = await beginAttachmentUpload(platform, files);
    if (!started) return false;
    return waitForAttachmentsProcessed(platform, files.length, getAttachmentWaitOptions(platform, files));
  }

  async function sendPrompt(platform, text, { files = [] } = {}) {
    const trimmedText = (text || "").trim();

    if (!trimmedText && !files.length) {
      console.error(`${platform.name} prompt is empty.`);
      return false;
    }

    const editor = getEditor(platform);
    if (!editor) {
      console.error(`${platform.name} editor not found.`);
      return false;
    }

    if (files.length > 0) {
      let processed = false;
      const waitOptions = getAttachmentWaitOptions(platform, files);
      const deferTextUntilUpload =
        platform.id === "chatgpt" && filesIncludePdf(files) && Boolean(trimmedText);

      for (const strategy of getAttachmentStrategies(platform, files)) {
        removeComposerAttachments(platform);

        const started = await strategy(platform, files);
        if (!started) continue;

        if (trimmedText && !deferTextUntilUpload) {
          const injected = await injectPromptText(platform, editor, trimmedText);
          if (!injected) {
            console.error(`${platform.name} text injection failed.`);
            continue;
          }
        }

        processed = await waitForAttachmentsProcessed(
          platform,
          files.length,
          waitOptions
        );

        if (processed && deferTextUntilUpload) {
          const injected = await injectPromptText(platform, editor, trimmedText);
          if (!injected) {
            console.error(`${platform.name} text injection failed.`);
            processed = false;
            continue;
          }

          await waitForEnabledSendButton(platform, ATTACH_PDF_SEND_TIMEOUT_MS);
        }

        if (processed) break;
      }

      if (!processed) {
        console.error(`${platform.name} attachment upload failed.`);
        return false;
      }
    } else if (trimmedText) {
      const injected = await injectPromptText(platform, editor, trimmedText);
      if (!injected) {
        console.error(`${platform.name} text injection failed.`);
        return false;
      }
    }

    const sendTimeoutMs = filesIncludePdf(files)
      ? ATTACH_PDF_SEND_TIMEOUT_MS
      : files.length
        ? ATTACH_SEND_TIMEOUT_MS
        : 3000;
    const sendBtn = await waitForEnabledSendButton(platform, sendTimeoutMs);
    if (!sendBtn) {
      if (
        !files.length &&
        (platform.id === "chatgpt" || isTextareaEditor(editor))
      ) {
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
    return waitForSendConfirmation(platform, editor, {
      allowEmptyEditor: !trimmedText && files.length > 0
    });
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
    beginAttachmentUpload,
    attachFiles,
    sendPrompt,
    isSupportedUrl
  };
})();
