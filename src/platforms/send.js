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
