require('v8-compile-cache');
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const fetch = require("cross-fetch");
const { ElectronBlocker } = require("@cliqz/adblocker-electron");

// --- Global Request Hooking ---
const Module = require("module");
const originalRequire = Module.prototype.require;
const sharedAxios = originalRequire.call(module, "axios");
let sharedCheerio;
try {
  sharedCheerio = originalRequire.call(module, "cheerio");
} catch (e) {}

Module.prototype.require = function (request) {
  if (request === "axios") return sharedAxios;
  if (request === "cheerio" && sharedCheerio) return sharedCheerio;
  return originalRequire.apply(this, arguments);
};

// --- Import Services ---
const { setupDatabaseIPC } = require("./services/database");
const { loadSteamCache, setupSteamIPC } = require("./services/steam");
const { loadExtensions, setupExtensionsIPC } = require("./services/extensions");
const { setupLauncherIPC, killAllGames } = require("./services/launcher");
const {
  startAria2,
  connectAria2,
  startPolling,
  setupAria2IPC,
  killAria2,
} = require("./services/aria2");

let mainWindow;
let adBlocker = null;

if (process.platform === "win32") {
  app.commandLine.appendSwitch("disable-direct-composition");
  app.commandLine.appendSwitch("disable-direct-composition-video-overlays");
}

app.whenReady().then(async () => {
  console.log("[App] Ready initializing modules...");

  loadExtensions();
  loadSteamCache();
  createWindow();

  setupDatabaseIPC(ipcMain);
  setupSteamIPC(ipcMain);
  setupExtensionsIPC(ipcMain);
  setupLauncherIPC(ipcMain, () => mainWindow);
  setupAria2IPC(ipcMain, () => adBlocker);

  // Background processes 
  startAria2().then((started) => {
    if (started) {
      connectAria2().then((ok) => {
        if (ok) {
          console.log("[App] Aria2 background init complete");
          startPolling(() => mainWindow);
        }
      });
    }
  });

  // Discord Rich Presence
  try {
    const { connectDiscordRpc } = require("./services/discordRpc");
    connectDiscordRpc();
  } catch (e) {
    console.warn("[App] Discord RPC init warning:", e.message);
  }

  // Download Scheduler
  try {
    const { startScheduleWatcher } = require("./services/scheduler");
    startScheduleWatcher();
  } catch (e) {}

  ElectronBlocker.fromLists(fetch, [
      "https://easylist.to/easylist/easylist.txt",
      "https://easylist.to/easylist/easyprivacy.txt",
      "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt",
      "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt",
      "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt",
      "https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/quick-fixes.txt",
      "https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=1&mimetype=plaintext"
    ])
    .then((b) => {
      adBlocker = b;
      console.log("[App] AdBlocker ready");
    })
    .catch((e) => console.error("[App] AdBlocker failed:", e));
});



function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    titleBarStyle: "hiddenInset",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      backgroundThrottling: true
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.on("will-quit", () => {
  killAria2();
  killAllGames();
  try {
    const { stopScheduleWatcher } = require("./services/scheduler");
    stopScheduleWatcher();
  } catch (e) {}
  try {
    const { destroyDiscordRpc } = require("./services/discordRpc");
    destroyDiscordRpc();
  } catch (e) {}
  try {
    const { closeOverlay } = require("./services/overlay");
    closeOverlay();
  } catch (e) {}
});

ipcMain.handle("select-directory", async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.on("open-external", (event, url) => {
  if (typeof url !== "string") return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      shell.openExternal(parsed.toString());
    }
  } catch {
    console.warn("[App] Blocked invalid external URL:", url);
  }
});
ipcMain.on("window-minimize", () => mainWindow.minimize());
ipcMain.on("window-maximize", () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.on("window-close", () => mainWindow.close());

ipcMain.handle("check-part-exists", (e, url) => {
  try {
    const { getDB } = require("./services/database");
    const db = getDB();
    const rawName = url.split("?")[0].split("/").pop();
    if (!rawName) return false;
    
    const fileName = rawName.startsWith("[BlackPearl]") ? rawName : `[BlackPearl] ${rawName}`;
    const dlPath = db.profile?.downloadPath || app.getPath("downloads");
    
    return fs.existsSync(path.join(dlPath, fileName));
  } catch (err) {
    return false;
  }
});

// ── Debrid Handlers ─────────────────────────────────────────────────────────
ipcMain.handle("validate-debrid-key", async (e, { provider, apiKey }) => {
  const { validateDebridKey } = require("./services/debrid");
  return await validateDebridKey(provider, apiKey);
});

// ── Extractor Handlers ──────────────────────────────────────────────────────
ipcMain.handle("extract-archive", async (e, payload) => {
  const { extractArchive } = require("./services/extractor");
  const { getDB } = require("./services/database");
  const db = getDB();
  const dlPath = db.profile?.downloadPath || app.getPath("downloads");

  // Support both object payload and direct args
  const filePath = typeof payload === "string" ? payload : payload?.filePath;
  const targetDir = typeof payload === "object" ? payload?.targetDir : null;
  const gameName = typeof payload === "object" ? payload?.gameName : "";
  const autoDelete = typeof payload === "object" ? payload?.autoDelete : true;

  return await extractArchive(
    filePath,
    targetDir,
    (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("extract-progress", { filePath, gameName, status });
      }
    },
    {
      gameName,
      autoDelete,
      mainGamesDir: dlPath,
    },
  );
});

ipcMain.handle("check-is-archive", (e, filePath) => {
  const { isArchive } = require("./services/extractor");
  return isArchive(filePath);
});

// ── Proton & Linux Handlers ────────────────────────────────────────────────
ipcMain.handle("get-proton-versions", () => {
  const { findInstalledProtons } = require("./services/proton");
  return findInstalledProtons();
});

ipcMain.handle("is-linux-platform", () => {
  return process.platform === "linux";
});

// ── Cloud Save Handlers ────────────────────────────────────────────────────
ipcMain.handle("find-game-saves", (e, { gameName, steamAppId }) => {
  const { findGameSavePaths } = require("./services/cloudSave");
  return findGameSavePaths(gameName, steamAppId);
});

ipcMain.handle("backup-game-saves", async (e, { gameName, customSavePath, steamAppId }) => {
  const { backupGameSaves } = require("./services/cloudSave");
  return await backupGameSaves(gameName, customSavePath, steamAppId);
});

ipcMain.handle("restore-game-saves", async (e, { backupZipPath, targetDir }) => {
  const { restoreGameSaves } = require("./services/cloudSave");
  return await restoreGameSaves(backupZipPath, targetDir);
});

ipcMain.handle("get-game-save-history", (e, gameName) => {
  const { getGameSaveHistory } = require("./services/cloudSave");
  return getGameSaveHistory(gameName);
});

ipcMain.handle("sync-cloud-saves", async (e, { gameName, customConfig }) => {
  const { syncGameSavesToCloud } = require("./services/cloudSave");
  return await syncGameSavesToCloud(gameName, customConfig);
});

ipcMain.handle("test-webdav", async (e, config) => {
  const { testWebDAVConnection } = require("./services/cloudSave");
  return await testWebDAVConnection(config);
});

// ── Achievement Handlers ───────────────────────────────────────────────────
ipcMain.handle("get-game-achievements", async (e, { gameName, appId }) => {
  const { fetchGameAchievements, getGameUnlockedAchievements } = require("./services/achievements");
  const schema = await fetchGameAchievements(appId);
  const unlocked = getGameUnlockedAchievements(gameName, appId);
  return { schema, unlocked };
});

ipcMain.handle("unlock-achievement", (e, { gameName, apiName }) => {
  const { unlockAchievement } = require("./services/achievements");
  return unlockAchievement(gameName, apiName);
});

// ── Game Directory Scanner Handlers ────────────────────────────────────────
ipcMain.handle("scan-for-games", async (e, customDir) => {
  const { scanDirectoryForGames } = require("./services/gameScanner");
  const { getDB } = require("./services/database");
  const targetDir = customDir || getDB().profile?.downloadPath || app.getPath("downloads");
  return await scanDirectoryForGames(targetDir);
});

ipcMain.handle("import-scanned-games", (e, games) => {
  const { importScannedGames } = require("./services/gameScanner");
  return importScannedGames(games);
});

// ── Mod & ReShade Manager Handlers ────────────────────────────────────────
ipcMain.handle("get-game-mod-status", (e, exePath) => {
  const { detectGameEngineAndModStructure } = require("./services/modManager");
  return detectGameEngineAndModStructure(exePath);
});

ipcMain.handle("install-reshade", (e, { exePath, hook }) => {
  const { installReShade } = require("./services/modManager");
  return installReShade(exePath, hook);
});

ipcMain.handle("toggle-reshade", (e, { exePath, enable }) => {
  const { toggleReShade } = require("./services/modManager");
  return toggleReShade(exePath, enable);
});

ipcMain.handle("install-mod-archive", async (e, { exePath, modPath }) => {
  const { installModArchive } = require("./services/modManager");
  return await installModArchive(exePath, modPath);
});

ipcMain.handle("toggle-mod", (e, { modPath, enable }) => {
  const { toggleMod } = require("./services/modManager");
  return toggleMod(modPath, enable);
});

ipcMain.handle("delete-mod", (e, modPath) => {
  const { deleteMod } = require("./services/modManager");
  return deleteMod(modPath);
});

ipcMain.handle("select-mod-file", async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: "Select Mod File or Package Archive",
    properties: ["openFile"],
    filters: [
      { name: "Mod Files & Archives", extensions: ["zip", "rar", "7z", "pak", "asi", "dll", "lua", "ini", "bsp"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  return r.canceled ? null : r.filePaths[0];
});

// ── Game Patch & Update Notifier Handlers ──────────────────────────────────
ipcMain.handle("check-game-updates", async (e, library) => {
  const { checkGameUpdates } = require("./services/patchNotifier");
  const { getActiveExtension } = require("./services/extensions");
  return await checkGameUpdates(library, getActiveExtension());
});

ipcMain.handle("get-patch-links", async (e, gameName) => {
  const { getGamePatchLinks } = require("./services/patchNotifier");
  const { getActiveExtension } = require("./services/extensions");
  return await getGamePatchLinks(gameName, getActiveExtension());
});