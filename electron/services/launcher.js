const { app, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const { getDB, recordPlaytime } = require("./database");
const { isLinux, findInstalledProtons, getGamePrefix, buildProtonLaunch } = require("./proton");
const { backupGameSaves } = require("./cloudSave");
const { startAchievementWatcher, stopAchievementWatcher } = require("./achievements");
const { getSteamCache } = require("./steam");
const { setGameActivity, setIdleActivity } = require("./discordRpc");
const { showAchievementNotification } = require("./overlay");

const activeGameProcesses = new Map();

function setupLauncherIPC(ipcMain, getMainWindow) {
  ipcMain.handle("open-game-folder", async (e, exePath) => {
    const folderPath = exePath
      ? path.dirname(exePath)
      : getDB().profile.downloadPath || app.getPath("downloads");
    const result = await shell.openPath(folderPath);
    return !result;
  });

  ipcMain.handle("select-exe", async () => {
    const isWin = process.platform === "win32";
    const isMac = process.platform === "darwin";
    const filters = isWin
      ? [
          { name: "Executables", extensions: ["exe"] },
          { name: "All Files", extensions: ["*"] },
        ]
      : isMac
        ? [
            { name: "Applications", extensions: ["app"] },
            { name: "Shell Scripts", extensions: ["sh"] },
            { name: "All Files", extensions: ["*"] },
          ]
        : [
            { name: "All Files", extensions: ["*"] },
            { name: "Executables", extensions: ["exe", "x86_64", "bin", "sh"] },
          ];

    const mainWindow = getMainWindow();
    const r = await dialog.showOpenDialog(mainWindow, {
      title: "Select Game Executable",
      properties: ["openFile"],
      filters,
    });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle("launch-game", async (e, { gameName, exePath, launchParams }) => {
    if (activeGameProcesses.has(gameName)) {
      return { success: false, message: "Game is already running" };
    }

    try {
      const db = getDB();
      const gameEntry = db.library.find((g) => g.name === gameName) || {};
      const customEnv = gameEntry.customEnv || {};

      let proc;
      // Regex parsing for launch params to respect quoted paths
      const args = launchParams 
        ? launchParams.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(s => s.replace(/(^"|"$)/g, '')) || [] 
        : [];

      if (process.platform === "darwin" && exePath.endsWith(".app")) {
        proc = spawn("open", [exePath, "--args", ...args], {
          env: { ...process.env, ...customEnv },
          stdio: "ignore",
        });
      } else if (isLinux && exePath.toLowerCase().endsWith(".exe")) {
        // Proton Linux launch
        const protons = findInstalledProtons();
        if (protons.length > 0) {
          const proton = protons[0];
          const prefix = getGamePrefix(gameName);
          const launchConfig = buildProtonLaunch(proton.bin, prefix, exePath, launchParams);
          console.log(`[Launcher] Launching via Proton (${proton.name}) for ${gameName}`);
          proc = spawn(launchConfig.command, launchConfig.args, {
            env: { ...launchConfig.env, ...customEnv },
            cwd: path.dirname(exePath),
            stdio: "ignore",
          });
        } else {
          // Native / Wine fallback
          proc = spawn("wine", [exePath, ...args], {
            env: { ...process.env, ...customEnv },
            cwd: path.dirname(exePath),
            stdio: "ignore",
          });
        }
      } else {
        proc = spawn(exePath, args, {
          env: { ...process.env, ...customEnv },
          stdio: "ignore",
          cwd: path.dirname(exePath),
        });
      }

      // If high priority requested, set process priority
      if (gameEntry.highPriority && proc?.pid) {
        try {
          const os = require("os");
          os.setPriority(proc.pid, os.constants.priority.PRIORITY_HIGH);
        } catch (e) {}
      }

      const startTime = Date.now();
      activeGameProcesses.set(gameName, { proc, startTime });

      // Auto-pause active downloads while in game
      try {
        const { handleGameStartedAutoPause } = require("./scheduler");
        handleGameStartedAutoPause();
      } catch (e) {}

      // Update Discord RPC
      setGameActivity(gameName, startTime);

      let cleanedUp = false;
      const cleanup = (code) => {
        if (cleanedUp) return;
        cleanedUp = true;

        const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        console.log(`[Launcher] ${gameName} exited (code ${code}), session duration: ${durationSeconds}s`);
        
        activeGameProcesses.delete(gameName);
        stopAchievementWatcher(gameName);
        setIdleActivity();
        const updatedLibrary = recordPlaytime(gameName, durationSeconds);

        // Resume downloads if paused by game
        try {
          const { handleGameExitedAutoResume } = require("./scheduler");
          handleGameExitedAutoResume();
        } catch (e) {}

        // Auto backup game saves on exit
        const currentDb = getDB();
        if (currentDb.profile?.autoCloudBackup !== false) {
          backupGameSaves(gameName)
            .then((res) => {
              if (res.success) {
                console.log(`[CloudSave] Auto-backed up saves for ${gameName}`);
              }
            })
            .catch((err) => console.error("[CloudSave] Backup error:", err));
        }

        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("game-exited", {
            gameName,
            durationSeconds,
            library: updatedLibrary,
          });
        }
      };

      proc.on("exit", cleanup);
      proc.on("error", (err) => {
        console.error(`[Launcher] Error launching ${gameName}:`, err);
        cleanup(-1);
      });

      // Start achievement monitoring
      try {
        const steamCache = getSteamCache ? getSteamCache() : {};
        const appId = steamCache[gameName]?.appid || steamCache[gameName]?.id || null;
        startAchievementWatcher(gameName, appId, (unlockEvent) => {
          // 1. Show in-game Steam-style overlay
          try {
            showAchievementNotification(unlockEvent);
          } catch (e) {
            console.warn("[Overlay] Show error:", e);
          }

          // 2. Notify main window
          const mainWindow = getMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("achievement-unlocked", unlockEvent);
          }
        });
      } catch (err) {
        console.warn("[Launcher] Achievement watcher init error:", err);
      }

      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("game-started", gameName);
        mainWindow.minimize(); // Auto-minimize window
      }

      return { success: true };
    } catch (err) {
      console.error("[Launcher] Launch error:", err);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle("kill-game", async (e, gameName) => {
    const entry = activeGameProcesses.get(gameName);
    if (entry) {
      const proc = entry.proc || entry;
      try {
        if (process.platform === "win32" && proc.pid) {
          spawn("taskkill", ["/pid", proc.pid, "/f", "/t"]);
        } else if (proc.kill) {
          proc.kill();
        }
      } catch (err) {
        console.error("[Launcher] Kill error:", err);
      }
      
      const startTime = entry.startTime || Date.now();
      const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      activeGameProcesses.delete(gameName);
      stopAchievementWatcher(gameName);
      const updatedLibrary = recordPlaytime(gameName, durationSeconds);

      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("game-exited", {
          gameName,
          durationSeconds,
          library: updatedLibrary,
        });
      }
    }
    return true;
  });
}

function killAllGames() {
  activeGameProcesses.forEach((entry) => {
    try {
      const proc = entry.proc || entry;
      if (proc.kill) proc.kill();
    } catch (e) {}
  });
}

module.exports = { setupLauncherIPC, killAllGames };