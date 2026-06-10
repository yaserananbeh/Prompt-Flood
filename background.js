const DEFAULT_PERSONAS = [
  {
    id: "academic",
    name: "Academic tone",
    prefix: "Respond in a formal academic tone. ",
    suffix: ""
  },
  {
    id: "preserve-voice",
    name: "Preserve voice",
    prefix: "",
    suffix:
      "\n\nPreserve the original writer's voice and keep the tone natural."
  }
];

const HISTORY_KEY = "promptHistory";
const PERSONAS_KEY = "personas";
const MAX_HISTORY = 500;

const SUPPORTED_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "gemini.google.com",
  "claude.ai",
  "kimi.com",
  "chat.deepseek.com",
  "perplexity.ai"
];

function isSupportedUrl(url) {
  return Boolean(url && SUPPORTED_HOSTS.some((host) => url.includes(host)));
}

async function ensureDefaultPersonas() {
  const data = await chrome.storage.local.get(PERSONAS_KEY);
  if (!Array.isArray(data[PERSONAS_KEY]) || data[PERSONAS_KEY].length === 0) {
    await chrome.storage.local.set({ [PERSONAS_KEY]: DEFAULT_PERSONAS });
  }
}

async function appendHistoryEntry(entry) {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  const history = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
  history.unshift(entry);

  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY;
  }

  await chrome.storage.local.set({ [HISTORY_KEY]: history });
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["platforms.js", "content.js"]
    });
  } catch (_error) {
    // Script may already be injected via manifest.
  }
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError || !response) {
        resolve({ ok: false, connected: false, error: "Connection failed." });
        return;
      }

      resolve(response);
    });
  });
}

async function relayToTab(tabId, payload) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await sendTabMessage(tabId, payload);

    if (payload.action === "ping_connection" && response?.connected) {
      return response;
    }

    if (payload.action !== "ping_connection" && response?.ok === true) {
      return response;
    }

    await injectContentScript(tabId);
    await new Promise((resolve) => setTimeout(resolve, 200 + attempt * 200));
  }

  return { ok: false, connected: false, error: "Connection failed." };
}

async function broadcastPrompt(payload, tabIds) {
  if (!Array.isArray(tabIds) || tabIds.length === 0) {
    return [];
  }

  const results = [];

  for (const tabId of tabIds) {
    let tab;

    try {
      tab = await chrome.tabs.get(tabId);
    } catch (_error) {
      continue;
    }

    if (!tab?.id || !isSupportedUrl(tab.url)) {
      continue;
    }

    await injectContentScript(tab.id);
    const response = await sendTabMessage(tab.id, {
      action: "add_to_queue",
      ...payload
    });
    results.push({ tabId: tab.id, site: tab.url, response });
  }

  return results;
}

async function configureSidePanel() {
  if (!chrome.sidePanel?.setPanelBehavior) return;

  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (_error) {
    // Side panel may be unavailable on older Chrome builds.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaultPersonas();
  configureSidePanel();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "get_tab_id") {
    sendResponse({ tabId: sender.tab?.id ?? null });
    return true;
  }

  if (request.action === "relay_to_tab") {
    relayToTab(request.tabId, request.payload)
      .then((response) => sendResponse(response))
      .catch((error) =>
        sendResponse({ ok: false, connected: false, error: error.message })
      );
    return true;
  }

  if (request.action === "log_history") {
    appendHistoryEntry(request.entry)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request.action === "broadcast_prompt") {
    broadcastPrompt(request.payload, request.tabIds)
      .then((results) => {
        const successCount = results.filter((entry) => entry.response?.ok).length;
        sendResponse({ ok: true, successCount, total: results.length, results });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request.action === "get_personas") {
    ensureDefaultPersonas()
      .then(async () => {
        const data = await chrome.storage.local.get(PERSONAS_KEY);
        sendResponse({ ok: true, personas: data[PERSONAS_KEY] || DEFAULT_PERSONAS });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request.action === "save_persona") {
    ensureDefaultPersonas()
      .then(async () => {
        const data = await chrome.storage.local.get(PERSONAS_KEY);
        const personas = Array.isArray(data[PERSONAS_KEY]) ? data[PERSONAS_KEY] : [];
        const persona = {
          id: request.persona.id || crypto.randomUUID(),
          name: request.persona.name?.trim(),
          prefix: request.persona.prefix || "",
          suffix: request.persona.suffix || ""
        };

        if (!persona.name) {
          sendResponse({ ok: false, error: "Persona name is required." });
          return;
        }

        const existingIndex = personas.findIndex((entry) => entry.id === persona.id);
        if (existingIndex >= 0) {
          personas[existingIndex] = persona;
        } else {
          personas.push(persona);
        }

        await chrome.storage.local.set({ [PERSONAS_KEY]: personas });
        sendResponse({ ok: true, personas });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request.action === "delete_persona") {
    ensureDefaultPersonas()
      .then(async () => {
        const data = await chrome.storage.local.get(PERSONAS_KEY);
        const personas = (data[PERSONAS_KEY] || []).filter(
          (entry) => entry.id !== request.personaId
        );
        await chrome.storage.local.set({ [PERSONAS_KEY]: personas });
        sendResponse({ ok: true, personas });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (request.action === "get_history") {
    chrome.storage.local
      .get(HISTORY_KEY)
      .then((data) => {
        sendResponse({
          ok: true,
          history: data[HISTORY_KEY] || []
        });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`queueState_${tabId}`);
});

ensureDefaultPersonas();
configureSidePanel();
