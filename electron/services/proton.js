const fs = require("fs");
const path = require("path");
const os = require("os");
const { app } = require("electron");

const isLinux = process.platform === "linux";

// Standard Steam & Proton search directories on Linux / SteamOS
function getProtonSearchPaths() {
  const home = os.homedir();
  return [
    // Custom runners / GE-Proton
    path.join(home, ".steam", "root", "compatibilitytools.d"),
    path.join(home, ".local", "share", "Steam", "compatibilitytools.d"),
    path.join(home, ".var", "app", "com.valvesoftware.Steam", "data", "Steam", "compatibilitytools.d"),

    // Official Valve Protons
    path.join(home, ".steam", "steam", "steamapps", "common"),
    path.join(home, ".local", "share", "Steam", "steamapps", "common"),
    path.join(home, ".var", "app", "com.valvesoftware.Steam", "data", "Steam", "steamapps", "common"),
  ];
}

// Find all installed Proton versions on Linux
function findInstalledProtons() {
  if (!isLinux) return [];

  const found = [];
  const searchPaths = getProtonSearchPaths();

  for (const searchDir of searchPaths) {
    if (!fs.existsSync(searchDir)) continue;

    try {
      const items = fs.readdirSync(searchDir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          const itemPath = path.join(searchDir, item.name);
          const protonBin = path.join(itemPath, "proton");
          const isProton =
            item.name.toLowerCase().includes("proton") ||
            item.name.toLowerCase().includes("ge-") ||
            fs.existsSync(protonBin);

          if (isProton && fs.existsSync(protonBin)) {
            found.push({
              name: item.name,
              path: itemPath,
              bin: protonBin,
            });
          }
        }
      }
    } catch (e) {
      console.warn("[Proton] Directory scan error:", e);
    }
  }

  // Deduplicate by name/path
  const unique = [];
  const seen = new Set();
  for (const p of found) {
    if (!seen.has(p.path)) {
      seen.add(p.path);
      unique.push(p);
    }
  }

  return unique;
}

// Get or create isolated prefix directory for a specific game
function getGamePrefix(gameName) {
  const sanitized = gameName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const prefixBase = path.join(app.getPath("userData"), "proton_prefixes", sanitized);
  
  if (!fs.existsSync(prefixBase)) {
    fs.mkdirSync(prefixBase, { recursive: true });
  }

  return prefixBase;
}

// Prepare launch options for running Windows .exe with Proton on Linux
function buildProtonLaunch(protonBin, prefixPath, exePath, launchParams = "") {
  const home = os.homedir();
  const steamInstall = path.join(home, ".local", "share", "Steam");

  const env = {
    ...process.env,
    STEAM_COMPAT_DATA_PATH: prefixPath,
    STEAM_COMPAT_CLIENT_INSTALL_PATH: steamInstall,
    WINEPREFIX: path.join(prefixPath, "pfx"),
  };

  const args = ["run", exePath];
  if (launchParams && launchParams.trim()) {
    args.push(...launchParams.trim().split(/\s+/));
  }

  return {
    command: protonBin,
    args,
    env,
  };
}

module.exports = {
  isLinux,
  findInstalledProtons,
  getGamePrefix,
  buildProtonLaunch,
};
