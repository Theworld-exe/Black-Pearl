const { app, BrowserWindow, session } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const net = require("net");
const crypto = require("crypto");
const Aria2 = require("aria2").default || require("aria2");
const { getDB, saveDB } = require("./database");
const { scrapeDirectLink } = require("./scrapers/manager");
const { unrestrictLink, unrestrictMagnet } = require("./debrid");

let aria2Process;
let aria2;
let aria2Secret = "";
const activeGameMap = new Map();

// --- DYNAMIC PORT SCANNER ---
function findFreePort(startPort, maxPort = 6900) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        if (startPort < maxPort) {
          console.log(
            `[ARIA2] Port ${startPort} is busy, trying ${startPort + 1}...`,
          );
          resolve(findFreePort(startPort + 1, maxPort));
        } else {
          reject(new Error("No free ports available for Aria2"));
        }
      } else {
        reject(err);
      }
    });
    server.listen(startPort, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

async function startAria2() {
  const binaryName =
    process.platform === "darwin"
      ? "aria2c"
      : process.platform === "linux"
        ? "aria2c-linux"
        : "aria2c.exe";

  const ariaPath = app.isPackaged
    ? path.join(process.resourcesPath, binaryName)
    : path.join(app.getAppPath(), binaryName);

  if (!fs.existsSync(ariaPath)) {
    console.error("ARIA2 BINARY NOT FOUND at:", ariaPath);
    return false;
  }

  try {
    const freePort = await findFreePort(6800);
    console.log(`[ARIA2] Found free port: ${freePort}`);

    aria2Secret = crypto.randomBytes(16).toString("hex");

    aria2 = new Aria2({
      host: "127.0.0.1",
      port: freePort,
      secure: false,
      secret: aria2Secret,
    });

    aria2Process = spawn(
      ariaPath,
      [
        "--enable-rpc",
        "--rpc-listen-all=false",
        `--rpc-listen-port=${freePort}`,
        `--rpc-secret=${aria2Secret}`,
        "--max-connection-per-server=16",
        "--split=32",
        "--continue=true",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    aria2Process.stderr.on("data", (d) =>
      console.error("[ARIA2 ERR]", d.toString().trim()),
    );
    aria2Process.on("error", (err) => console.error("ARIA2 ERROR:", err));
    aria2Process.on("exit", (code) => console.log("ARIA2 EXIT:", code));

    return true;
  } catch (err) {
    console.error("FAILED TO START ARIA2:", err);
    return false;
  }
}

async function connectAria2(maxRetries = 15) {
  if (!aria2) return false;
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await aria2.open();
      console.log(`[ARIA2] Connected successfully on port ${aria2.port}`);

      // Apply saved speed limits from profile
      const db = getDB();
      if (db.profile?.speedLimits) {
        const { downloadLimit, uploadLimit } = db.profile.speedLimits;
        if (downloadLimit || uploadLimit) {
          aria2
            .call("changeGlobalOption", {
              "max-overall-download-limit": String(downloadLimit || "0"),
              "max-overall-upload-limit": String(uploadLimit || "0"),
            })
            .catch(() => {});
        }
      }

      return true;
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  console.error("[ARIA2] Failed to connect after all retries");
  return false;
}

async function setAria2SpeedLimits(downloadLimit = "0", uploadLimit = "0") {
  if (!aria2) return { success: false, message: "Aria2 not running" };
  try {
    const options = {
      "max-overall-download-limit": String(downloadLimit || "0"),
      "max-overall-upload-limit": String(uploadLimit || "0"),
    };
    await aria2.call("changeGlobalOption", options);
    const db = getDB();
    if (!db.profile) db.profile = {};
    db.profile.speedLimits = { downloadLimit, uploadLimit };
    saveDB(db);
    return { success: true, downloadLimit, uploadLimit };
  } catch (err) {
    console.error("[ARIA2] Set speed limits error:", err);
    return { success: false, message: err.message };
  }
}

async function getAria2SpeedLimits() {
  if (!aria2) {
    const db = getDB();
    return db.profile?.speedLimits || { downloadLimit: "0", uploadLimit: "0" };
  }
  try {
    const opts = await aria2.call("getGlobalOption");
    return {
      downloadLimit: opts["max-overall-download-limit"] || "0",
      uploadLimit: opts["max-overall-upload-limit"] || "0",
    };
  } catch (err) {
    const db = getDB();
    return db.profile?.speedLimits || { downloadLimit: "0", uploadLimit: "0" };
  }
}

function startPolling(getMainWindow) {
  setInterval(async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow || !aria2Process || !aria2) return;

    try {
      const active = await aria2.call("tellActive");
      const waiting = await aria2.call("tellWaiting", 0, 100);
      const stopped = await aria2.call("tellStopped", 0, 100);
      const completed = stopped.filter((d) => d.status === "complete");

      if (completed.length > 0) {
        let db = getDB();
        let updated = false;

        for (const c of completed) {
          // BUG FIX: Ignore metadata file completions from torrents!
          // If followedBy is present, this gid was just a .torrent payload which spawned the real download
          if (c.followedBy && c.followedBy.length > 0) {
            const newGid = c.followedBy[0];
            const gameName = activeGameMap.get(c.gid);
            if (gameName) activeGameMap.set(newGid, gameName);

            try {
              await aria2.call("removeDownloadResult", c.gid);
            } catch (e) {}
            continue; // Skip adding to completedDownloads
          }

          const fileName =
            c.bittorrent?.info?.name ||
            c.files[0]?.path?.split(/[/\\]/).pop() ||
            "Unknown File";
          const gameName = activeGameMap.get(c.gid) || fileName;

          if (!db.completedDownloads.find((x) => x.gid === c.gid)) {
            const completedItem = {
              gid: c.gid,
              name: fileName,
              gameName,
              date: new Date().toISOString(),
            };
            db.completedDownloads.push(completedItem);
            updated = true;

            // Trigger auto-extract if enabled in profile (defaults to true)
            if (db.profile?.autoExtract !== false) {
              const dlPath = db.profile?.downloadPath || app.getPath("downloads");
              const fullFilePath = c.files[0]?.path || path.join(dlPath, fileName);
              const { extractArchive, isArchive, sanitizeFolderName } = require("./extractor");
              const { findPrimaryExecutable, resolveSteamMetadata } = require("./gameScanner");

              if (isArchive(fullFilePath) || isArchive(fileName)) {
                console.log(`[AutoExtract] Starting automatic extraction for: ${gameName}`);
                const cleanTitle = sanitizeFolderName(gameName);
                const targetGameDir = path.join(dlPath, cleanTitle);

                extractArchive(
                  fullFilePath,
                  targetGameDir,
                  (status) => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                      mainWindow.webContents.send("extract-progress", {
                        filePath: fullFilePath,
                        gameName,
                        status,
                      });
                    }
                  },
                  {
                    gameName: cleanTitle,
                    autoDelete: true,
                    mainGamesDir: dlPath,
                  },
                ).then(async (res) => {
                  if (res.success) {
                    console.log(`[AutoExtract] Successfully extracted ${gameName} to ${res.extractedPath}`);
                    completedItem.extractedPath = res.extractedPath;

                    // Automatically link primary executable and register to Library
                    const primaryExe =
                      findPrimaryExecutable(res.extractedPath, cleanTitle) ||
                      (res.executables && res.executables[0]?.path);

                    if (primaryExe) {
                      let currentDB = getDB();
                      const meta = await resolveSteamMetadata(cleanTitle);
                      const existing = currentDB.library.find(
                        (g) =>
                          g.name.toLowerCase() === cleanTitle.toLowerCase() ||
                          g.name.toLowerCase() === gameName.toLowerCase(),
                      );
                      if (!existing) {
                        currentDB.library.push({
                          name: cleanTitle,
                          clean_name: cleanTitle,
                          thumbnail_link: meta.thumbnail_link,
                          steamAppId: meta.steamAppId || null,
                          categories: meta.categories || ["PC Game"],
                          exePath: primaryExe,
                          launchParams: "",
                          playtimeSeconds: 0,
                          lastPlayed: null,
                          addedDate: new Date().toISOString(),
                        });
                        saveDB(currentDB);
                        console.log(
                          `[AutoExtract] Added ${cleanTitle} to user Library with exe: ${primaryExe}`,
                        );
                      } else if (!existing.exePath) {
                        existing.exePath = primaryExe;
                        saveDB(currentDB);
                      }
                    }

                    if (mainWindow && !mainWindow.isDestroyed()) {
                      mainWindow.webContents.send("extract-complete", {
                        gameName,
                        extractedPath: res.extractedPath,
                        exePath: primaryExe,
                        deletedFiles: res.deletedFiles,
                      });
                    }
                  } else {
                    console.warn(
                      `[AutoExtract] Extraction failed for ${fileName}:`,
                      res.message,
                    );
                  }
                }).catch((err) => console.error("[AutoExtract] Error:", err));
              }
            }
          }

          try {
            await aria2.call("removeDownloadResult", c.gid);
          } catch (e) {}
        }

        if (updated) saveDB(db);
      }

      mainWindow.webContents.send(
        "download-update",
        [...active, ...waiting].map((d) => {
          let name = d.files[0]?.path?.split(/[/\\]/).pop() || "Resolving...";
          if (d.bittorrent && d.bittorrent.info && d.bittorrent.info.name) {
            name = d.bittorrent.info.name;
          }

          // Parse inner files for UI tracking
          const files = d.files
            ? d.files
                .filter((f) => f.path && f.selected === "true")
                .map((f) => ({
                  path: f.path.split(/[/\\]/).pop(),
                  completed: Number(f.completedLength || 0),
                  total: Number(f.length || 0),
                }))
            : [];

          return {
            gid: d.gid,
            gameName: activeGameMap.get(d.gid) || name,
            name: name,
            total: Number(d.totalLength || 0),
            completed: Number(d.completedLength || 0),
            speed: Number(d.downloadSpeed || 0),
            status: d.status,
            files: files,
            isTorrent: !!d.bittorrent,
            numSeeders: Number(d.numSeeders || 0),
            connections: Number(d.connections || 0),
            uploadSpeed: Number(d.uploadSpeed || 0),
            uploadLength: Number(d.uploadLength || 0),
          };
        }),
      );
    } catch (e) {}
  }, 1000);
}

function setupAria2IPC(ipcMain, getAdBlocker) {
  ipcMain.handle(
    "pause-download",
    async (e, gid) => await aria2.call("pause", gid),
  );
  ipcMain.handle(
    "resume-download",
    async (e, gid) => await aria2.call("unpause", gid),
  );
  ipcMain.handle("cancel-download", async (e, gid) => {
    try {
      const status = await aria2.call("tellStatus", gid);
      await aria2.call("forceRemove", gid);
      if (status && status.files) {
        status.files.forEach((f) => {
          if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
          const ariaFile = f.path + ".aria2";
          if (fs.existsSync(ariaFile)) fs.unlinkSync(ariaFile);
        });
      }
    } catch (err) {
      console.error("Cancel Error:", err);
    }
  });

  ipcMain.handle("set-speed-limits", async (e, { downloadLimit, uploadLimit }) => {
    return await setAria2SpeedLimits(downloadLimit, uploadLimit);
  });

  ipcMain.handle("get-speed-limits", async () => {
    return await getAria2SpeedLimits();
  });

  ipcMain.on("start-smart-download", async (event, hostUrl, gameName) => {
    const db = getDB();
    const debrid = db.profile?.debrid;

    // Treat hostUrl as a single string link
    const currentUrl = Array.isArray(hostUrl) ? hostUrl[0] : hostUrl;

    // ── 1. DEBRID FAST-PATH (If enabled & API key configured) ─────────────────
    if (debrid?.enabled && debrid?.apiKey) {
      if (currentUrl.startsWith("magnet:")) {
        console.log(`[Debrid] Attempting to unrestrict magnet via ${debrid.provider}...`);
        try {
          const debridRes = await unrestrictMagnet(debrid.provider, debrid.apiKey, currentUrl);
          if (debridRes) {
            const links = Array.isArray(debridRes) ? debridRes : [debridRes];
            for (const item of links) {
              const fileName = item.filename || item.url.split("?")[0].split("/").pop() || "game_download";
              const gid = await aria2.call("addUri", [item.url], {
                dir: db.profile.downloadPath || app.getPath("downloads"),
                out: `[BlackPearl] ${fileName}`,
              });
              activeGameMap.set(gid, gameName);
            }
            event.sender.send("download-started", {
              gameName,
              fileName: `[${debrid.provider.toUpperCase()}] Fast Stream`,
            });
            return;
          }
        } catch (err) {
          console.error("[Debrid] Magnet unrestrict failed, falling back:", err);
        }
      } else {
        console.log(`[Debrid] Attempting to unrestrict host link via ${debrid.provider}...`);
        try {
          const debridRes = await unrestrictLink(debrid.provider, debrid.apiKey, currentUrl);
          if (debridRes && debridRes.url) {
            const fileName = debridRes.filename || debridRes.url.split("?")[0].split("/").pop() || "game_download";
            const gid = await aria2.call("addUri", [debridRes.url], {
              dir: db.profile.downloadPath || app.getPath("downloads"),
              out: `[BlackPearl] ${fileName}`,
            });
            activeGameMap.set(gid, gameName);
            event.sender.send("download-started", {
              gameName,
              fileName: `[${debrid.provider.toUpperCase()}] ${fileName}`,
            });
            return;
          }
        } catch (err) {
          console.error("[Debrid] Link unrestrict failed, falling back:", err);
        }
      }
    }

    // ── 2. NATIVE MAGNET / TORRENT HANDLER ────────────────────────────────────
    if (currentUrl.startsWith("magnet:")) {
      try {
        const gid = await aria2.call("addUri", [currentUrl], {
          dir: db.profile.downloadPath || app.getPath("downloads"),
        });
        activeGameMap.set(gid, gameName);
        event.sender.send("download-started", {
          gameName,
          fileName: "Torrent Download",
        });
      } catch (e) {
        console.error("Magnet error:", e);
      }
      return;
    }

    // ── 3. NATIVE DIRECT SCRAPERS ─────────────────────────────────────────────
    const scrapeResult = await scrapeDirectLink(currentUrl);
    if (scrapeResult) {
      let targetUrl = "";
      let customHeaders = [];

      if (typeof scrapeResult === "string") {
        targetUrl = scrapeResult;
      } else if (typeof scrapeResult === "object" && scrapeResult.url) {
        targetUrl = scrapeResult.url;
        customHeaders = scrapeResult.headers || [];
      }

      console.log("[Scraper] Success! Sending to Aria2:", targetUrl);
      const fileName =
        targetUrl.split("?")[0].split("/").pop() || "game_download";

      try {
        const ariaOptions = {
          dir: db.profile.downloadPath || app.getPath("downloads"),
          out: `[BlackPearl] ${fileName}`,
        };

        if (customHeaders.length > 0) {
          ariaOptions.header = customHeaders;
        }

        const gid = await aria2.call("addUri", [targetUrl], ariaOptions);

        activeGameMap.set(gid, gameName);
        event.sender.send("download-started", { gameName, fileName });

        return;
      } catch (err) {
        console.error(
          "[ARIA2] Direct download failed, falling back to window.",
        );
      }
    }

    console.log("[Scraper] Failed or unsupported. Opening Stealth Window.");

    const uniqueSessionId = `stealth_${Date.now()}_${Math.random()}`;
    const dlSession = session.fromPartition(uniqueSessionId);
    const adBlocker = getAdBlocker();
    if (adBlocker) adBlocker.enableBlockingInSession(dlSession);

    const realUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    dlSession.setUserAgent(realUA);

    let downloadWin = new BrowserWindow({
      width: 1100,
      height: 750,
      show: true,
      title: "Black Pearl - Please solve captcha or click Download...",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        session: dlSession,
        disableBlinkFeatures: "AutomationControlled",
      },
    });

    downloadWin.webContents.setWindowOpenHandler(() => {
      return { action: "deny" };
    });

    downloadWin.webContents.on("did-start-navigation", () => {
      downloadWin.webContents
        .executeJavaScript(
          `
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
          Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
          Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] }); // Fake having browser plugins
      `,
        )
        .catch(() => {});
    });

    downloadWin.webContents.on("did-finish-load", () => {
      const injectedUI = `
        Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        if (!document.getElementById('bp-back-btn')) {
          const btn = document.createElement('button');
          btn.id = 'bp-back-btn';
          btn.innerHTML = '⬅ Go Back';
          btn.style.cssText = 'position:fixed; bottom:20px; left:20px; z-index:2147483647; padding:12px 20px; background:#ef4444; color:white; border:none; border-radius:8px; font-weight:bold; font-family:sans-serif; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.5); font-size: 14px;';
          btn.onclick = (e) => { e.preventDefault(); window.history.back(); };
          document.body.appendChild(btn);
        }
      `;
      downloadWin.webContents.executeJavaScript(injectedUI).catch(() => {});
    });

    let hasIntercepted = false;
    dlSession.on("will-download", async (e, item) => {
      if (hasIntercepted) {
        e.preventDefault();
        return;
      }
      hasIntercepted = true;
      e.preventDefault();
      if (downloadWin.isDestroyed()) return;

      const directUrlItem = item.getURLChain().pop();
      const downloadedFileName = item.getFilename();

      try {
        const cookies = await dlSession.cookies.get({});
        const exactReferer = downloadWin.webContents.getURL();

        const gid = await aria2.call("addUri", [directUrlItem], {
          header: [
            `Cookie: ${cookies.map((c) => `${c.name}=${c.value}`).join("; ")}`,
            `User-Agent: ${realUA}`,
            `Referer: ${exactReferer}`,
          ],
          dir: db.profile.downloadPath || app.getPath("downloads"),
          out: `[BlackPearl] ${downloadedFileName}`,
        });
        activeGameMap.set(gid, gameName);
        event.sender.send("download-started", {
          gameName,
          fileName: downloadedFileName,
        });
      } catch (err) {
        console.error(err);
      } finally {
        if (!downloadWin.isDestroyed()) downloadWin.close();
      }
    });

    downloadWin.loadURL(currentUrl);
  });
}

async function call(method, ...params) {
  if (!aria2) {
    throw new Error("Aria2 RPC client is not initialized");
  }
  return await aria2.call(method, ...params);
}

function killAria2() {
  if (aria2Process) aria2Process.kill();
}

module.exports = {
  startAria2,
  connectAria2,
  startPolling,
  setupAria2IPC,
  killAria2,
  setAria2SpeedLimits,
  getAria2SpeedLimits,
  call,
};
