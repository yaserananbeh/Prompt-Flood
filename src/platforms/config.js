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
