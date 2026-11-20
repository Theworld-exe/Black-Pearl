import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { formatBytes, formatPlaytime, formatLastPlayed } from "../src/utils/helpers.js";
import { DEFAULT_THEMES } from "../src/constants/themes.js";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const { extractVersionTag, isNewerVersion } = require("../electron/services/patchNotifier.js");
const { isArchive, sanitizeFolderName } = require("../electron/services/extractor.js");
const { detectGameEngineAndModStructure } = require("../electron/services/modManager.js");
const { validateDebridKey } = require("../electron/services/debrid.js");

test("frontend helpers format bytes, playtime, and timestamps", () => {
  assert.equal(formatBytes(0), "0 Bytes");
  assert.equal(formatBytes(1024), "1 KB");
  assert.equal(formatBytes(1048576), "1 MB");

  assert.equal(formatPlaytime(0), "Never played");
  assert.equal(formatPlaytime(30), "< 1 min");
  assert.equal(formatPlaytime(60), "1 min");
  assert.equal(formatPlaytime(180), "3 mins");
  assert.equal(formatPlaytime(7200), "2.0 hrs");

  assert.equal(formatLastPlayed(null), "Never");
  assert.equal(formatLastPlayed("not-a-date"), "Never");
  assert.equal(formatLastPlayed(new Date().toISOString()), "Today");
});

test("default themes define required styling keys", () => {
  assert.ok(Array.isArray(DEFAULT_THEMES) && DEFAULT_THEMES.length >= 5);
  for (const theme of DEFAULT_THEMES) {
    assert.ok(theme.id && theme.name && theme.class && theme.textGradient);
  }
});

test("patchNotifier extracts and compares version tags", () => {
  assert.equal(extractVersionTag("Game Title v2.1.4"), "2.1.4");
  assert.equal(extractVersionTag("Game Title Build 145920"), "Build 145920");
  assert.equal(extractVersionTag("Game Title Update 4"), "Update 4");
  assert.equal(extractVersionTag("Plain Game Title"), null);

  assert.equal(isNewerVersion("2.0.0", "1.9.9"), true);
  assert.equal(isNewerVersion("1.2.3", "1.2.3"), false);
  assert.equal(isNewerVersion("1.1.0", "1.2.0"), false);
});

test("extractor detects archive extensions and sanitizes folder names", () => {
  assert.equal(isArchive("game.zip"), true);
  assert.equal(isArchive("game.part01.rar"), true);
  assert.equal(isArchive("game.7z.001"), true);
  assert.equal(isArchive("readme.txt"), false);

  assert.equal(
    sanitizeFolderName("[BlackPearl] Cyberpunk 2077 [FitGirl Repack] v2.12"),
    "Cyberpunk 2077",
  );
  assert.equal(sanitizeFolderName('Bad:Name*With?Chars'), "BadNameWithChars");
});

test("modManager safely handles missing executable paths", () => {
  const status = detectGameEngineAndModStructure(path.join(rootDir, "nonexistent-game.exe"));
  assert.equal(status.engine, "Unknown");
  assert.equal(status.hasReShade, false);
  assert.deepEqual(status.installedMods, []);
});

test("debrid validation rejects blank API keys without network calls", async () => {
  const res = await validateDebridKey("realdebrid", "   ");
  assert.equal(res.valid, false);
  assert.match(res.message, /required/i);
});

test("package.json manifest and build configuration are consistent", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  assert.equal(pkg.main, "dist-electron/main.js");
  assert.ok(pkg.scripts.dev && pkg.scripts.build && pkg.scripts.lint && pkg.scripts.test);
  assert.ok(pkg.build.files.includes("extensions/**/*"));
  assert.ok(fs.existsSync(path.join(rootDir, "extensions")));
});
