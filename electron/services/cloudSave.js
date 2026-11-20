const fs = require("fs");
const path = require("path");
const os = require("os");
const { app } = require("electron");
const { spawn } = require("child_process");
const axios = require("axios");
const { getDB } = require("./database");

const isWin = process.platform === "win32";
const isLinux = process.platform === "linux";

// Get base cloud saves repository inside userData
function getCloudSavesBase() {
  const dir = path.join(app.getPath("userData"), "cloud_saves");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Find candidate save paths on Windows / Linux
function findGameSavePaths(gameName, steamAppId = null) {
  const candidates = [];
  const home = os.homedir();
  const sanitized = gameName.replace(/[^a-zA-Z0-9_-]/g, "");

  if (isWin) {
    const appdata = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    const localappdata = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    const locallow = path.join(home, "AppData", "LocalLow");
    const docs = path.join(home, "Documents");
    const savedGames = path.join(home, "Saved Games");

    // Standard game folders
    const names = [gameName, sanitized, gameName.replace(/\s+/g, "")];
    for (const n of names) {
      candidates.push(path.join(savedGames, n));
      candidates.push(path.join(docs, "My Games", n));
      candidates.push(path.join(docs, n));
      candidates.push(path.join(appdata, n));
      candidates.push(path.join(localappdata, n));
      candidates.push(path.join(locallow, n));
    }

    // Emulator / Crack Steam save locations
    if (steamAppId) {
      const publicDir = process.env.PUBLIC || path.join("C:", "Users", "Public");
      candidates.push(path.join(appdata, "Goldberg SteamEmu Saves", String(steamAppId)));
      candidates.push(path.join(appdata, "RUNE", String(steamAppId)));
      candidates.push(path.join(appdata, "FLT", String(steamAppId)));
      candidates.push(path.join(publicDir, "Documents", "Steam", "CODEX", String(steamAppId)));
      candidates.push(path.join(publicDir, "Documents", "Steam", "RUNE", String(steamAppId)));
    }
  } else if (isLinux) {
    // 1. Proton Wine Prefix paths
    const prefixPfx = path.join(
      app.getPath("userData"),
      "proton_prefixes",
      gameName.replace(/[^a-zA-Z0-9_-]/g, "_"),
      "pfx",
      "drive_c",
      "users",
      "steamuser"
    );

    if (fs.existsSync(prefixPfx)) {
      candidates.push(path.join(prefixPfx, "Saved Games", gameName));
      candidates.push(path.join(prefixPfx, "Documents", "My Games", gameName));
      candidates.push(path.join(prefixPfx, "Documents", gameName));
      candidates.push(path.join(prefixPfx, "AppData", "Roaming", gameName));
      candidates.push(path.join(prefixPfx, "AppData", "Local", gameName));
      if (steamAppId) {
        candidates.push(path.join(prefixPfx, "AppData", "Roaming", "Goldberg SteamEmu Saves", String(steamAppId)));
      }
    }

    // 2. Native Linux paths
    candidates.push(path.join(home, ".local", "share", gameName));
    candidates.push(path.join(home, ".config", gameName));
  }

  // Filter existing directories and files
  const existing = [];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        const stats = fs.statSync(c);
        existing.push({
          path: c,
          isDirectory: stats.isDirectory(),
          mtime: stats.mtime.toISOString(),
          size: stats.size,
        });
      } catch (e) {}
    }
  }

  return existing;
}

// Test WebDAV credentials and connection
async function testWebDAVConnection(config) {
  const { webdavUrl, webdavUser, webdavPass } = config || {};
  if (!webdavUrl || !webdavUrl.startsWith("http")) {
    return { valid: false, message: "Invalid WebDAV URL. Must start with http:// or https://" };
  }

  try {
    const auth = webdavUser ? { username: webdavUser, password: webdavPass || "" } : undefined;
    const res = await axios({
      method: "PROPFIND",
      url: webdavUrl,
      auth,
      headers: { Depth: "0" },
      timeout: 8000,
      validateStatus: () => true,
    });

    if (res.status === 207 || res.status === 200 || res.status === 405) {
      return { valid: true, message: "WebDAV server connected successfully!" };
    } else if (res.status === 401) {
      return { valid: false, message: "Authentication failed. Check username and password." };
    } else {
      return { valid: false, message: `Server returned HTTP ${res.status}` };
    }
  } catch (err) {
    return { valid: false, message: err.message || "Failed to reach WebDAV server" };
  }
}

// Sync local backups with Cloud folder (Google Drive, OneDrive, Dropbox) or WebDAV
async function syncGameSavesToCloud(gameName, customConfig = null) {
  const db = getDB();
  const cloudSync = customConfig || db.profile?.cloudSync;

  if (!cloudSync || !cloudSync.enabled) {
    return { success: true, synced: false, message: "Cloud sync is disabled" };
  }

  const sanitized = gameName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const localDir = path.join(getCloudSavesBase(), sanitized);
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  // ── Mode 1: Cloud Storage Folder (Google Drive / OneDrive / Dropbox) ──────
  if (cloudSync.type === "folder") {
    const cloudBasePath = cloudSync.folderPath;
    if (!cloudBasePath || !fs.existsSync(cloudBasePath)) {
      return { success: false, message: "Configured cloud storage directory does not exist" };
    }

    const cloudTargetDir = path.join(cloudBasePath, "BlackPearlSaves", sanitized);
    if (!fs.existsSync(cloudTargetDir)) {
      fs.mkdirSync(cloudTargetDir, { recursive: true });
    }

    let syncedCount = 0;
    try {
      // 1. Copy local zips to Cloud folder if missing
      const localFiles = fs.readdirSync(localDir).filter((f) => f.endsWith(".zip"));
      for (const f of localFiles) {
        const src = path.join(localDir, f);
        const dest = path.join(cloudTargetDir, f);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
          syncedCount++;
        }
      }

      // 2. Copy remote zips from Cloud folder to local if missing
      const cloudFiles = fs.readdirSync(cloudTargetDir).filter((f) => f.endsWith(".zip"));
      for (const f of cloudFiles) {
        const src = path.join(cloudTargetDir, f);
        const dest = path.join(localDir, f);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
          syncedCount++;
        }
      }

      console.log(`[CloudSave] Synced ${syncedCount} snapshots for ${gameName} with cloud folder`);
      return {
        success: true,
        synced: true,
        type: "folder",
        cloudTargetDir,
        syncedCount,
      };
    } catch (err) {
      console.error("[CloudSave] Folder sync error:", err);
      return { success: false, message: err.message };
    }
  }

  // ── Mode 2: WebDAV Remote Server ──────────────────────────────────────────
  if (cloudSync.type === "webdav") {
    const { webdavUrl, webdavUser, webdavPass } = cloudSync;
    if (!webdavUrl || !webdavUrl.startsWith("http")) {
      return { success: false, message: "Invalid WebDAV configuration" };
    }

    const auth = webdavUser ? { username: webdavUser, password: webdavPass || "" } : undefined;
    const baseUrl = webdavUrl.replace(/\/$/, "");

    try {
      // Ensure remote /BlackPearlSaves/ and /BlackPearlSaves/<Game>/ exist via MKCOL
      const rootRemoteDir = `${baseUrl}/BlackPearlSaves`;
      const gameRemoteDir = `${rootRemoteDir}/${sanitized}`;

      await axios({ method: "MKCOL", url: rootRemoteDir, auth, validateStatus: () => true }).catch(() => {});
      await axios({ method: "MKCOL", url: gameRemoteDir, auth, validateStatus: () => true }).catch(() => {});

      // Upload latest local backup
      const localFiles = fs.readdirSync(localDir).filter((f) => f.endsWith(".zip"));
      if (localFiles.length > 0) {
        const latestFile = localFiles.sort().pop();
        const localFilePath = path.join(localDir, latestFile);
        const remoteTargetUrl = `${gameRemoteDir}/${latestFile}`;
        const fileData = fs.readFileSync(localFilePath);

        await axios({
          method: "PUT",
          url: remoteTargetUrl,
          auth,
          data: fileData,
          headers: { "Content-Type": "application/zip" },
          timeout: 20000,
        });

        console.log(`[CloudSave] Uploaded ${latestFile} to WebDAV server: ${remoteTargetUrl}`);
        return { success: true, synced: true, type: "webdav", remoteUrl: remoteTargetUrl };
      }
    } catch (err) {
      console.error("[CloudSave] WebDAV sync error:", err.message);
      return { success: false, message: err.message };
    }
  }

  return { success: true, synced: false };
}

// Backup game save directory into a zip archive and auto-sync with cloud
async function backupGameSaves(gameName, customSavePath = null, steamAppId = null) {
  let saveTargets = [];

  if (customSavePath && fs.existsSync(customSavePath)) {
    saveTargets.push({ path: customSavePath, isDirectory: fs.statSync(customSavePath).isDirectory() });
  } else {
    saveTargets = findGameSavePaths(gameName, steamAppId);
  }

  if (saveTargets.length === 0) {
    return { success: false, message: "No active save directory found for this game." };
  }

  const sanitized = gameName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const gameSaveDir = path.join(getCloudSavesBase(), sanitized);
  if (!fs.existsSync(gameSaveDir)) {
    fs.mkdirSync(gameSaveDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupZip = path.join(gameSaveDir, `backup_${timestamp}.zip`);

  try {
    // Compress saves using built-in tar or PowerShell
    const primaryTarget = saveTargets[0].path;
    await new Promise((resolve, reject) => {
      let proc;
      if (isWin) {
        proc = spawn("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Compress-Archive -Path '${primaryTarget.replace(/'/g, "''")}' -DestinationPath '${backupZip.replace(/'/g, "''")}' -Force`,
        ]);
      } else {
        proc = spawn("tar", ["-czf", backupZip, "-C", path.dirname(primaryTarget), path.basename(primaryTarget)]);
      }

      proc.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Compression process exited with code ${code}`));
      });
      proc.on("error", reject);
    });

    const stat = fs.statSync(backupZip);

    // Auto-sync with cloud if enabled
    let cloudResult = null;
    try {
      cloudResult = await syncGameSavesToCloud(gameName);
    } catch (e) {
      console.warn("[CloudSave] Auto-cloud sync warning:", e);
    }

    return {
      success: true,
      backupPath: backupZip,
      timestamp: new Date().toISOString(),
      size: stat.size,
      sourcePath: primaryTarget,
      cloudSync: cloudResult,
    };
  } catch (err) {
    console.error("[CloudSave] Backup error:", err);
    return { success: false, message: err.message };
  }
}

// Restore game save from backup archive
async function restoreGameSaves(backupZipPath, targetDir) {
  if (!fs.existsSync(backupZipPath)) {
    return { success: false, message: "Backup archive not found" };
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  try {
    await new Promise((resolve, reject) => {
      let proc;
      if (isWin) {
        proc = spawn("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Expand-Archive -Path '${backupZipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`,
        ]);
      } else {
        proc = spawn("tar", ["-xzf", backupZipPath, "-C", targetDir]);
      }

      proc.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Restore process exited with code ${code}`));
      });
      proc.on("error", reject);
    });

    return { success: true, targetDir };
  } catch (err) {
    console.error("[CloudSave] Restore error:", err);
    return { success: false, message: err.message };
  }
}

// Get all backup records for a game (merges local and cloud folder snapshots)
function getGameSaveHistory(gameName) {
  const sanitized = gameName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const gameSaveDir = path.join(getCloudSavesBase(), sanitized);
  const recordsMap = new Map();

  // 1. Read local snapshots
  if (fs.existsSync(gameSaveDir)) {
    try {
      const files = fs.readdirSync(gameSaveDir);
      for (const f of files.filter((x) => x.endsWith(".zip"))) {
        const full = path.join(gameSaveDir, f);
        const stats = fs.statSync(full);
        recordsMap.set(f, {
          filename: f,
          path: full,
          size: stats.size,
          mtime: stats.mtime.toISOString(),
          isCloud: false,
        });
      }
    } catch (e) {}
  }

  // 2. Read cloud folder snapshots if configured
  try {
    const db = getDB();
    const cloudSync = db.profile?.cloudSync;
    if (cloudSync?.enabled && cloudSync?.type === "folder" && cloudSync.folderPath) {
      const cloudDir = path.join(cloudSync.folderPath, "BlackPearlSaves", sanitized);
      if (fs.existsSync(cloudDir)) {
        const cloudFiles = fs.readdirSync(cloudDir);
        for (const f of cloudFiles.filter((x) => x.endsWith(".zip"))) {
          if (!recordsMap.has(f)) {
            const full = path.join(cloudDir, f);
            const stats = fs.statSync(full);
            recordsMap.set(f, {
              filename: f,
              path: full,
              size: stats.size,
              mtime: stats.mtime.toISOString(),
              isCloud: true,
            });
          }
        }
      }
    }
  } catch (e) {}

  return Array.from(recordsMap.values()).sort(
    (a, b) => new Date(b.mtime) - new Date(a.mtime),
  );
}

module.exports = {
  findGameSavePaths,
  backupGameSaves,
  restoreGameSaves,
  getGameSaveHistory,
  syncGameSavesToCloud,
  testWebDAVConnection,
};

