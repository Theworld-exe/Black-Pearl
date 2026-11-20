const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {

  // Extensions
  getExtensions: () => ipcRenderer.invoke("get-extensions"),
  getExtensionsDetails: () => ipcRenderer.invoke("get-extensions-details"),
  setExtension: (name) => ipcRenderer.invoke("set-extension", name),
  installExtension: (url) => ipcRenderer.invoke("install-extension", url),
  deleteExtension: (name) => ipcRenderer.invoke("delete-extension", name),

  // Browse (batch — used for load-more pagination)
  getHomepage: () => ipcRenderer.invoke("get-homepage"),
  getCategory: (category, page) =>
    ipcRenderer.invoke("get-category", { category, page }),
  searchGames: (query, page) =>
    ipcRenderer.invoke("search-games", { query, page }),
  getSteamMedia: (gameName) => ipcRenderer.invoke("get-steam-media", gameName),
  getGameDetails: (url) => ipcRenderer.invoke("get-game-details", url),

  // ── Streaming API ─────────────────────────────────────────────────────────
  // Start a streaming scrape; results come back via onStreamItem / onStreamEnd
  startStream: (params) => ipcRenderer.send("stream-request", params),

  onStreamItem: (callback) => {
    ipcRenderer.removeAllListeners("stream-item");
    ipcRenderer.on("stream-item", (_event, game) => callback(game));
  },
  onStreamEnd: (callback) => {
    ipcRenderer.removeAllListeners("stream-end");
    ipcRenderer.on("stream-end", (_event, data) => callback(data));
  },

  // Profile & DB
  selectDirectory: () => ipcRenderer.invoke("select-directory"),
  getDB: () => ipcRenderer.invoke("get-db"),
  updateProfile: (profile) => ipcRenderer.invoke("update-profile", profile),
  toggleWishlist: (game) => ipcRenderer.invoke("toggle-wishlist", game),
  clearCompleted: () => ipcRenderer.invoke("clear-completed"),
  recordPlaytime: (gameName, durationSeconds) =>
    ipcRenderer.invoke("record-playtime", { gameName, durationSeconds }),

  // Multi-part download registration
  // Tells the main process how many parts this game requires so isDownloaded
  // can be accurate.
  registerMultipart: (gameName, totalParts) =>
    ipcRenderer.invoke("register-multipart", { gameName, totalParts }),

  // Library
  addToLibrary: (game) => ipcRenderer.invoke("add-to-library", game),
  removeFromLibrary: (gameName) =>
    ipcRenderer.invoke("remove-from-library", gameName),
  setGameExe: (gameName, exePath) =>
    ipcRenderer.invoke("set-game-exe", { gameName, exePath }),
  setLaunchParams: (gameName, params) =>
    ipcRenderer.invoke("set-launch-params", { gameName, params }),
  setGameStatus: (gameName, status) =>
    ipcRenderer.invoke("set-game-status", { gameName, status }),
  setGameLaunchProfile: (gameName, profileData) =>
    ipcRenderer.invoke("set-game-launch-profile", { gameName, profileData }),

  // Game Launcher
  openGameFolder: (exePath) => ipcRenderer.invoke("open-game-folder", exePath),
  selectExe: () => ipcRenderer.invoke("select-exe"),
  launchGame: (gameName, exePath, launchParams) =>
    ipcRenderer.invoke("launch-game", { gameName, exePath, launchParams }),
  killGame: (gameName) => ipcRenderer.invoke("kill-game", gameName),

  // Downloads
  startSmartDownload: (url, gameName) =>
    ipcRenderer.send("start-smart-download", url, gameName),
  pauseDownload: (gid) => ipcRenderer.invoke("pause-download", gid),
  resumeDownload: (gid) => ipcRenderer.invoke("resume-download", gid),
  cancelDownload: (gid) => ipcRenderer.invoke("cancel-download", gid),
  checkPartExists: (url) => ipcRenderer.invoke("check-part-exists", url),
  setSpeedLimits: (downloadLimit, uploadLimit) =>
    ipcRenderer.invoke("set-speed-limits", { downloadLimit, uploadLimit }),
  getSpeedLimits: () => ipcRenderer.invoke("get-speed-limits"),

  // Debrid & Unrestricter
  validateDebridKey: (provider, apiKey) =>
    ipcRenderer.invoke("validate-debrid-key", { provider, apiKey }),

  // Archive Extractor
  extractArchive: (filePath, targetDir, options) =>
    ipcRenderer.invoke("extract-archive", typeof filePath === "object" ? filePath : { filePath, targetDir, ...options }),
  checkIsArchive: (filePath) =>
    ipcRenderer.invoke("check-is-archive", filePath),

  // Linux & Proton
  getProtonVersions: () => ipcRenderer.invoke("get-proton-versions"),
  isLinuxPlatform: () => ipcRenderer.invoke("is-linux-platform"),

  // Cloud Saves & Sync
  findGameSaves: (gameName, steamAppId) =>
    ipcRenderer.invoke("find-game-saves", { gameName, steamAppId }),
  backupGameSaves: (gameName, customSavePath, steamAppId) =>
    ipcRenderer.invoke("backup-game-saves", { gameName, customSavePath, steamAppId }),
  restoreGameSaves: (backupZipPath, targetDir) =>
    ipcRenderer.invoke("restore-game-saves", { backupZipPath, targetDir }),
  getGameSaveHistory: (gameName) =>
    ipcRenderer.invoke("get-game-save-history", gameName),
  syncCloudSaves: (gameName, customConfig) =>
    ipcRenderer.invoke("sync-cloud-saves", { gameName, customConfig }),
  testWebDAV: (config) =>
    ipcRenderer.invoke("test-webdav", config),

  // Achievements & Overlay
  getGameAchievements: (gameName, appId) =>
    ipcRenderer.invoke("get-game-achievements", { gameName, appId }),
  unlockAchievement: (gameName, apiName) =>
    ipcRenderer.invoke("unlock-achievement", { gameName, apiName }),

  // Game Directory Scanner
  scanForGames: (customDir) =>
    ipcRenderer.invoke("scan-for-games", customDir),
  importScannedGames: (games) =>
    ipcRenderer.invoke("import-scanned-games", games),

  // Marketplace & Extensions
  getMarketplaceExtensions: () =>
    ipcRenderer.invoke("get-marketplace-extensions"),

  // Mod & ReShade Manager
  getGameModStatus: (exePath) =>
    ipcRenderer.invoke("get-game-mod-status", exePath),
  installReShade: (exePath, hook) =>
    ipcRenderer.invoke("install-reshade", { exePath, hook }),
  toggleReShade: (exePath, enable) =>
    ipcRenderer.invoke("toggle-reshade", { exePath, enable }),
  installModArchive: (exePath, modPath) =>
    ipcRenderer.invoke("install-mod-archive", { exePath, modPath }),
  toggleMod: (modPath, enable) =>
    ipcRenderer.invoke("toggle-mod", { modPath, enable }),
  deleteMod: (modPath) =>
    ipcRenderer.invoke("delete-mod", modPath),
  selectModFile: () =>
    ipcRenderer.invoke("select-mod-file"),

  // Game Patch & Update Notifier
  checkGameUpdates: (library) =>
    ipcRenderer.invoke("check-game-updates", library),
  getPatchLinks: (gameName) =>
    ipcRenderer.invoke("get-patch-links", gameName),

  // Events
  onDownloadUpdate: (callback) => {
    ipcRenderer.removeAllListeners("download-update");
    ipcRenderer.on("download-update", (_event, data) => callback(data));
  },
  onDownloadStarted: (callback) => {
    ipcRenderer.removeAllListeners("download-started");
    ipcRenderer.on("download-started", (_event, data) => callback(data));
  },
  onExtractProgress: (callback) => {
    ipcRenderer.removeAllListeners("extract-progress");
    ipcRenderer.on("extract-progress", (_event, data) => callback(data));
  },
  onExtractComplete: (callback) => {
    ipcRenderer.removeAllListeners("extract-complete");
    ipcRenderer.on("extract-complete", (_event, data) => callback(data));
  },
  onAchievementUnlocked: (callback) => {
    ipcRenderer.removeAllListeners("achievement-unlocked");
    ipcRenderer.on("achievement-unlocked", (_event, data) => callback(data));
  },
  onGameStarted: (callback) => {
    ipcRenderer.removeAllListeners("game-started");
    ipcRenderer.on("game-started", (_event, gameName) => callback(gameName));
  },
  onGameExited: (callback) => {
    ipcRenderer.removeAllListeners("game-exited");
    ipcRenderer.on("game-exited", (_event, data) => callback(data));
  },

  // Window Controls
  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  maximizeWindow: () => ipcRenderer.send("window-maximize"),
  closeWindow: () => ipcRenderer.send("window-close"),

  // Open external links
  openExternal: (url) => ipcRenderer.send("open-external", url),
});