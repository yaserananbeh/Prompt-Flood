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
