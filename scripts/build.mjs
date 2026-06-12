#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { PLATFORM_SOURCE_PARTS, ROOT, platformSourcePath } from "./script-manifest.mjs";

function buildPlatforms() {
  const body = PLATFORM_SOURCE_PARTS.map((name) => {
    const filePath = platformSourcePath(name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing platform source: ${filePath}`);
    }
    return fs.readFileSync(filePath, "utf8").trimEnd();
  }).join("\n\n");

  const output = `globalThis.LLM_PLATFORMS = (() => {\n${body}\n})();\n`;
  fs.writeFileSync(path.join(ROOT, "platforms.js"), output);
  console.log("Built platforms.js");
}

buildPlatforms();
