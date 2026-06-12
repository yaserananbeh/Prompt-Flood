// @module popup/01-constants.js — see AGENTS.md
const CONTENT_VERSION = 15;
const SUPPORTED_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "gemini.google.com",
  "claude.ai",
  "kimi.com",
  "chat.deepseek.com"
];
const IGNORED_TABS_KEY = "ignoredTabIds";
const SETTINGS_KEY = "extensionSettings";

const DEFAULT_SETTINGS = {
  refreshIntervalMs: 3000,
  checkpointSound: true,
  clearPromptAfterAdd: true,
  defaultHoldBeforeSending: false,
  defaultPersonaId: "",
  openChatsInBackground: true,
  confirmClearQueue: true
};

function normalizeSettings(rawSettings = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...rawSettings };
  const allowedIntervals = [1000, 3000, 5000, 10000];

  if (!allowedIntervals.includes(merged.refreshIntervalMs)) {
    merged.refreshIntervalMs = DEFAULT_SETTINGS.refreshIntervalMs;
  }

  merged.checkpointSound = Boolean(merged.checkpointSound);
  merged.clearPromptAfterAdd = Boolean(merged.clearPromptAfterAdd);
  merged.defaultHoldBeforeSending = Boolean(merged.defaultHoldBeforeSending);
  merged.defaultPersonaId =
    typeof merged.defaultPersonaId === "string" ? merged.defaultPersonaId : "";
  merged.openChatsInBackground = Boolean(merged.openChatsInBackground);
  merged.confirmClearQueue = Boolean(merged.confirmClearQueue);

  return merged;
}
const SUPPORTED_LLMS = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com/",
    host: "chatgpt.com",
    accent: "#10a37f"
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com/app",
    host: "gemini.google.com",
    accent: "#4285f4"
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai/new",
    host: "claude.ai",
    accent: "#d97757"
  },
  {
    id: "kimi",
    name: "Kimi",
    url: "https://www.kimi.com/",
    host: "kimi.com",
    accent: "#111827"
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://chat.deepseek.com/",
    host: "chat.deepseek.com",
    accent: "#4d6bfe"
  }
];
