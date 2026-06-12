#!/usr/bin/env node
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const script = path.join(root, "scripts", "sync-agents-map.mjs");

try {
  await import("node:fs/promises").then((fs) => fs.readFile(0, "utf8").catch(() => ""));
} catch {
  // stdin optional for stop hook
}

const result = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
if (result.status !== 0) {
  console.error(result.stderr || "sync-agents-map failed");
}
process.exit(0);
