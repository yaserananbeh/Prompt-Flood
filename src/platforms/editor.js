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
