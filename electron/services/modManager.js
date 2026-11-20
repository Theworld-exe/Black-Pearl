const fs = require("fs");
const path = require("path");

// Detect Game Engine and appropriate mod directory structure relative to the game exe
function detectGameEngineAndModStructure(exePath) {
  if (!exePath || !fs.existsSync(exePath)) {
    return {
      engine: "Unknown",
      exeDir: "",
      modDir: "",
      hasReShade: false,
      isReShadeEnabled: false,
      installedMods: [],
    };
  }

  const exeDir = path.dirname(exePath);
  const parentDir = path.dirname(exeDir);
  let engine = "Standard Executable";
  let modDir = exeDir;

  // 1. Check for Unreal Engine (*Content/Paks, Binaries/Win64)
  const isUEBinaries =
    exeDir.toLowerCase().includes("binaries") ||
    exeDir.toLowerCase().includes("win64") ||
    exeDir.toLowerCase().includes("win32");

  let ueContentDir = null;
  if (isUEBinaries) {
    // Check parent or sibling folders for Content/Paks
    const candidates = [
      path.join(parentDir, "Content", "Paks"),
      path.join(path.dirname(parentDir), "Content", "Paks"),
      path.join(exeDir, "Content", "Paks"),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        ueContentDir = c;
        break;
      }
    }
  }

  if (ueContentDir) {
    engine = "Unreal Engine";
    modDir = path.join(ueContentDir, "~mods");
  } else {
    // 2. Check for Unity (*_Data folder or UnityPlayer.dll)
    const files = fs.existsSync(exeDir) ? fs.readdirSync(exeDir) : [];
    const hasUnityData = files.some((f) => f.endsWith("_Data") || f.toLowerCase() === "unityplayer.dll");
    if (hasUnityData) {
      engine = "Unity";
      const bepInEx = path.join(exeDir, "BepInEx", "plugins");
      modDir = fs.existsSync(bepInEx) ? bepInEx : exeDir;
    } else {
      // 3. Check for RE Engine (re2_data, re3_data, etc. or reframework)
      const hasREEngine = files.some(
        (f) => f.includes("_data") || f.toLowerCase() === "reframework" || f.toLowerCase() === "dinput8.dll"
      );
      if (hasREEngine) {
        engine = "RE Engine / Capcom";
        const reFrameworkMods = path.join(exeDir, "reframework", "autorun");
        modDir = fs.existsSync(reFrameworkMods) ? reFrameworkMods : exeDir;
      } else {
        // 4. Check for Bethesda / Gamebryo (Data folder)
        const dataFolder = path.join(exeDir, "Data");
        if (fs.existsSync(dataFolder) && fs.statSync(dataFolder).isDirectory()) {
          engine = "Creation / Gamebryo Engine";
          modDir = dataFolder;
        }
      }
    }
  }

  // Check ReShade files in exe directory
  const reshadeFiles = ["dxgi.dll", "d3d11.dll", "d3d12.dll", "d3d9.dll", "opengl32.dll"];
  const existingWrapper = reshadeFiles.find((f) => fs.existsSync(path.join(exeDir, f)));
  const disabledWrapper = reshadeFiles.find((f) => fs.existsSync(path.join(exeDir, `${f}.disabled`)));

  const hasReShade = !!existingWrapper || !!disabledWrapper;
  const isReShadeEnabled = !!existingWrapper;

  return {
    engine,
    exeDir,
    modDir,
    hasReShade,
    isReShadeEnabled,
    activeHook: existingWrapper || disabledWrapper || "dxgi.dll",
    installedMods: listInstalledMods(exePath, modDir),
  };
}

// List installed mods in the game's executable directory and mod folder
function listInstalledMods(exePath, customModDir = null) {
  if (!exePath || !fs.existsSync(exePath)) return [];

  const exeDir = path.dirname(exePath);
  const targetDirs = new Set([exeDir]);
  if (customModDir && fs.existsSync(customModDir)) {
    targetDirs.add(customModDir);
  }

  const mods = [];
  const modExtensions = [".pak", ".asi", ".dll", ".lua", ".ini", ".bsp", ".zip"];

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        // Skip game exe and default system dlls
        if (item.toLowerCase() === path.basename(exePath).toLowerCase()) continue;
        if (["unityplayer.dll", "steam_api.dll", "steam_api64.dll", "crashhandler.dll"].includes(item.toLowerCase()))
          continue;

        const fullPath = path.join(dir, item);
        const stats = fs.statSync(fullPath);
        const isDir = stats.isDirectory();
        const ext = path.extname(item).toLowerCase();
        const isModExt = modExtensions.includes(ext) || item.endsWith(".disabled");

        if (isModExt || (isDir && !["Content", "Binaries", "Engine", "Data"].includes(item))) {
          const isEnabled = !item.endsWith(".disabled");
          const displayName = isEnabled ? item : item.replace(/\.disabled$/, "");
          mods.push({
            name: displayName,
            fileName: item,
            path: fullPath,
            directory: dir,
            isDirectory: isDir,
            size: isDir ? 0 : stats.size,
            enabled: isEnabled,
            mtime: stats.mtime.toISOString(),
          });
        }
      }
    } catch (e) {}
  }

  return mods;
}

// Toggle ReShade ON / OFF by renaming wrapper DLL next to game exe
function toggleReShade(exePath, enable) {
  if (!exePath || !fs.existsSync(exePath)) {
    return { success: false, message: "Game executable not found" };
  }

  const exeDir = path.dirname(exePath);
  const wrappers = ["dxgi.dll", "d3d11.dll", "d3d12.dll", "d3d9.dll", "opengl32.dll"];

  for (const w of wrappers) {
    const activePath = path.join(exeDir, w);
    const disabledPath = path.join(exeDir, `${w}.disabled`);

    if (enable && fs.existsSync(disabledPath)) {
      fs.renameSync(disabledPath, activePath);
      return { success: true, enabled: true, hook: w };
    } else if (!enable && fs.existsSync(activePath)) {
      fs.renameSync(activePath, disabledPath);
      return { success: true, enabled: false, hook: w };
    }
  }

  return { success: false, message: "No ReShade wrapper found to toggle" };
}

// Inject standard ReShade configuration next to game exe
function installReShade(exePath, hook = "dxgi.dll") {
  if (!exePath || !fs.existsSync(exePath)) {
    return { success: false, message: "Game executable not found" };
  }

  const exeDir = path.dirname(exePath);
  const targetHook = path.join(exeDir, hook);
  const iniPath = path.join(exeDir, "ReShade.ini");
  const shadersDir = path.join(exeDir, "reshade-shaders");

  try {
    if (!fs.existsSync(shadersDir)) {
      fs.mkdirSync(shadersDir, { recursive: true });
      fs.mkdirSync(path.join(shadersDir, "Shaders"), { recursive: true });
      fs.mkdirSync(path.join(shadersDir, "Textures"), { recursive: true });
    }

    if (!fs.existsSync(iniPath)) {
      const defaultIni = `[GENERAL]\nEffectSearchPaths=.\\reshade-shaders\\Shaders\nTextureSearchPaths=.\\reshade-shaders\\Textures\nPerformanceMode=1\nShowFPS=1\n`;
      fs.writeFileSync(iniPath, defaultIni, "utf8");
    }

    // Touch wrapper placeholder if not existing
    if (!fs.existsSync(targetHook) && !fs.existsSync(`${targetHook}.disabled`)) {
      fs.writeFileSync(targetHook, Buffer.alloc(0));
    }

    return { success: true, hook, message: `ReShade initialized with ${hook} wrapper!` };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// Toggle an individual mod file ON / OFF
function toggleMod(modFilePath, enable) {
  if (!fs.existsSync(modFilePath)) {
    // Check if the counterpart exists
    const alternate = enable ? `${modFilePath}.disabled` : modFilePath.replace(/\.disabled$/, "");
    if (fs.existsSync(alternate)) {
      modFilePath = alternate;
    } else {
      return { success: false, message: "Mod file not found" };
    }
  }

  try {
    const isCurrentlyDisabled = modFilePath.endsWith(".disabled");
    if (enable && isCurrentlyDisabled) {
      const activePath = modFilePath.replace(/\.disabled$/, "");
      fs.renameSync(modFilePath, activePath);
      return { success: true, enabled: true, newPath: activePath };
    } else if (!enable && !isCurrentlyDisabled) {
      const disabledPath = `${modFilePath}.disabled`;
      fs.renameSync(modFilePath, disabledPath);
      return { success: true, enabled: false, newPath: disabledPath };
    }
    return { success: true, enabled: enable };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// Install a mod archive (.zip, .rar, .7z, .pak) into the game's directory
async function installModArchive(exePath, modArchiveOrFilePath) {
  if (!exePath || !fs.existsSync(exePath)) {
    return { success: false, message: "Game executable not found" };
  }
  if (!modArchiveOrFilePath || !fs.existsSync(modArchiveOrFilePath)) {
    return { success: false, message: "Mod file not found" };
  }

  const { engine, exeDir, modDir } = detectGameEngineAndModStructure(exePath);
  const targetDir = modDir || exeDir;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const ext = path.extname(modArchiveOrFilePath).toLowerCase();
  const fileName = path.basename(modArchiveOrFilePath);

  // Single file direct mod (.pak, .asi, .dll, .ini, .lua)
  if ([".pak", ".asi", ".dll", ".ini", ".lua"].includes(ext)) {
    const dest = path.join(targetDir, fileName);
    fs.copyFileSync(modArchiveOrFilePath, dest);
    return {
      success: true,
      message: `Installed ${fileName} into ${path.basename(targetDir)}`,
      targetDir,
      installedFile: dest,
    };
  }

  // Archive extraction (.zip, .7z, .rar)
  const { extractArchive } = require("./extractor");
  try {
    const res = await extractArchive(modArchiveOrFilePath, targetDir, null, {
      autoDelete: false,
    });
    if (res.success) {
      return {
        success: true,
        message: `Extracted mod package into ${engine} structure`,
        targetDir,
      };
    }
    return res;
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// Delete an installed mod file or directory
function deleteMod(modPath) {
  if (!fs.existsSync(modPath)) {
    return { success: false, message: "Mod path not found" };
  }
  try {
    const stats = fs.statSync(modPath);
    if (stats.isDirectory()) {
      fs.rmSync(modPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(modPath);
    }
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

module.exports = {
  detectGameEngineAndModStructure,
  listInstalledMods,
  toggleReShade,
  installReShade,
  toggleMod,
  installModArchive,
  deleteMod,
};
