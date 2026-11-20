const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const ARCHIVE_EXTENSIONS = [
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".iso",
  ".001",
  ".bin",
  ".bz2",
  ".xz",
  ".tgz",
];

// Multi-part regex patterns
const MULTIPART_PATTERNS = [
  /\.part\d+\.rar$/i,
  /\.part\d+$/i,
  /\.zip\.\d{3}$/i,
  /\.7z\.\d{3}$/i,
  /\.\d{3}$/i,
  /\.z\d{2}$/i,
  /\.r\d{2}$/i,
];

function isArchive(filePath) {
  if (!filePath) return false;
  const lower = filePath.toLowerCase();
  if (ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  if (MULTIPART_PATTERNS.some((pat) => pat.test(lower))) return true;
  // Common installer / SFX executables
  if (lower.endsWith(".exe") && (lower.includes("setup") || lower.includes("installer") || lower.includes("repack"))) {
    return true;
  }
  return false;
}

// Clean and sanitize folder name for filesystem safety
function sanitizeFolderName(name) {
  if (!name || typeof name !== "string") return "Unknown_Game";
  return name
    .replace(/^\[BlackPearl\]\s*/i, "")
    .replace(/^Extracted_\s*/i, "")
    .replace(/\[(?:FitGirl|DODI|RUNE|TENOKE|FLT|SKIDROW|CODEX|Razor1911|GOG|Repack)[^\]]*\]/gi, "")
    .replace(/\((?:FitGirl|DODI|RUNE|TENOKE|FLT|SKIDROW|CODEX|Razor1911|GOG|Repack)[^)]*\)/gi, "")
    .replace(/v\d+(\.\d+)+.*$/i, "")
    .replace(/Build\s*\d+.*$/i, "")
    .replace(/[/\\?%*:|"<>]/g, "") // Remove Windows forbidden filename characters
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, ""); // Remove leading/trailing dots
}

// Locate available extraction tool on the system best suited for the archive
function findExtractionTool(archivePath = "") {
  const isWin = process.platform === "win32";
  const ext = (path.extname(archivePath) || "").toLowerCase();

  if (isWin) {
    const programFiles = process.env.ProgramFiles || path.join("C:", "Program Files");
    const programFilesX86 = process.env["ProgramFiles(x86)"] || path.join("C:", "Program Files (x86)");

    // 1. Check for installed 7-Zip
    const p7zCandidates = [
      path.join(programFiles, "7-Zip", "7z.exe"),
      path.join(programFilesX86, "7-Zip", "7z.exe"),
      path.join(process.env.LOCALAPPDATA || "", "Programs", "7-Zip", "7z.exe"),
    ];
    for (const p of p7zCandidates) {
      if (fs.existsSync(p)) return { type: "7z", bin: p };
    }

    // 2. Check for WinRAR / UnRAR
    const winrarCandidates = [
      { type: "winrar", bin: path.join(programFiles, "WinRAR", "WinRAR.exe") },
      { type: "unrar", bin: path.join(programFiles, "WinRAR", "UnRAR.exe") },
      { type: "winrar", bin: path.join(programFilesX86, "WinRAR", "WinRAR.exe") },
      { type: "unrar", bin: path.join(programFilesX86, "WinRAR", "UnRAR.exe") },
    ];
    for (const c of winrarCandidates) {
      if (fs.existsSync(c.bin)) return c;
    }

    // 3. Built-in Windows tar.exe (Windows 10+)
    const systemTar = path.join(
      process.env.SystemRoot || "C:\\Windows",
      "System32",
      "tar.exe",
    );
    if (fs.existsSync(systemTar)) {
      // Tar is great for .zip, .tar, .gz
      if (ext === ".zip" || ext === ".tar" || ext === ".gz" || ext === ".tgz" || !ext) {
        return { type: "tar", bin: systemTar };
      }
    }

    // 4. PowerShell fallback for .zip
    if (ext === ".zip") {
      return { type: "powershell", bin: "powershell.exe" };
    }

    // Default fallback to system tar or 7z command
    if (fs.existsSync(systemTar)) return { type: "tar", bin: systemTar };
    return { type: "powershell", bin: "powershell.exe" };
  }

  // Linux / macOS: check 7z / unrar / tar
  return { type: "tar", bin: "tar" };
}

// Find game executables or setups inside an extracted folder
function findGameExecutables(dirPath) {
  const executables = [];

  const scan = (dir, depth = 0) => {
    if (depth > 4) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const lowerDir = entry.name.toLowerCase();
          if (
            !lowerDir.includes("redist") &&
            !lowerDir.includes("directx") &&
            !lowerDir.includes("_commonredist")
          ) {
            scan(fullPath, depth + 1);
          }
        } else if (entry.isFile()) {
          const lower = entry.name.toLowerCase();
          if (
            (lower.endsWith(".exe") ||
              lower.endsWith(".x86_64") ||
              lower.endsWith(".bin") ||
              lower.endsWith(".app")) &&
            !lower.includes("unins") &&
            !lower.includes("crash") &&
            !lower.includes("dxwebsetup") &&
            !lower.includes("vc_redist") &&
            !lower.includes("vcredist")
          ) {
            executables.push({
              name: entry.name,
              path: fullPath,
              isSetup: lower.includes("setup") || lower.includes("install"),
            });
          }
        }
      }
    } catch (e) {}
  };

  scan(dirPath);
  return executables.sort((a, b) => (b.isSetup ? 1 : 0) - (a.isSetup ? 1 : 0));
}

// Identify all related parts for multi-part archives (.part1.rar, .001, etc.)
function findRelatedArchiveParts(archivePath) {
  const filesToDelete = [];
  if (!archivePath || !fs.existsSync(archivePath)) return filesToDelete;

  filesToDelete.push(archivePath);
  const companionAria2 = archivePath + ".aria2";
  if (fs.existsSync(companionAria2)) filesToDelete.push(companionAria2);

  const dir = path.dirname(archivePath);
  const baseName = path.basename(archivePath);

  try {
    const dirFiles = fs.readdirSync(dir);

    // Multi-part RAR matching: e.g. "Game.part1.rar", "Game.part01.rar"
    const partMatch = baseName.match(/^(.*?)\.part\d+(\.rar)?$/i);
    if (partMatch) {
      const prefix = partMatch[1].toLowerCase();
      for (const f of dirFiles) {
        if (f.toLowerCase().startsWith(prefix) && /\.part\d+(\.rar)?$/i.test(f)) {
          const p = path.join(dir, f);
          if (!filesToDelete.includes(p)) filesToDelete.push(p);
          const aria = p + ".aria2";
          if (fs.existsSync(aria) && !filesToDelete.includes(aria)) filesToDelete.push(aria);
        }
      }
    }

    // Split 7z / zip matching: e.g. "Game.7z.001", "Game.zip.001", "Game.001"
    const numMatch = baseName.match(/^(.*?)\.(\d{3})$/i);
    if (numMatch) {
      const prefix = numMatch[1].toLowerCase();
      for (const f of dirFiles) {
        if (f.toLowerCase().startsWith(prefix) && /\.\d{3}$/i.test(f)) {
          const p = path.join(dir, f);
          if (!filesToDelete.includes(p)) filesToDelete.push(p);
          const aria = p + ".aria2";
          if (fs.existsSync(aria) && !filesToDelete.includes(aria)) filesToDelete.push(aria);
        }
      }
    }
  } catch (err) {
    console.warn("[Extractor] Error finding related archive parts:", err);
  }

  return filesToDelete;
}

// Safely delete file with retry logic to handle Windows file locks
async function safeDeleteFile(filePath, maxRetries = 5, delayMs = 1000) {
  if (!filePath || !fs.existsSync(filePath)) return true;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
      console.log(`[Extractor] Permanently deleted: ${filePath}`);
      return true;
    } catch (err) {
      if (attempt < maxRetries) {
        console.warn(`[Extractor] File delete busy for ${filePath} (${err.code}), retrying (${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        console.error(`[Extractor] Failed to delete ${filePath} after ${maxRetries} retries:`, err.message);
        return false;
      }
    }
  }
  return false;
}

// Flatten single nested subfolder if archive unpacked as dest/SingleSubfolder/...
function flattenExtractedFolder(dest) {
  try {
    if (!fs.existsSync(dest)) return;
    const entries = fs.readdirSync(dest, { withFileTypes: true });
    // Check if there is only 1 entry and it is a directory
    if (entries.length === 1 && entries[0].isDirectory()) {
      const innerDir = path.join(dest, entries[0].name);
      const innerItems = fs.readdirSync(innerDir);

      for (const item of innerItems) {
        const srcPath = path.join(innerDir, item);
        const targetPath = path.join(dest, item);
        if (!fs.existsSync(targetPath)) {
          fs.renameSync(srcPath, targetPath);
        }
      }

      // Remove the now-empty inner directory
      try {
        fs.rmdirSync(innerDir);
      } catch (e) {
        try {
          fs.rmSync(innerDir, { recursive: true, force: true });
        } catch (e2) {}
      }
      console.log(`[Extractor] Flattened single subfolder '${entries[0].name}' into '${dest}'`);
    }
  } catch (err) {
    console.warn("[Extractor] Flatten folder warning:", err.message);
  }
}

/**
 * Extract archive file to target directory, rename folder to game name,
 * and permanently delete the source archive/setup files upon verified extraction success.
 *
 * @param {string} archivePath - Path to archive or setup file
 * @param {string|null} targetDir - Optional explicit destination path
 * @param {Function|object} onProgressOrOptions - Progress callback or options object
 * @param {object} [extraOptions] - Additional options ({ gameName, autoDelete, mainGamesDir })
 */
async function extractArchive(
  archivePath,
  targetDir = null,
  onProgressOrOptions = () => {},
  extraOptions = {},
) {
  let onProgress = () => {};
  let options = {};

  if (typeof onProgressOrOptions === "function") {
    onProgress = onProgressOrOptions;
    options = extraOptions || {};
  } else if (typeof onProgressOrOptions === "object" && onProgressOrOptions !== null) {
    options = onProgressOrOptions;
    if (typeof options.onProgress === "function") onProgress = options.onProgress;
  }

  const gameName = options.gameName || "";
  const autoDelete = options.autoDelete !== false; // Defaults to true for auto extraction
  const mainGamesDir = options.mainGamesDir || null;

  return new Promise((resolve) => {
    if (!fs.existsSync(archivePath)) {
      return resolve({ success: false, message: "Archive file not found" });
    }

    const extName = path.extname(archivePath).toLowerCase();
    const rawBaseName = path.basename(archivePath, extName).replace(/\[BlackPearl\]\s*/i, "");
    const cleanName = sanitizeFolderName(gameName || rawBaseName);

    // Resolve final destination folder named after the game
    let dest = targetDir;
    if (!dest) {
      const baseDir = mainGamesDir || path.dirname(archivePath);
      dest = path.join(baseDir, cleanName);
    }

    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const tool = findExtractionTool(archivePath);
    console.log(`[Extractor] Extracting ${archivePath} using ${tool.type} to ${dest}`);

    let proc;
    if (tool.type === "7z") {
      proc = spawn(tool.bin, ["x", "-y", `-o${dest}`, archivePath]);
    } else if (tool.type === "winrar") {
      proc = spawn(tool.bin, ["x", "-y", "-ibck", archivePath, dest + path.sep]);
    } else if (tool.type === "unrar") {
      proc = spawn(tool.bin, ["x", "-y", "-o+", archivePath, dest + path.sep]);
    } else if (tool.type === "tar") {
      proc = spawn(tool.bin, ["-xf", archivePath, "-C", dest]);
    } else if (tool.type === "powershell" && extName === ".zip") {
      proc = spawn("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`,
      ]);
    } else {
      // Fallback tar
      proc = spawn("tar", ["-xf", archivePath, "-C", dest]);
    }

    proc.stdout?.on("data", (data) => {
      onProgress(data.toString());
    });

    proc.stderr?.on("data", (data) => {
      onProgress(data.toString());
    });

    proc.on("error", (err) => {
      console.error("[Extractor] Execution error:", err);
      resolve({ success: false, message: err.message });
    });

    proc.on("exit", async (code) => {
      if (code === 0) {
        // Flatten single nested folder if created by archive
        flattenExtractedFolder(dest);

        // Verify folder actually contains files
        let hasFiles = false;
        try {
          const files = fs.readdirSync(dest);
          hasFiles = files.length > 0;
        } catch (e) {
          hasFiles = false;
        }

        if (!hasFiles) {
          return resolve({
            success: false,
            message: "Extraction finished but target directory is empty",
          });
        }

        const executables = findGameExecutables(dest);
        const deletedFiles = [];

        // Permanently delete archive / split parts upon verified successful extraction
        if (autoDelete) {
          console.log(`[Extractor] Verified extraction success! Deleting source archives...`);
          // Delay briefly to allow file handles to release
          await new Promise((r) => setTimeout(r, 600));

          const filesToDelete = findRelatedArchiveParts(archivePath);
          for (const f of filesToDelete) {
            const deleted = await safeDeleteFile(f);
            if (deleted) deletedFiles.push(f);
          }
        }

        resolve({
          success: true,
          extractedPath: dest,
          executables,
          deletedFiles,
        });
      } else {
        console.error(`[Extractor] Extraction tool exited with code ${code}. Preserving source archives.`);
        resolve({
          success: false,
          message: `Extractor exited with code ${code}`,
        });
      }
    });
  });
}

module.exports = {
  isArchive,
  sanitizeFolderName,
  findExtractionTool,
  findGameExecutables,
  findRelatedArchiveParts,
  safeDeleteFile,
  flattenExtractedFolder,
  extractArchive,
};

