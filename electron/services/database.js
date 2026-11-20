const { app } = require("electron");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(app.getPath("userData"), "blackpearl_db.json");

function getDB() {
  const defaults = {
    profile: {
      name: "User",
      avatar: "",
      downloadPath: app.getPath("downloads"),
      liteMode: false,
      autoExtract: true,
      cloudSync: {
        enabled: false,
        type: "folder", // "folder" | "webdav"
        folderPath: "",
        webdavUrl: "",
        webdavUser: "",
        webdavPass: "",
      },
      speedLimits: {
        downloadLimit: "0", // "0" = unlimited, or e.g. "5M", "10M", "500K"
        uploadLimit: "0",
      },
      discordRpc: true,
      autoPauseDownloadsInGame: true,
      downloadSchedule: {
        enabled: false,
        startHour: 1,
        startMinute: 0,
        endHour: 7,
        endMinute: 0,
      },
    },
    wishlist: [],
    completedDownloads: [],
    library: [],
    // Tracks how many parts each multi-part game requires.
    // { [gameName]: number }
    multipartRequired: {},
  };

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaults));
    return defaults;
  }

  try {
    const data = JSON.parse(fs.readFileSync(dbPath));
    if (!data.profile) data.profile = defaults.profile;
    if (data.profile.autoExtract === undefined) data.profile.autoExtract = true;
    if (!data.profile.cloudSync) data.profile.cloudSync = defaults.profile.cloudSync;
    if (!data.profile.speedLimits) data.profile.speedLimits = defaults.profile.speedLimits;
    if (data.profile.discordRpc === undefined) data.profile.discordRpc = true;
    if (data.profile.autoPauseDownloadsInGame === undefined) data.profile.autoPauseDownloadsInGame = true;
    if (!data.profile.downloadSchedule) data.profile.downloadSchedule = defaults.profile.downloadSchedule;
    if (!data.library)           data.library = [];
    if (!data.multipartRequired) data.multipartRequired = {};
    
    // Ensure playtime, status and tuning fields exist on all library entries
    data.library = data.library.map(game => ({
      ...game,
      playtimeSeconds: game.playtimeSeconds || 0,
      lastPlayed: game.lastPlayed || null,
      status: game.status || (game.playtimeSeconds > 0 ? "playing" : "backlog"),
      highPriority: !!game.highPriority,
      customEnv: game.customEnv || {},
    }));
    return data;
  } catch (e) {
    return defaults;
  }
}

function saveDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function recordPlaytime(gameName, durationSeconds) {
  let db = getDB();
  const game = db.library.find((g) => g.name === gameName);
  if (game) {
    game.playtimeSeconds = (game.playtimeSeconds || 0) + Math.max(0, Math.floor(durationSeconds));
    game.lastPlayed = new Date().toISOString();
    saveDB(db);
  }
  return db.library;
}

function setupDatabaseIPC(ipcMain) {
  ipcMain.handle("get-db", () => getDB());

  ipcMain.handle("update-profile", (e, profile) => {
    let db = getDB();
    db.profile = profile;
    saveDB(db);
    return db;
  });

  ipcMain.handle("toggle-wishlist", (e, game) => {
    let db = getDB();
    const i = db.wishlist.findIndex((g) => g.name === game.name);
    if (i > -1) db.wishlist.splice(i, 1);
    else db.wishlist.push(game);
    saveDB(db);
    return db.wishlist;
  });

  ipcMain.handle("clear-completed", () => {
    let db = getDB();
    db.completedDownloads = [];
    saveDB(db);
    return db;
  });

  ipcMain.handle("add-to-library", (e, game) => {
    let db = getDB();
    if (!db.library.find((g) => g.name === game.name)) {
      db.library.push({
        ...game,
        exePath: null,
        launchParams: "",
        playtimeSeconds: 0,
        lastPlayed: null,
        addedDate: new Date().toISOString(),
      });
      saveDB(db);
    }
    return db.library;
  });

  ipcMain.handle("record-playtime", (e, { gameName, durationSeconds }) => {
    return recordPlaytime(gameName, durationSeconds);
  });

  ipcMain.handle("remove-from-library", (e, gameName) => {
    let db = getDB();
    db.library = db.library.filter((g) => g.name !== gameName);
    saveDB(db);
    return db.library;
  });

  ipcMain.handle("set-game-exe", (e, { gameName, exePath }) => {
    let db = getDB();
    const game = db.library.find((g) => g.name === gameName);
    if (game) {
      game.exePath = exePath;
      saveDB(db);
    }
    return db.library;
  });

  ipcMain.handle("set-launch-params", (e, { gameName, params }) => {
    let db = getDB();
    const game = db.library.find((g) => g.name === gameName);
    if (game) {
      game.launchParams = params;
      saveDB(db);
    }
    return db.library;
  });

  ipcMain.handle("set-game-status", (e, { gameName, status }) => {
    let db = getDB();
    const game = db.library.find((g) => g.name === gameName);
    if (game) {
      game.status = status;
      saveDB(db);
    }
    return db.library;
  });

  ipcMain.handle("set-game-launch-profile", (e, { gameName, profileData }) => {
    let db = getDB();
    const game = db.library.find((g) => g.name === gameName);
    if (game) {
      if (profileData.launchParams !== undefined) game.launchParams = profileData.launchParams;
      if (profileData.highPriority !== undefined) game.highPriority = profileData.highPriority;
      if (profileData.customEnv !== undefined) game.customEnv = profileData.customEnv;
      saveDB(db);
    }
    return db.library;
  });

  // Register multi-part requirements so isDownloaded can be accurate.
  // The stored value is the MAXIMUM of any previous registration so re-visiting
  // the game page never accidentally lowers the count.
  ipcMain.handle("register-multipart", (e, { gameName, totalParts }) => {
    let db = getDB();
    const existing = db.multipartRequired[gameName] || 0;
    db.multipartRequired[gameName] = Math.max(existing, totalParts);
    saveDB(db);
    return db.multipartRequired;
  });
}

module.exports = { getDB, saveDB, setupDatabaseIPC, recordPlaytime };