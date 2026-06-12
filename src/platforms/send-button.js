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
