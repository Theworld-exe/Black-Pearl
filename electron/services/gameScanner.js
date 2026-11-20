const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { getSteamCache } = require("./steam");
const { getDB, saveDB } = require("./database");

// Blacklist of common non-game executables
const EXECUTABLE_BLACKLIST = [
  "unins",
  "uninstall",
  "crash",
  "crashpad",
  "unitycrashhandler",
  "dxwebsetup",
  "dxsetup",
  "vcredist",
  "vc_redist",
  "oalinst",
  "dotNetFx",
  "directx",
  "easyanticheat",
  "battleye",
  "reporter",
  "update",
  "launcher_helper",
  "7za",
  "7z",
  "quickbms",
];

// Clean game folder name to match Steam metadata
function cleanGameTitle(folderName) {
  return folderName
    .replace(/^\[BlackPearl\]\s*/i, "")
    .replace(/^Extracted_\s*/i, "")
    .replace(/\[(?:FitGirl|DODI|RUNE|TENOKE|FLT|SKIDROW|CODEX|Razor1911|GOG|Repack)[^\]]*\]/gi, "")
    .replace(/\((?:FitGirl|DODI|RUNE|TENOKE|FLT|SKIDROW|CODEX|Razor1911|GOG|Repack)[^)]*\)/gi, "")
    .replace(/v\d+(\.\d+)+.*$/i, "")
    .replace(/Build\s*\d+.*$/i, "")
    .replace(/[-_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Find primary game executable inside a game folder
function findPrimaryExecutable(folderPath, gameTitle) {
  const candidates = [];
  const sanitizedTitle = gameTitle.toLowerCase().replace(/[^a-z0-9]/g, "");

  const scan = (dir, depth = 0) => {
    if (depth > 3) return;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          const lowerDir = item.name.toLowerCase();
          if (!lowerDir.includes("redist") && !lowerDir.includes("directx") && !lowerDir.includes("_commonredist")) {
            scan(full, depth + 1);
          }
        } else if (item.isFile()) {
          const lower = item.name.toLowerCase();
          if (
            (lower.endsWith(".exe") || lower.endsWith(".x86_64") || lower.endsWith(".bin")) &&
            !EXECUTABLE_BLACKLIST.some((b) => lower.includes(b))
          ) {
            let score = 10;
            const cleanExe = lower.replace(/\.exe|\.x86_64|\.bin/g, "").replace(/[^a-z0-9]/g, "");

            // Favor exact title matches or launcher names
            if (cleanExe.includes(sanitizedTitle) || sanitizedTitle.includes(cleanExe)) score += 50;
            if (lower.includes("game") || lower.includes("shipping") || lower.includes("win64")) score += 20;
            if (lower.includes("launcher")) score += 15;
            if (lower.includes("setup")) score -= 15;
            if (depth === 0) score += 10; // Root folder priority

            candidates.push({ path: full, name: item.name, score });
          }
        }
      }
    } catch (e) {}
  };

  scan(folderPath);
  candidates.sort((a, b) => b.score - a.score);
  return candidates.length > 0 ? candidates[0].path : null;
}

// Match game name against Steam cache or Steam search API for rich artwork
async function resolveSteamMetadata(gameTitle) {
  const cache = getSteamCache ? getSteamCache() : {};

  // 1. Exact or fuzzy match in local steam cache
  const clean = gameTitle.toLowerCase().trim();
  for (const [key, data] of Object.entries(cache)) {
    if (key.toLowerCase() === clean || key.toLowerCase().includes(clean) || clean.includes(key.toLowerCase())) {
      const appId = data.appid || data.id;
      return {
        name: key,
        clean_name: key,
        steamAppId: appId,
        thumbnail_link:
          data.header_image ||
          `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`,
        categories: data.genres?.map((g) => g.description || g) || [],
      };
    }
  }

  // 2. Fetch from Steam Store search API online
  try {
    const res = await axios.get(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameTitle)}&l=english&cc=US`,
      { timeout: 5000 }
    );

    if (res.data?.items?.length > 0) {
      const item = res.data.items[0];
      return {
        name: item.name,
        clean_name: item.name,
        steamAppId: item.id,
        thumbnail_link:
          item.tiny_image?.replace("capsule_sm_120.jpg", "library_600x900_2x.jpg") ||
          `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${item.id}/header.jpg`,
        categories: [],
      };
    }
  } catch (err) {}

  // 3. Fallback placeholder metadata
  return {
    name: gameTitle,
    clean_name: gameTitle,
    steamAppId: null,
    thumbnail_link: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&q=80",
    categories: ["PC Game"],
  };
}

// Scan a directory recursively for potential game folders
async function scanDirectoryForGames(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return { success: false, message: "Directory path does not exist", games: [] };
  }

  const existingLibrary = getDB().library || [];
  const existingExePaths = new Set(existingLibrary.map((g) => g.exePath).filter(Boolean));
  const existingNames = new Set(existingLibrary.map((g) => g.name.toLowerCase()));

  const discovered = [];

  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        const fullDirPath = path.join(dirPath, item.name);
        const cleanTitle = cleanGameTitle(item.name);

        if (!cleanTitle || cleanTitle.length < 2) continue;

        // Find primary executable in folder
        const exePath = findPrimaryExecutable(fullDirPath, cleanTitle);

        if (exePath) {
          const isAlreadyInLib =
            existingExePaths.has(exePath) ||
            existingNames.has(cleanTitle.toLowerCase()) ||
            existingNames.has(item.name.toLowerCase());

          // Match with Steam metadata
          const meta = await resolveSteamMetadata(cleanTitle);

          discovered.push({
            name: meta.name || cleanTitle,
            clean_name: cleanTitle,
            folderName: item.name,
            folderPath: fullDirPath,
            exePath,
            thumbnail_link: meta.thumbnail_link,
            steamAppId: meta.steamAppId,
            categories: meta.categories,
            isAlreadyInLib,
          });
        }
      }
    }

    return {
      success: true,
      scannedPath: dirPath,
      totalFound: discovered.length,
      games: discovered,
    };
  } catch (err) {
    console.error("[GameScanner] Directory scan error:", err);
    return { success: false, message: err.message, games: [] };
  }
}

// Import list of scanned games into user library
function importScannedGames(gamesToImport) {
  const db = getDB();
  let addedCount = 0;

  for (const game of gamesToImport) {
    const exists = db.library.find(
      (g) =>
        (game.exePath && g.exePath === game.exePath) ||
        g.name.toLowerCase() === game.name.toLowerCase()
    );

    if (!exists) {
      db.library.push({
        name: game.name,
        clean_name: game.clean_name || game.name,
        thumbnail_link: game.thumbnail_link,
        steamAppId: game.steamAppId || null,
        categories: game.categories || ["PC Game"],
        exePath: game.exePath,
        launchParams: "",
        playtimeSeconds: 0,
        lastPlayed: null,
        addedDate: new Date().toISOString(),
      });
      addedCount++;
    } else if (!exists.exePath && game.exePath) {
      exists.exePath = game.exePath;
    }
  }

  if (addedCount > 0) {
    saveDB(db);
  }

  return { success: true, addedCount, library: db.library };
}

module.exports = {
  scanDirectoryForGames,
  importScannedGames,
  cleanGameTitle,
  findPrimaryExecutable,
  resolveSteamMetadata,
};
