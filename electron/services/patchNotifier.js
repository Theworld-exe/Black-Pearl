// Extract version or build numbers from strings (e.g. "v2.12", "Build 145920", "Update 4")
function extractVersionTag(title = "") {
  if (!title) return null;

  // 1. Semantic version (e.g. v1.2.3 or 1.2.3a)
  const vMatch = title.match(/v?(\d+\.\d+(?:\.\d+)?(?:[a-z])?)/i);
  if (vMatch) return vMatch[1];

  // 2. Build number (e.g. Build 142093)
  const bMatch = title.match(/build\s*(\d+)/i);
  if (bMatch) return `Build ${bMatch[1]}`;

  // 3. Update tag (e.g. Update 4 or Patch 1.5)
  const uMatch = title.match(/(?:update|patch)\s*(\d+(?:\.\d+)?)/i);
  if (uMatch) return `Update ${uMatch[1]}`;

  return null;
}

// Compare two version strings
function isNewerVersion(available, current) {
  if (!available || !current) return false;
  if (available === current) return false;

  const parseParts = (v) =>
    v
      .replace(/[^0-9.]/g, "")
      .split(".")
      .map(Number);

  const aParts = parseParts(available);
  const cParts = parseParts(current);

  for (let i = 0; i < Math.max(aParts.length, cParts.length); i++) {
    const a = aParts[i] || 0;
    const c = cParts[i] || 0;
    if (a > c) return true;
    if (a < c) return false;
  }

  return false;
}

// Check for game updates in the user's library
async function checkGameUpdates(library, activeExtension) {
  if (!library || library.length === 0 || !activeExtension) return [];

  const updateList = [];

  for (const game of library) {
    try {
      const currentVersion = extractVersionTag(game.name) || extractVersionTag(game.clean_name);
      if (!currentVersion) continue;

      // Query active extension
      let searchResults = [];
      if (activeExtension.search_games) {
        searchResults = (await activeExtension.search_games(game.clean_name || game.name, 1)) || [];
      }

      for (const res of searchResults) {
        const availableVersion = extractVersionTag(res.title || res.name);
        if (availableVersion && isNewerVersion(availableVersion, currentVersion)) {
          updateList.push({
            gameName: game.name,
            currentVersion,
            availableVersion,
            patchTitle: res.title || res.name,
            link: res.link || res.page_link,
            thumbnail: res.thumbnail || game.thumbnail_link,
            source: activeExtension.name,
          });
          break; // Found primary update
        }
      }
    } catch (err) {
      console.warn(`[PatchNotifier] Error checking updates for ${game.name}:`, err.message);
    }
  }

  return updateList;
}

// Find standalone patches or updates for a specific game
async function getGamePatchLinks(gameName, activeExtension) {
  if (!gameName || !activeExtension || !activeExtension.search_games) return [];

  try {
    const queries = [`${gameName} update`, `${gameName} patch`];
    const results = [];

    for (const q of queries) {
      const res = await activeExtension.search_games(q, 1);
      if (res && res.length > 0) {
        for (const item of res) {
          if (!results.find((x) => x.link === item.link)) {
            results.push(item);
          }
        }
      }
    }

    return results;
  } catch (err) {
    console.error("[PatchNotifier] Patch search error:", err);
    return [];
  }
}

module.exports = {
  extractVersionTag,
  isNewerVersion,
  checkGameUpdates,
  getGamePatchLinks,
};
