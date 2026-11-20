const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { app } = require("electron");
const { getDB, saveDB } = require("./database");

const isWin = process.platform === "win32";
const isLinux = process.platform === "linux";

// In-memory cache for game achievement schemas
const schemaCache = new Map();
const activeWatchers = new Map();

// Fetch Steam achievement schema for an AppID
async function fetchGameAchievements(appId) {
  if (!appId) return [];

  const idStr = String(appId);
  if (schemaCache.has(idStr)) {
    return schemaCache.get(idStr);
  }

  // 1. Try Steam Community XML stats endpoint
  try {
    const res = await axios.get(`https://steamcommunity.com/stats/${idStr}/achievements/?xml=1`, {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });

    if (res.data && typeof res.data === "string" && res.data.includes("<achievement>")) {
      const xml = res.data;
      const achievements = [];
      const achBlocks = xml.split("<achievement>").slice(1);

      for (const block of achBlocks) {
        const nameMatch = block.match(/<apiname><!\[CDATA\[(.*?)\]\]><\/apiname>/i) || block.match(/<apiname>(.*?)<\/apiname>/i);
        const titleMatch = block.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/i) || block.match(/<name>(.*?)<\/name>/i);
        const descMatch = block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/i) || block.match(/<description>(.*?)<\/description>/i);
        const iconMatch = block.match(/<iconClosed><!\[CDATA\[(.*?)\]\]><\/iconClosed>/i) || block.match(/<iconClosed>(.*?)<\/iconClosed>/i);
        const iconOpenMatch = block.match(/<iconOpen><!\[CDATA\[(.*?)\]\]><\/iconOpen>/i) || block.match(/<iconOpen>(.*?)<\/iconOpen>/i);

        if (nameMatch) {
          achievements.push({
            apiName: nameMatch[1],
            displayName: titleMatch ? titleMatch[1] : nameMatch[1],
            description: descMatch ? descMatch[1] : "",
            icon: iconOpenMatch ? iconOpenMatch[1] : (iconMatch ? iconMatch[1] : ""),
            iconGray: iconMatch ? iconMatch[1] : "",
          });
        }
      }

      if (achievements.length > 0) {
        schemaCache.set(idStr, achievements);
        return achievements;
      }
    }
  } catch (err) {
    console.warn(`[Achievements] Steam Community fetch error for AppID ${idStr}:`, err.message);
  }

  return [];
}

// Find local emulator achievement files (Goldberg, CODEX, RUNE, etc.)
function getEmulatorAchievementFiles(gameName, appId) {
  const home = os.homedir();
  const paths = [];

  if (isWin) {
    const appdata = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    const publicDir = process.env.PUBLIC || path.join("C:", "Users", "Public");
    if (appId) {
      paths.push(path.join(appdata, "Goldberg SteamEmu Saves", String(appId), "achievements.json"));
      paths.push(path.join(appdata, "RUNE", String(appId), "achievements.json"));
      paths.push(path.join(publicDir, "Documents", "Steam", "CODEX", String(appId), "achievements.ini"));
    }
  } else if (isLinux) {
    const prefixPfx = path.join(
      app.getPath("userData"),
      "proton_prefixes",
      gameName.replace(/[^a-zA-Z0-9_-]/g, "_"),
      "pfx",
      "drive_c",
      "users",
      "steamuser",
      "AppData",
      "Roaming"
    );
    if (appId) {
      paths.push(path.join(prefixPfx, "Goldberg SteamEmu Saves", String(appId), "achievements.json"));
    }
  }

  return paths.filter((p) => fs.existsSync(p));
}

// Get list of unlocked achievements from local emulators or database
function getGameUnlockedAchievements(gameName, appId = null) {
  const unlocked = new Map(); // apiName -> unlockTimestamp

  // 1. Check local database
  const db = getDB();
  if (db.achievements && db.achievements[gameName]) {
    const records = db.achievements[gameName];
    for (const [key, val] of Object.entries(records)) {
      unlocked.set(key, typeof val === "string" ? val : new Date().toISOString());
    }
  }

  // 2. Check emulator files
  if (appId) {
    const files = getEmulatorAchievementFiles(gameName, appId);
    for (const file of files) {
      try {
        if (file.endsWith(".json")) {
          const content = JSON.parse(fs.readFileSync(file, "utf8"));
          if (Array.isArray(content)) {
            for (const item of content) {
              const name = typeof item === "string" ? item : item.name || item.apiName;
              if (name && !unlocked.has(name)) {
                unlocked.set(name, item.earned_time ? new Date(item.earned_time * 1000).toISOString() : new Date().toISOString());
              }
            }
          } else if (typeof content === "object") {
            for (const key of Object.keys(content)) {
              if (content[key] && !unlocked.has(key)) {
                unlocked.set(key, new Date().toISOString());
              }
            }
          }
        }
      } catch (e) {}
    }
  }

  return Object.fromEntries(unlocked);
}

// Unlock an achievement and save to local DB
function unlockAchievement(gameName, apiName) {
  const db = getDB();
  if (!db.achievements) db.achievements = {};
  if (!db.achievements[gameName]) db.achievements[gameName] = {};

  if (!db.achievements[gameName][apiName]) {
    const timestamp = new Date().toISOString();
    db.achievements[gameName][apiName] = timestamp;
    saveDB(db);
    return { newlyUnlocked: true, timestamp };
  }

  return { newlyUnlocked: false, timestamp: db.achievements[gameName][apiName] };
}

// Start watching for real-time achievement unlocks while a game is running
function startAchievementWatcher(gameName, appId, onUnlock) {
  stopAchievementWatcher(gameName);

  let previousUnlocked = new Set(Object.keys(getGameUnlockedAchievements(gameName, appId)));

  const interval = setInterval(async () => {
    try {
      const current = getGameUnlockedAchievements(gameName, appId);
      const currentKeys = Object.keys(current);

      for (const key of currentKeys) {
        if (!previousUnlocked.has(key)) {
          previousUnlocked.add(key);
          // Fetch achievement schema for display details
          const schema = await fetchGameAchievements(appId);
          const detail = schema.find((a) => a.apiName === key) || {
            apiName: key,
            displayName: key,
            description: "Achievement Unlocked!",
            icon: "",
          };

          console.log(`[Achievements] Unlocked: ${detail.displayName} in ${gameName}!`);
          onUnlock({
            gameName,
            achievement: detail,
            unlockedAt: current[key],
          });
        }
      }
    } catch (e) {
      console.warn("[Achievements] Watcher check error:", e);
    }
  }, 2500);

  activeWatchers.set(gameName, interval);
}

function stopAchievementWatcher(gameName) {
  if (activeWatchers.has(gameName)) {
    clearInterval(activeWatchers.get(gameName));
    activeWatchers.delete(gameName);
  }
}

module.exports = {
  fetchGameAchievements,
  getGameUnlockedAchievements,
  unlockAchievement,
  startAchievementWatcher,
  stopAchievementWatcher,
};
