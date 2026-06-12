/** Single source of truth for extension script load order. */
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "..");

export const PLATFORM_SOURCE_PARTS = [
  "constants.js",
  "config.js",
  "dom.js",
  "editor.js",
  "inject.js",
  "send-button.js",
  "prompt-inject.js",
  "send.js",
  "api.js"
];

export const POPUP_SCRIPTS = [
  "popup/01-constants.js",
  "popup/02-dom-state.js",
  "popup/03-ui-settings.js",
  "popup/04-compose.js",
  "popup/05-status-modals.js",
  "popup/06-url-utils.js",
  "popup/07-connection.js",
  "popup/08-personas.js",
  "popup/09-queue.js",
  "popup/10-messaging.js",
  "popup/11-init.js"
];

export const CONTENT_SCRIPTS = ["platforms.js", "content.js"];

export const ROOT = root;

export function platformSourcePath(name) {
  return path.join(root, "src", "platforms", name);
}

export function popupScriptPath(relativePath) {
  return path.join(root, relativePath);
}
