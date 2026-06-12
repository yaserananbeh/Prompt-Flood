#!/usr/bin/env node
/**
 * Regenerates the auto-maintained sections of AGENTS.md from script-manifest.
 * Run after adding/moving source files: node scripts/sync-agents-map.mjs
 */
import fs from "fs";
import path from "path";
import {
  CONTENT_SCRIPTS,
  PLATFORM_SOURCE_PARTS,
  POPUP_SCRIPTS,
  ROOT
} from "./script-manifest.mjs";

const AGENTS_PATH = path.join(ROOT, "AGENTS.md");

const FILE_DESCRIPTIONS = {
  "popup.html": "Side panel markup + all CSS",
  "background.js": "Message relay tab↔panel, personas storage",
  "content.js": "Per-tab queue state, message actions, `processQueue` / `runQueueLoop`",
  "manifest.json": "Permissions, content script injection order",
  "platforms.js": "Built bundle — LLM DOM automation (`sendPrompt`, text injection)",
  "src/platforms/constants.js": "Timing constants for send waits",
  "src/platforms/config.js": "`PLATFORMS` selector configs (ChatGPT, Gemini, Claude, …)",
  "src/platforms/dom.js": "Shadow-DOM queries (`queryAllDeep`, visibility)",
  "src/platforms/editor.js": "`getEditor`, `getStopButton`, `isReady`, `detectPlatform`",
  "src/platforms/inject.js": "Generic text injection (Lexical, ProseMirror, textarea)",
  "src/platforms/send-button.js": "Send button discovery and send confirmation waits",
  "src/platforms/prompt-inject.js": "Gemini-specific text inject + pre-send guards",
  "src/platforms/send.js": "`sendPrompt` — inject text and click send",
  "src/platforms/api.js": "Public `LLM_PLATFORMS` export object",
  "popup/01-constants.js": "Extension constants, `DEFAULT_SETTINGS`, `CONTENT_VERSION`",
  "popup/02-dom-state.js": "DOM element refs + mutable UI state variables",
  "popup/03-ui-settings.js": "Info tips, settings cards, LLM launcher, tab navigation helpers",
  "popup/04-compose.js": "Queue preview formatting helpers",
  "popup/05-status-modals.js": "Status banner, confirm/edit/persona modals",
  "popup/06-url-utils.js": "URL parsing, site labels, LLM lookup",
  "popup/07-connection.js": "Connection bar, linked tabs, refresh/poll, send targets",
  "popup/08-personas.js": "Personas UI, `setConnectionStatus`, `renderQueueStatus` banner",
  "popup/09-queue.js": "Queue list render, filter-by-chat, toolbar controls",
  "popup/10-messaging.js": "Tab messaging, `sendQueueAction`, queue item edit/remove",
  "popup/11-init.js": "Event listeners, `submitPrompt`, startup"
};

function describeFile(relativePath) {
  return FILE_DESCRIPTIONS[relativePath] || "Extension source";
}

function buildFileMapTable() {
  const rows = [
    "| File | Responsibility |",
    "|------|----------------|"
  ];

  rows.push(`| \`popup.html\` | ${describeFile("popup.html")} |`);
  for (const script of POPUP_SCRIPTS) {
    rows.push(`| \`${script}\` | ${describeFile(script)} |`);
  }
  rows.push(`| \`content.js\` | ${describeFile("content.js")} |`);
  for (const part of PLATFORM_SOURCE_PARTS) {
    const rel = `src/platforms/${part}`;
    rows.push(`| \`${rel}\` | ${describeFile(rel)} |`);
  }
  rows.push(`| \`platforms.js\` | ${describeFile("platforms.js")} (run \`node scripts/build.mjs\`) |`);
  rows.push(`| \`background.js\` | ${describeFile("background.js")} |`);
  rows.push(`| \`manifest.json\` | ${describeFile("manifest.json")} |`);

  return rows.join("\n");
}

function buildLoadOrderSection() {
  return [
    "### Content scripts (per chat tab)",
    "",
    "```",
    CONTENT_SCRIPTS.join(" → "),
    "```",
    "",
    "Edit `src/platforms/*` then run `node scripts/build.mjs` to regenerate `platforms.js`.",
    "",
    "### Side panel scripts",
    "",
    "```",
    POPUP_SCRIPTS.join(" → "),
    "```"
  ].join("\n");
}

function replaceSection(content, startMarker, endMarker, replacement) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Markers not found in AGENTS.md: ${startMarker}`);
  }
  return `${content.slice(0, start + startMarker.length)}\n${replacement}\n${content.slice(end)}`;
}

function main() {
  let content = fs.readFileSync(AGENTS_PATH, "utf8");
  const generatedAt = new Date().toISOString().slice(0, 10);

  content = replaceSection(
    content,
    "<!-- AUTO:FILE_MAP_START -->",
    "<!-- AUTO:FILE_MAP_END -->",
    buildFileMapTable()
  );

  content = replaceSection(
    content,
    "<!-- AUTO:LOAD_ORDER_START -->",
    "<!-- AUTO:LOAD_ORDER_END -->",
    buildLoadOrderSection()
  );

  content = content.replace(
    /<!-- AUTO:GENERATED_AT -->[^\n]*/,
    `<!-- AUTO:GENERATED_AT --> ${generatedAt}`
  );

  fs.writeFileSync(AGENTS_PATH, content);
  console.log(`Updated AGENTS.md (file map + load order, ${generatedAt})`);
}

main();
