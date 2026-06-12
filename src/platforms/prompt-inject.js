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
