let promptQueue = [];
let isProcessing = false;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping_connection") {
    const isChatGPT = window.location.hostname.includes("chatgpt.com");
    const isGemini = window.location.hostname.includes("gemini.google.com");

    sendResponse({
      connected: isChatGPT || isGemini,
      site: isChatGPT ? "ChatGPT" : isGemini ? "Gemini" : "Unknown",
      queueLength: promptQueue.length,
      isProcessing: isProcessing,
      queue: promptQueue
    });

    return true;
  }

  if (request.action === "add_to_queue") {
    promptQueue.push(request.prompt);

    sendResponse({
      queueLength: promptQueue.length,
      queue: promptQueue
    });

    if (!isProcessing) {
      processQueue();
    }

    return true;
  }
});

async function processQueue() {
  if (promptQueue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const isChatGPT = window.location.hostname.includes("chatgpt.com");

  // 1. Wait until the LLM is ready
  await waitForReadyState(isChatGPT);

  // 2. Pull the next prompt from the queue
  const nextPrompt = promptQueue.shift();

  // 3. Inject and click send
  if (isChatGPT) {
    await handleChatGPT(nextPrompt);
  } else {
    await handleGemini(nextPrompt);
  }

  // 4. Wait, then process the next item
  setTimeout(processQueue, 3000);
}

function waitForReadyState(isChatGPT) {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      let isReady = false;

      if (isChatGPT) {
        // FIX: The Send button disappears when empty. 
        // We only check if the editor exists and the Stop button is absent.
        const editor = document.querySelector('#prompt-textarea');
        const stopBtn = document.querySelector('button[data-testid="stop-button"]');

        isReady = editor && !stopBtn;
      } else {
        const stopBtn = document.querySelector('button[aria-label*="Stop"]');
        const editor = document.querySelector('.ql-editor, rich-textarea div[contenteditable="true"]');

        isReady = editor && !stopBtn;
      }

      if (isReady) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 1000);
  });
}

async function handleChatGPT(text) {
  const editor = document.querySelector('#prompt-textarea');
  if (!editor) return;

  editor.focus();

  // Target the inner paragraph specifically for ProseMirror
  const pNode = editor.querySelector('p');
  if (pNode) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(pNode);
      range.collapse(false); // Move cursor to the end
      selection.removeAllRanges();
      selection.addRange(range);
  }

  // Simulate a native paste event
  const dataTransfer = new DataTransfer();
  dataTransfer.setData('text/plain', text);
  const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true
  });
  
  editor.dispatchEvent(pasteEvent);
  editor.dispatchEvent(new Event('input', { bubbles: true }));

  // Wait 500ms for React to swap the Voice button for the Send button
  await new Promise(resolve => setTimeout(resolve, 500));

  // Click Send
  const sendBtn = document.querySelector('button[data-testid="send-button"]');
  if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
  } else {
      // Fallback: Simulate pressing the Enter key
      editor.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13
      }));
  }
}

async function handleGemini(text) {
  const editor =
    document.querySelector(".ql-editor") ||
    document.querySelector('rich-textarea div[contenteditable="true"]');

  if (!editor) {
    console.error("Gemini editor not found.");
    return;
  }

  editor.focus();
  document.execCommand("insertText", false, text);
  editor.dispatchEvent(new Event("input", { bubbles: true }));

  await new Promise(resolve => setTimeout(resolve, 500));

  const sendBtn =
    document.querySelector(".send-button") ||
    document.querySelector('button[aria-label*="Send"]') ||
    document.querySelector('button[mattooltip*="Send"]');

  if (sendBtn) {
    sendBtn.click();
  } else {
    console.error("Gemini send button not found.");
  }
}