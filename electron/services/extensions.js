const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const Module = require("module");

function getBuiltinExtPath() {
  const candidates = [
    app?.getAppPath ? path.join(app.getAppPath(), "extensions") : null,
    path.join(__dirname, "../extensions"),
    path.join(__dirname, "../../extensions"),
    process.resourcesPath ? path.join(process.resourcesPath, "extensions") : null,
    path.join(process.cwd(), "extensions"),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return path.join(process.cwd(), "extensions");
}

function getAppNodeModulesPath() {
  const candidates = [
    app?.getAppPath ? path.join(app.getAppPath(), "node_modules") : null,
    path.join(__dirname, "../node_modules"),
    path.join(__dirname, "../../node_modules"),
    process.resourcesPath ? path.join(process.resourcesPath, "app.asar/node_modules") : null,
    process.resourcesPath ? path.join(process.resourcesPath, "node_modules") : null,
    path.join(process.cwd(), "node_modules"),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return path.join(process.cwd(), "node_modules");
}

const appNodeModules = getAppNodeModulesPath();
if (!Module.globalPaths.includes(appNodeModules)) {
  Module.globalPaths.push(appNodeModules);
}

const extensions = {};
let activeExt = null;
const pageCache = new Map();

function safeRequireExtension(filePath) {
  try {
    if (require.cache[require.resolve(filePath)]) {
      delete require.cache[require.resolve(filePath)];
    }
    return require(filePath);
  } catch (_err) {
    // Fallback: compile module with enhanced paths
    const content = fs.readFileSync(filePath, "utf8");
    const m = new Module(filePath, module);
    m.filename = filePath;
    m.paths = Module._nodeModulePaths(path.dirname(filePath)).concat(
      Module.globalPaths,
      module.paths,
      [appNodeModules]
    );
    m._compile(content, filePath);
    return m.exports;
  }
}

function loadExtensions() {
  const userExtPath = path.join(app.getPath("userData"), "extensions");
  if (!fs.existsSync(userExtPath))
    fs.mkdirSync(userExtPath, { recursive: true });

  const builtinExtPath = getBuiltinExtPath();

  // If user folder has outdated marketplace files (e.g. with old 'page_link' / 'title:' fields), auto-upgrade them
  if (fs.existsSync(userExtPath)) {
    for (const file of fs.readdirSync(userExtPath)) {
      if (file.endsWith(".js")) {
        const filePath = path.join(userExtPath, file);
        try {
          const content = fs.readFileSync(filePath, "utf8");
          const base = file.replace(".js", "").toLowerCase();
          if (EMBEDDED_EXTENSION_TEMPLATES[base] && (content.includes("page_link") || content.includes("title: rawTitle"))) {
            fs.writeFileSync(filePath, EMBEDDED_EXTENSION_TEMPLATES[base], "utf8");
          }
        } catch (_) {}
      }
    }
  }

  const loadFolder = (folderPath) => {
    if (!fs.existsSync(folderPath)) return;
    for (const file of fs.readdirSync(folderPath)) {
      if (file.endsWith(".js")) {
        try {
          const filePath = path.join(folderPath, file);
          const ext = safeRequireExtension(filePath);
          if (ext && ext.name) {
            extensions[ext.name] = ext;
          }
        } catch (error) {
          console.error(`[Load Error] ${file}:`, error.message);
        }
      }
    }
  };

  loadFolder(builtinExtPath);
  loadFolder(userExtPath);

  if (!activeExt && Object.keys(extensions).length > 0) {
    activeExt = Object.values(extensions)[0];
  }
}

// ── Built-in Embedded Scraper Templates (Immune to Network/404 issues) ───────
const EMBEDDED_EXTENSION_TEMPLATES = {
  fitgirl: `const cheerio = require("cheerio");
const { net } = require("electron");
const BASE_URL = "https://fitgirl-repacks.site";

async function fetchHtml(url) {
  try {
    if (net && net.fetch) {
      const res = await net.fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      return await res.text();
    }
  } catch (e) {}
  const axios = require("axios");
  const { data } = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
  return data;
}

module.exports = {
  name: "FitGirl",
  categories: ["Top 50 Repacks", "Top 150 Repacks", "Pink Paw Award", "Hypervisor Bypass", "Switch Emulated", "PS3 Emulated", "All Repacks"],
  capabilities: { hasCategoryPagination: true, hasSearchPagination: true, hasStreaming: true },
  _cleanName(name) { return name.includes(" – ") ? name.split(" – ")[0] : name; },
  async _scrapeWordPressLoop(url, onGameFound) {
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const results = [];
      const articles = $("article").toArray();
      for (const article of articles) {
        const titleTag = $(article).find("h1.entry-title a");
        if (!titleTag.length) continue;
        const name = titleTag.text().trim();
        const link = titleTag.attr("href");
        const imgTag = $(article).find(".entry-content p img");
        const thumbnail = imgTag.attr("src") || "";
        const game = {
          name: this._cleanName(name),
          clean_name: this._cleanName(name),
          thumbnail_link: thumbnail,
          url: link,
          release_date: new Date().toISOString(),
          download_links: [],
        };
        if (onGameFound) onGameFound(game);
        else results.push(game);
      }
      return results;
    } catch (e) { return []; }
  },
  async get_homepage_games(p = 1, cb) { return this._scrapeWordPressLoop(p === 1 ? BASE_URL : \`\${BASE_URL}/page/\${p}/\`, cb); },
  async search_games(q, p = 1, cb) { return this._scrapeWordPressLoop(p === 1 ? \`\${BASE_URL}/?s=\${encodeURIComponent(q)}\` : \`\${BASE_URL}/page/\${p}/?s=\${encodeURIComponent(q)}\`, cb); },
  async get_games_by_category(c, p = 1, cb) { return this._scrapeWordPressLoop(p === 1 ? \`\${BASE_URL}/all-my-repacks-a-z/\` : \`\${BASE_URL}/all-my-repacks-a-z/page/\${p}/\`, cb); },
  async get_game_details(url) {
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const download_links = [];
      $("a[href^='magnet:']").each((_, el) => { download_links.push($(el).attr("href")); });
      return { name: $("h1.entry-title").text().trim(), clean_name: $("h1.entry-title").text().trim(), download_links };
    } catch (e) { return { download_links: [] }; }
  }
};`,

  steamrip: `const cheerio = require("cheerio");
const { net } = require("electron");
const BASE_URL = "https://steamrip.com";
const FALLBACK_URL = "https://repack-games.com";

async function fetchHtml(url) {
  try {
    if (net && net.fetch) {
      const res = await net.fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
      if (res.ok) return await res.text();
    }
  } catch (e) {}
  const axios = require("axios");
  const { data } = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, timeout: 8000 });
  return data;
}

module.exports = {
  name: "SteamRIP",
  categories: ["action", "adventure", "anime", "horror", "indie", "multiplayer", "open-world", "racing", "shooting", "simulation", "sports", "strategy", "vr"],
  capabilities: { hasCategoryPagination: true, hasSearchPagination: true, hasStreaming: true },
  _cleanName(n) { return (n || "").replace(/\\s*Free\\s*Download.*$/i, "").replace(/\\s*Pre-Installed.*$/i, "").replace(/–\\s*v\\d+.*/i, "").replace(/\\(.*?\\)/g, "").replace(/\\[.*?\\]/g, "").replace(/:\\s*$/, "").trim(); },
  _formatUrl(h) { return !h ? "" : h.startsWith("http") ? h : \`\${BASE_URL}/\${h.replace(/^\\//, "")}\`; },
  async _scrapeFallback(p = 1, cb) {
    try {
      const url = p === 1 ? FALLBACK_URL : \`\${FALLBACK_URL}/page/\${p}/\`;
      const axios = require("axios");
      const { data } = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
      const $ = cheerio.load(data);
      const games = [];
      $("a[href*='-free-download/']").each((_, a) => {
        const href = $(a).attr("href");
        let title = $(a).attr("title") || $(a).find("img").attr("title") || $(a).text().trim();
        const img = $(a).find("img").attr("data-src") || $(a).find("img").attr("src") || "";
        if (title && href && !games.some((g) => g.url === href)) {
          title = this._cleanName(title.replace(/<.*?>/g, ""));
          if (title.length > 2 && !title.includes("ago") && !title.includes("Comments")) {
            const gameObj = { name: title, clean_name: title, url: href, thumbnail_link: img, download_links: [] };
            games.push(gameObj);
            if (typeof cb === "function") cb(gameObj);
          }
        }
      });
      return games;
    } catch (e) { return []; }
  },
  async get_homepage_games(p = 1, cb) {
    try {
      const html = await fetchHtml(p === 1 ? BASE_URL : \`\${BASE_URL}/page/\${p}/\`);
      const $ = cheerio.load(html);
      const results = [];
      const games = $("div.slide, li.post, article").toArray();
      for (const gameEl of games) {
        const titleTag = $(gameEl).find("h2.thumb-title a, h2.post-title a, h2 a");
        if (!titleTag.length) continue;
        const rawName = titleTag.text().trim();
        const href = titleTag.attr("href");
        if (!rawName || !href) continue;
        const img = $(gameEl).find("img");
        const thumbnail = $(gameEl).attr("data-back-webp") || $(gameEl).attr("data-back") || img.attr("data-src-webp") || img.attr("data-src") || img.attr("src") || "";
        const game = { name: this._cleanName(rawName), clean_name: this._cleanName(rawName), thumbnail_link: thumbnail, url: this._formatUrl(href), download_links: [] };
        if (cb) cb(game);
        else results.push(game);
      }
      if (results.length === 0) return await this._scrapeFallback(p, cb);
      return results;
    } catch (err) { return await this._scrapeFallback(p, cb); }
  },
  async search_games(q, p = 1, cb) {
    try {
      const html = await fetchHtml(p === 1 ? \`\${BASE_URL}/?s=\${encodeURIComponent(q)}\` : \`\${BASE_URL}/page/\${p}/?s=\${encodeURIComponent(q)}\`);
      const $ = cheerio.load(html);
      const results = [];
      const games = $("div.slide, li.post, article").toArray();
      for (const gameEl of games) {
        const titleTag = $(gameEl).find("h2.thumb-title a, h2.post-title a, h2 a");
        if (!titleTag.length) continue;
        const rawName = titleTag.text().trim();
        const href = titleTag.attr("href");
        if (!rawName || !href) continue;
        const img = $(gameEl).find("img");
        const thumbnail = $(gameEl).attr("data-back-webp") || $(gameEl).attr("data-back") || img.attr("data-src-webp") || img.attr("data-src") || img.attr("src") || "";
        const game = { name: this._cleanName(rawName), clean_name: this._cleanName(rawName), thumbnail_link: thumbnail, url: this._formatUrl(href), download_links: [] };
        if (cb) cb(game);
        else results.push(game);
      }
      if (results.length === 0) return await this._scrapeFallback(p, cb);
      return results;
    } catch (err) { return await this._scrapeFallback(p, cb); }
  },
  async get_games_by_category(c, p = 1, cb) {
    try {
      const html = await fetchHtml(p === 1 ? \`\${BASE_URL}/category/\${c}/\` : \`\${BASE_URL}/category/\${c}/page/\${p}/\`);
      const $ = cheerio.load(html);
      const results = [];
      const games = $("div.slide, li.post, article").toArray();
      for (const gameEl of games) {
        const titleTag = $(gameEl).find("h2.thumb-title a, h2.post-title a, h2 a");
        if (!titleTag.length) continue;
        const rawName = titleTag.text().trim();
        const href = titleTag.attr("href");
        if (!rawName || !href) continue;
        const img = $(gameEl).find("img");
        const thumbnail = $(gameEl).attr("data-back-webp") || $(gameEl).attr("data-back") || img.attr("data-src-webp") || img.attr("data-src") || img.attr("src") || "";
        const game = { name: this._cleanName(rawName), clean_name: this._cleanName(rawName), thumbnail_link: thumbnail, categories: [c], url: this._formatUrl(href), download_links: [] };
        if (cb) cb(game);
        else results.push(game);
      }
      if (results.length === 0) return await this._scrapeFallback(p, cb);
      return results;
    } catch (err) { return await this._scrapeFallback(p, cb); }
  },
  async get_game_details(url) {
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const download_links = [];
      $("a").each((_, el) => {
        let href = $(el).attr("href") || "";
        if (href.includes("gofile") || href.includes("megadb") || href.includes("buzzheavier") || href.includes("datanodes") || href.includes("pixeldrain") || href.includes("1fichier") || href.includes("qiwi") || href.startsWith("magnet:")) {
          if (href.startsWith("//")) href = "https:" + href;
          if (href.startsWith("http") && !download_links.includes(href)) download_links.push(href);
        }
      });
      const titleTag = $("h1.post-title, h1.entry-title, h1").first();
      const rawTitle = titleTag.text().trim();
      return { name: this._cleanName(rawTitle) || rawTitle, clean_name: this._cleanName(rawTitle) || rawTitle, download_links };
    } catch (err) { return { download_links: [] }; }
  },
};`,

  dodi: `const cheerio = require("cheerio");
const { net } = require("electron");
const BASE_URL = "https://dodi-repacks.site";

async function fetchHtml(url) {
  try {
    if (net && net.fetch) {
      const res = await net.fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
      return await res.text();
    }
  } catch (e) {}
  const axios = require("axios");
  const { data } = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
  return data;
}

module.exports = {
  name: "Dodi Repacks",
  categories: ["Latest Repacks", "Action", "Adventure", "RPG", "Open World", "Shooter", "Strategy"],
  capabilities: { hasCategoryPagination: true, hasSearchPagination: true, hasStreaming: true },
  _cleanName(n) { return (n || "").replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "").replace(/^\d+[-–\s]+/, "").replace(/–\s*(Repack|v\d+|Build|Deluxe).*/i, "").trim(); },
  async _scrapeWordPressLoop(url, onGameFound) {
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const games = [];
      const articles = $("article").toArray();
      for (const el of articles) {
        const titleEl = $(el).find("h1.entry-title a, h2.entry-title a, .entry-title a").first();
        const rawTitle = titleEl.text().trim();
        const link = titleEl.attr("href");
        if (!rawTitle || !link || rawTitle.toLowerCase().includes("upcoming")) continue;
        const imgEl = $(el).find(".entry-content img, img").first();
        const thumbnail = imgEl.attr("data-src") || imgEl.attr("data-lazy-src") || imgEl.attr("src") || "";
        const clean = this._cleanName(rawTitle);
        const gameObj = { name: clean || rawTitle, clean_name: clean || rawTitle, url: link, thumbnail_link: thumbnail, download_links: [] };
        games.push(gameObj);
        if (typeof onGameFound === "function") onGameFound(gameObj);
      }
      return games;
    } catch (e) { return []; }
  },
  async get_homepage_games(p = 1, cb) { return this._scrapeWordPressLoop(p === 1 ? BASE_URL : \`\${BASE_URL}/page/\${p}/\`, cb); },
  async get_games_by_category(c, p = 1, cb) { return this._scrapeWordPressLoop(p === 1 ? \`\${BASE_URL}/category/\${encodeURIComponent(c.toLowerCase().replace(/\s+/g, "-"))}/\` : \`\${BASE_URL}/category/\${encodeURIComponent(c.toLowerCase().replace(/\s+/g, "-"))}/page/\${p}/\`, cb); },
  async search_games(q, p = 1, cb) { return this._scrapeWordPressLoop(p === 1 ? \`\${BASE_URL}/?s=\${encodeURIComponent(q)}\` : \`\${BASE_URL}/page/\${p}/?s=\${encodeURIComponent(q)}\`, cb); },
  async get_game_details(url) {
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const links = [];
      $("a").each((_, a) => {
        const href = $(a).attr("href");
        if (href && (href.startsWith("magnet:") || href.includes("qiwi.gg") || href.includes("gofile.io") || href.includes("buzzheavier.com") || href.includes("pixeldrain.com") || href.includes("1fichier.com"))) {
          if (!links.includes(href)) links.push(href);
        }
      });
      const rawTitle = $("h1.entry-title").text().trim();
      return { name: this._cleanName(rawTitle) || rawTitle, clean_name: this._cleanName(rawTitle) || rawTitle, download_links: links };
    } catch (e) { return { download_links: [] }; }
  },
};`,

  goggames: `const cheerio = require("cheerio");
const { net } = require("electron");
const BASE_URL = "https://freegogpcgames.com";

async function fetchHtml(url) {
  try {
    if (net && net.fetch) {
      const res = await net.fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
      return await res.text();
    }
  } catch (e) {}
  const axios = require("axios");
  const { data } = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
  return data;
}

module.exports = {
  name: "GOG Games",
  categories: ["Action", "Adventure", "RPG", "Strategy", "Simulation", "Shooter", "Indie", "All Games"],
  capabilities: { hasCategoryPagination: true, hasSearchPagination: true, hasStreaming: true },
  _cleanName(n) { return (n || "").replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "").replace(/–\s*(GOG|v\d+|Build).*/i, "").trim(); },
  async _scrapeLoop(url, onGameFound) {
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const games = [];
      $("article, .post, .entry").each((_, el) => {
        const titleEl = $(el).find("h2.entry-title a, h1.entry-title a, h2 a, a").first();
        const rawTitle = titleEl.text().trim();
        const link = titleEl.attr("href");
        if (!rawTitle || !link || !link.includes("freegogpcgames.com") || rawTitle.toLowerCase().includes("page")) return;
        const imgEl = $(el).find("img").first();
        const thumbnail = imgEl.attr("data-src") || imgEl.attr("data-lazy-src") || imgEl.attr("src") || "";
        const clean = this._cleanName(rawTitle);
        const gameObj = { name: clean || rawTitle, clean_name: clean || rawTitle, url: link, thumbnail_link: thumbnail, download_links: [] };
        games.push(gameObj);
        if (typeof onGameFound === "function") onGameFound(gameObj);
      });
      return games;
    } catch (e) { return []; }
  },
  async get_homepage_games(p = 1, cb) { return this._scrapeLoop(p === 1 ? BASE_URL : \`\${BASE_URL}/page/\${p}/\`, cb); },
  async get_games_by_category(c, p = 1, cb) { return this._scrapeLoop(p === 1 ? \`\${BASE_URL}/category/\${encodeURIComponent(c.toLowerCase().replace(/\s+/g, "-"))}/\` : \`\${BASE_URL}/category/\${encodeURIComponent(c.toLowerCase().replace(/\s+/g, "-"))}/page/\${p}/\`, cb); },
  async search_games(q, p = 1, cb) { return this._scrapeLoop(\`\${BASE_URL}/?s=\${encodeURIComponent(q)}&page=\${p}\`, cb); },
  async get_game_details(url) {
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const links = [];
      $("a").each((_, a) => {
        const href = $(a).attr("href");
        if (href && (href.includes("gofile.io") || href.includes("buzzheavier.com") || href.includes("1fichier.com") || href.includes("pixeldrain.com") || href.includes("qiwi.gg") || href.startsWith("magnet:"))) {
          if (!links.includes(href)) links.push(href);
        }
      });
      const rawTitle = $("h1.entry-title").text().trim();
      return { name: this._cleanName(rawTitle) || rawTitle, clean_name: this._cleanName(rawTitle) || rawTitle, download_links: links };
    } catch (e) { return { download_links: [] }; }
  },
};`,

  onlinefix: `const cheerio = require("cheerio");
const { net } = require("electron");
const BASE_URL = "https://online-fix.me";

async function fetchHtml(url) {
  try {
    if (net && net.fetch) {
      const res = await net.fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
      return await res.text();
    }
  } catch (e) {}
  const axios = require("axios");
  const { data } = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
  return data;
}

module.exports = {
  name: "Online-Fix",
  categories: ["Co-Op Multiplayer", "Action", "Shooter", "Survival", "Horror", "Simulator", "Arcade", "Official Servers"],
  capabilities: { hasCategoryPagination: true, hasSearchPagination: true, hasStreaming: true },
  _cleanName(n) { return (n || "").replace(/по сети.*$/i, "").replace(/онлайн.*$/i, "").replace(/online.*$/i, "").replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "").trim(); },
  async _scrapeLoop(url, onGameFound) {
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const games = [];
      $(".article, .news").each((_, article) => {
        const titleTag = $(article).find("h2.title, h2, .title").first();
        let rawName = titleTag.text().trim();
        const linkTag = $(article).find("a.big-link, a.img, a[href*='/games/']").first();
        let link = linkTag.attr("href");
        const imgTag = $(article).find("img").first();
        let thumbnail = imgTag.attr("data-src") || imgTag.attr("src") || "";
        if (!rawName) rawName = imgTag.attr("alt") || "";
        if (rawName && link) {
          if (!link.startsWith("http")) link = \`\${BASE_URL}\${link}\`;
          if (thumbnail && !thumbnail.startsWith("http")) thumbnail = \`\${BASE_URL}\${thumbnail}\`;
          const clean = this._cleanName(rawName);
          const gameObj = { name: clean || rawName, clean_name: clean || rawName, url: link, thumbnail_link: thumbnail, download_links: [] };
          games.push(gameObj);
          if (typeof onGameFound === "function") onGameFound(gameObj);
        }
      });
      return games;
    } catch (e) { return []; }
  },
  async get_homepage_games(p = 1, cb) { return this._scrapeLoop(p === 1 ? BASE_URL : \`\${BASE_URL}/page/\${p}/\`, cb); },
  async get_games_by_category(c, p = 1, cb) {
    const slugMap = { "co-op multiplayer": "coop", "action": "action", "shooter": "shooter", "survival": "survival", "horror": "horror", "simulator": "simulator", "arcade": "arcade", "official servers": "officialservers" };
    const slug = slugMap[c.toLowerCase()] || "games";
    return this._scrapeLoop(p === 1 ? \`\${BASE_URL}/games/\${slug}/\` : \`\${BASE_URL}/games/\${slug}/page/\${p}/\`, cb);
  },
  async search_games(q, p = 1, cb) { return this._scrapeLoop(\`\${BASE_URL}/index.php?do=search&subaction=search&story=\${encodeURIComponent(q)}&search_start=\${p}\`, cb); },
  async get_game_details(url) {
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const links = [];
      $("a").each((_, a) => {
        const href = $(a).attr("href");
        if (href && (href.includes("gofile.io") || href.includes("buzzheavier.com") || href.includes("1fichier.com") || href.includes("pixeldrain.com") || href.includes("qiwi.gg") || href.startsWith("magnet:") || href.includes("torrent"))) {
          if (!links.includes(href)) links.push(href);
        }
      });
      const title = $("h2.title, h1").first().text().trim();
      return { name: this._cleanName(title) || title, clean_name: this._cleanName(title) || title, download_links: links };
    } catch (e) { return { download_links: [] }; }
  },
};`,
};

function setupExtensionsIPC(ipcMain) {
  ipcMain.handle("get-game-details", async (_e, url) => {
    if (activeExt && activeExt.get_game_details) {
      return await activeExt.get_game_details(url);
    }
    return { download_links: [] };
  });

  const getCacheKey = (type, param, page) =>
    `${activeExt?.name}_${type}_${param}_${page}`;

  ipcMain.handle("get-extensions", () => Object.keys(extensions));

  ipcMain.handle("set-extension", (_e, name) => {
    if (extensions[name]) activeExt = extensions[name];
    return {
      categories: activeExt?.categories || [],
      capabilities: activeExt?.capabilities || {},
    };
  });

  ipcMain.handle("get-homepage", async () => {
    const k = getCacheKey("home", "m", 1);
    if (pageCache.has(k)) return pageCache.get(k);
    const d = activeExt ? await activeExt.get_homepage_games() : [];
    pageCache.set(k, d);
    return d;
  });

  ipcMain.handle("get-category", async (_e, { category, page }) => {
    const k = getCacheKey("cat", category, page);
    if (pageCache.has(k)) return pageCache.get(k);
    const d = activeExt
      ? await activeExt.get_games_by_category(category, page)
      : [];
    pageCache.set(k, d);
    return d;
  });

  ipcMain.handle("search-games", async (_e, { query, page }) => {
    const k = getCacheKey("src", query, page);
    if (pageCache.has(k)) return pageCache.get(k);
    const d = activeExt ? await activeExt.search_games(query, page) : [];
    pageCache.set(k, d);
    return d;
  });

  const handleStreamGames = async (event, { type, params }) => {
    if (!activeExt) {
      event.sender.send("stream-end", { type, params, total: 0 });
      return;
    }

    const cacheKey =
      type === "homepage"
        ? getCacheKey("home", "m", 1)
        : type === "category"
          ? getCacheKey("cat", params?.category, params?.page || 1)
          : type === "search"
            ? getCacheKey("src", params?.query, params?.page || 1)
            : null;

    if (cacheKey && pageCache.has(cacheKey)) {
      const cached = pageCache.get(cacheKey);
      for (const game of cached) {
        if (event.sender.isDestroyed()) return;
        event.sender.send("stream-item", game);
      }
      if (!event.sender.isDestroyed()) {
        event.sender.send("stream-end", {
          type,
          params,
          total: cached.length,
          fromCache: true,
          hasMore: false,
        });
      }
      return;
    }

    const accumulated = [];
    const onGame = (game) => {
      if (event.sender.isDestroyed()) return;
      accumulated.push(game);
      event.sender.send("stream-item", game);
    };

    const supportsStreaming = !!activeExt.capabilities?.hasStreaming;

    try {
      if (type === "homepage") {
        if (supportsStreaming) {
          await activeExt.get_homepage_games(1, onGame);
        } else {
          const res = await activeExt.get_homepage_games(1);
          for (const g of (res || [])) onGame(g);
        }
      } else if (type === "category") {
        if (supportsStreaming) {
          await activeExt.get_games_by_category(params.category, params.page || 1, onGame);
        } else {
          const res = await activeExt.get_games_by_category(params.category, params.page || 1);
          for (const g of (res || [])) onGame(g);
        }
      } else if (type === "search") {
        if (supportsStreaming) {
          await activeExt.search_games(params.query, params.page || 1, onGame);
        } else {
          const res = await activeExt.search_games(params.query, params.page || 1);
          for (const g of (res || [])) onGame(g);
        }
      }

      if (cacheKey && accumulated.length > 0) pageCache.set(cacheKey, accumulated);

      if (!event.sender.isDestroyed()) {
        event.sender.send("stream-end", {
          type,
          params,
          total: accumulated.length,
          fromCache: false,
          hasMore: type !== "homepage" && accumulated.length > 0 &&
            (type === "category"
              ? !!activeExt.capabilities?.hasCategoryPagination
              : !!activeExt.capabilities?.hasSearchPagination),
        });
      }
    } catch (err) {
      console.error("[Stream] Error during scrape:", err.message);
      if (!event.sender.isDestroyed()) {
        event.sender.send("stream-end", {
          type,
          params,
          total: accumulated.length,
          error: err.message,
          hasMore: false,
        });
      }
    }
  };

  ipcMain.on("stream-request", handleStreamGames);
  ipcMain.on("stream-games", handleStreamGames);

  // ── Curated Community Extension Marketplace ───────────────────────────────
  const extensionsBaseUrl = (process.env.BLACK_PEARL_EXTENSIONS_URL || "").replace(/\/$/, "");
  const resolveMarketplaceUrl = (file) => (extensionsBaseUrl ? `${extensionsBaseUrl}/${file}` : "");

  const MARKETPLACE_EXTENSIONS = [
    {
      id: "fitgirl",
      name: "FitGirl Repacks",
      author: "FitGirl",
      version: "1.3.0",
      description: "Heavily compressed game repacks with multi-language support, direct filehosters, and magnet torrents.",
      tags: ["Direct Links", "Torrents", "Repacks", "Multi-Language"],
      icon: "https://fitgirl-repacks.site/favicon.ico",
      file: "fitgirl.js",
      url: resolveMarketplaceUrl("fitgirl.js"),
    },
    {
      id: "steamrip",
      name: "SteamRIP",
      author: "SteamRIP Team",
      version: "1.4.2",
      description: "Direct pre-installed game archives with DLCs, latest patches, and fast MegaDB/Buzzheavier file links.",
      tags: ["Direct Download", "Pre-Installed", "Fast Mirrors", "Latest Patches"],
      icon: "https://steamrip.com/favicon.ico",
      file: "steamrip.js",
      url: resolveMarketplaceUrl("steamrip.js"),
    },
    {
      id: "dodi",
      name: "Dodi Repacks",
      author: "Dodi",
      version: "1.1.0",
      description: "Fast installing compressed repacks featuring direct OneDrive/Qiwi mirrors and torrent magnets.",
      tags: ["Repacks", "Torrents", "Fast Install", "Direct Links"],
      icon: "https://dodi-repacks.site/favicon.ico",
      file: "dodi.js",
      url: resolveMarketplaceUrl("dodi.js"),
    },
    {
      id: "goggames",
      name: "GOG Games",
      author: "GOG-Community",
      version: "1.2.0",
      description: "100% DRM-free clean installers, digital goodies, OSTs, and official game extras.",
      tags: ["DRM-Free", "Clean Installers", "Goodies", "Direct Links"],
      icon: "https://gog-games.to/favicon.ico",
      file: "goggames.js",
      url: resolveMarketplaceUrl("goggames.js"),
    },
    {
      id: "onlinefix",
      name: "Online-Fix",
      author: "0x00Fix",
      version: "1.0.5",
      description: "Multiplayer co-op and LAN fixes for playing with friends through Steam overlay and Spacewar.",
      tags: ["Multiplayer", "Co-Op Fixes", "Steam Overlay", "Direct Links"],
      icon: "https://online-fix.me/favicon.ico",
      file: "onlinefix.js",
      url: resolveMarketplaceUrl("onlinefix.js"),
    },
  ];

  ipcMain.handle("get-marketplace-extensions", () => {
    const installedKeys = Object.keys(extensions).map((k) =>
      k.toLowerCase().replace(/[^a-z0-9]/g, "")
    );

    return MARKETPLACE_EXTENSIONS.map((item) => {
      const matchKey = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isInstalled =
        installedKeys.includes(matchKey) ||
        installedKeys.includes(item.id.toLowerCase()) ||
        Object.keys(extensions).some(
          (extName) =>
            extName.toLowerCase().includes(item.id) ||
            item.name.toLowerCase().includes(extName.toLowerCase())
        );

      return {
        ...item,
        isInstalled,
      };
    });
  });

  // ── Extension installer & management ─────────────────────────────────────

  ipcMain.handle("get-extensions-details", () => {
    const userExtPath = path.join(app.getPath("userData"), "extensions");
    const userFiles = fs.existsSync(userExtPath) ? fs.readdirSync(userExtPath) : [];

    return Object.values(extensions).map((ext) => {
      const isCustom = userFiles.some((f) => {
        try {
          const loaded = safeRequireExtension(path.join(userExtPath, f));
          return loaded && loaded.name === ext.name;
        } catch (_e) {
          return false;
        }
      });

      return {
        name: ext.name,
        categories: ext.categories || [],
        capabilities: ext.capabilities || {},
        isCustom,
      };
    });
  });

  ipcMain.handle("delete-extension", async (_e, name) => {
    const userExtPath = path.join(app.getPath("userData"), "extensions");
    try {
      if (fs.existsSync(userExtPath)) {
        for (const file of fs.readdirSync(userExtPath)) {
          if (file.endsWith(".js")) {
            const filePath = path.join(userExtPath, file);
            try {
              const ext = safeRequireExtension(filePath);
              if (ext && (ext.name === name || ext.name.toLowerCase().includes(name.toLowerCase()))) {
                if (require.cache[require.resolve(filePath)]) {
                  delete require.cache[require.resolve(filePath)];
                }
                fs.unlinkSync(filePath);
                delete extensions[name];
                pageCache.clear();
                if (activeExt && activeExt.name === name) {
                  activeExt = Object.values(extensions)[0] || null;
                }
                return {
                  success: true,
                  remaining: Object.keys(extensions),
                  activeExt: activeExt ? activeExt.name : "",
                };
              }
            } catch (err) {
              console.error(`[Delete Extension Error] ${file}:`, err.message);
            }
          }
        }
      }
      return { success: false, message: "Extension not found in user directory" };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle("install-extension", async (_e, payload) => {
    const userExtPath = path.join(app.getPath("userData"), "extensions");
    if (!fs.existsSync(userExtPath)) {
      fs.mkdirSync(userExtPath, { recursive: true });
    }

    try {
      const url = typeof payload === "string" ? payload : payload?.url || "";
      const name = typeof payload === "object" ? payload?.name || payload?.id : "";
      let code = typeof payload === "object" && payload?.code ? payload.code : "";

      const builtinExtPath = getBuiltinExtPath();

      // Find matched marketplace entry
      const matchedMarket = MARKETPLACE_EXTENSIONS.find(
        (m) =>
          (name && m.name.toLowerCase() === name.toLowerCase()) ||
          (name && m.id.toLowerCase() === name.toLowerCase()) ||
          (url && m.url === url) ||
          (url && m.id && url.includes(m.id))
      );

      const targetFileName =
        matchedMarket?.file ||
        (url.startsWith("http")
          ? url.split("/").pop().split("?")[0] || `ext_${Date.now()}.js`
          : `ext_${Date.now()}.js`);

      // 1. Check embedded template
      const templateKey = matchedMarket?.id;
      if (!code && templateKey && EMBEDDED_EXTENSION_TEMPLATES[templateKey]) {
        code = EMBEDDED_EXTENSION_TEMPLATES[templateKey];
      }

      // 2. Check local builtin folder
      if (!code && matchedMarket?.file) {
        const localSourcePath = path.join(builtinExtPath, matchedMarket.file);
        if (fs.existsSync(localSourcePath)) {
          code = fs.readFileSync(localSourcePath, "utf8");
        }
      }

      // 3. Attempt network fetch if URL provided
      if (!code && url && url.startsWith("http")) {
        try {
          let finalUrl = url;
          if (finalUrl.includes("github.com") && !finalUrl.includes("raw.githubusercontent.com")) {
            finalUrl = finalUrl.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
          }
          const res = await axios.get(finalUrl, { responseType: "text", timeout: 5000 });
          if (res.data && typeof res.data === "string") {
            code = res.data;
          }
        } catch (_fetchErr) {
          // If network failed, check template key from URL
          const urlKey = Object.keys(EMBEDDED_EXTENSION_TEMPLATES).find((k) =>
            url.toLowerCase().includes(k)
          );
          if (urlKey) {
            code = EMBEDDED_EXTENSION_TEMPLATES[urlKey];
          }
        }
      } else if (!code && url && !url.startsWith("http")) {
        code = url;
      }

      if (!code || (!code.includes("module.exports") && !code.includes("exports"))) {
        throw new Error("Invalid or unavailable extension code.");
      }

      const destPath = path.join(userExtPath, targetFileName);
      fs.writeFileSync(destPath, code, "utf8");

      // Reload extensions in memory
      loadExtensions();

      return {
        success: true,
        name: targetFileName,
        allExtensions: Object.keys(extensions),
      };
    } catch (error) {
      console.error("[Install Extension Error]:", error.message);
      return { success: false, message: error.message };
    }
  });
}

function getActiveExtension() {
  return activeExt;
}

module.exports = { loadExtensions, setupExtensionsIPC, getActiveExtension };