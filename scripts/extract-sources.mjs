#!/usr/bin/env node
/** One-time splitter: reads monolithic files into src/ and popup/ folders. */
import fs from "fs";
import path from "path";
import { ROOT } from "./script-manifest.mjs";

function sliceLines(lines, start, end) {
  return lines.slice(start - 1, end).join("\n");
}

function writeEnsureDir(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${content.trimEnd()}\n`);
}

function extractPlatforms() {
  const lines = fs.readFileSync(path.join(ROOT, "platforms.js"), "utf8").split("\n");
  const inner = lines.slice(1, -1);

  const ranges = [
    ["constants.js", 2, 9],
    ["config.js", 10, 184],
    ["dom.js", 185, 267],
    ["editor.js", 268, 332],
    ["inject.js", 333, 500],
    ["send-button.js", 501, 615],
    ["prompt-inject.js", 1206, 1327],
    ["send.js", 1328, 1516],
    ["api.js", 1517, 1527]
  ];

  for (const [name, start, end] of ranges) {
    const chunk = sliceLines(inner, start - 1, end - 1);
    writeEnsureDir(path.join(ROOT, "src", "platforms", name), chunk);
  }
}

function extractPopup() {
  const lines = fs.readFileSync(path.join(ROOT, "popup.js"), "utf8").split("\n");

  const ranges = [
    ["popup/01-constants.js", 1, 88],
    ["popup/02-dom-state.js", 90, 182],
    ["popup/03-ui-settings.js", 184, 516],
    ["popup/04-compose.js", 517, 651],
    ["popup/05-status-modals.js", 653, 952],
    ["popup/06-url-utils.js", 954, 996],
    ["popup/07-connection.js", 998, 1698],
    ["popup/08-personas.js", 1700, 1939],
    ["popup/09-queue.js", 1941, 2179],
    ["popup/10-messaging.js", 2181, 2361],
    ["popup/11-init.js", 2363, 2550]
  ];

  for (const [name, start, end] of ranges) {
    writeEnsureDir(path.join(ROOT, name), sliceLines(lines, start, end));
  }
}

extractPlatforms();
extractPopup();
console.log("Extracted src/platforms/* and popup/*");
