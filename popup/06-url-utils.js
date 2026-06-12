// @module popup/06-url-utils.js — see AGENTS.md
function getSiteFromUrl(url) {
  if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) return "ChatGPT";
  if (url.includes("gemini.google.com")) return "Gemini";
  if (url.includes("claude.ai")) return "Claude";
  if (url.includes("kimi.com")) return "Kimi";
  if (url.includes("chat.deepseek.com")) return "DeepSeek";
  return "Unknown";
}

function getChatIdFromUrl(url) {
  try {
    const { pathname } = new URL(url);

    if (url.includes("chatgpt.com")) {
      const match = pathname.match(/\/c\/([a-f0-9-]+)/i);
      return match ? match[1] : null;
    }

    if (url.includes("gemini.google.com")) {
      const match = pathname.match(/\/app\/([^/?#]+)/i);
      return match ? match[1] : null;
    }

    if (url.includes("claude.ai")) {
      const match = pathname.match(/\/chat\/([a-f0-9-]+)/i);
      return match ? match[1] : null;
    }

    if (url.includes("kimi.com")) {
      const match = pathname.match(/\/chat\/([a-z0-9-]+)/i);
      return match ? match[1] : null;
    }

    if (url.includes("chat.deepseek.com")) {
      const match = pathname.match(/\/a\/chat\/s\/([a-z0-9-]+)/i);
      return match ? match[1] : null;
    }
  } catch (_error) {
    return null;
  }

  return null;
}
