const cheerio = require("cheerio");
const { net } = require("electron");

const BASE_URL = "https://steamrip.com";
const FALLBACK_URL = "https://repack-games.com";

async function fetchHtml(url) {
  try {
    if (net && net.fetch) {
      const res = await net.fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (res.ok) {
        return await res.text();
      }
    }
  } catch (e) {
    console.warn("[SteamRIP] net.fetch failed:", e.message);
  }

  const axios = require("axios");
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    timeout: 8000,
  });
  return data;
}

module.exports = {
  name: "SteamRIP",
  categories: [
    "action",
    "adventure",
    "anime",
    "horror",
    "indie",
    "multiplayer",
    "open-world",
    "racing",
    "shooting",
    "simulation",
    "sports",
    "strategy",
    "vr",
  ],
  capabilities: {
    hasCategoryPagination: true,
    hasSearchPagination: true,
    hasStreaming: true,
  },

  _cleanName(name) {
    if (!name) return "";
    return name
      .replace(/\s*Free\s*Download.*$/i, "")
      .replace(/\s*Pre-Installed.*$/i, "")
      .replace(/–\s*v\d+.*/i, "")
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/:\s*$/, "")
      .trim();
  },

  _formatUrl(href) {
    if (!href) return "";
    if (href.startsWith("http")) return href;
    return `${BASE_URL}/${href.replace(/^\//, "")}`;
  },

  async _scrapeFallback(page_number = 1, onGameFound) {
    try {
      const url =
        page_number === 1 ? FALLBACK_URL : `${FALLBACK_URL}/page/${page_number}/`;
      const axios = require("axios");
      const { data } = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
      });
      const $ = cheerio.load(data);
      const games = [];

      $("a[href*='-free-download/']").each((_, a) => {
        const href = $(a).attr("href");
        let title =
          $(a).attr("title") ||
          $(a).find("img").attr("title") ||
          $(a).text().trim();
        const img =
          $(a).find("img").attr("data-src") ||
          $(a).find("img").attr("src") ||
          "";

        if (title && href && !games.some((g) => g.url === href)) {
          title = this._cleanName(title.replace(/<.*?>/g, ""));
          if (
            title.length > 2 &&
            !title.includes("ago") &&
            !title.includes("Comments")
          ) {
            const gameObj = {
              name: title,
              clean_name: title,
              url: href,
              thumbnail_link: img,
              download_links: [],
            };
            games.push(gameObj);
            if (typeof onGameFound === "function") onGameFound(gameObj);
          }
        }
      });
      return games;
    } catch (e) {
      console.error("[SteamRIP Fallback Error]:", e.message);
      return [];
    }
  },

  async get_homepage_games(page_number = 1, onGameFound) {
    if (typeof page_number === "function") {
      onGameFound = page_number;
      page_number = 1;
    }

    try {
      const url =
        page_number === 1 ? BASE_URL : `${BASE_URL}/page/${page_number}/`;
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const results = [];

      const posts = $("li.post, div.slide, article").toArray();
      for (const post of posts) {
        const titleTag = $(post).find("h2.post-title a, h2.thumb-title a, h2 a");
        if (!titleTag.length) continue;

        const rawName = titleTag.text().trim();
        const href = titleTag.attr("href");
        if (!rawName || !href) continue;

        const img = $(post).find("a.post-thumb img, img");
        const thumbnail_link =
          img.attr("data-src-webp") ||
          img.attr("data-src") ||
          $(post).attr("data-back-webp") ||
          $(post).attr("data-back") ||
          img.attr("src") ||
          "";

        const cleanName = this._cleanName(rawName);

        const game = {
          name: cleanName || rawName,
          clean_name: cleanName || rawName,
          thumbnail_link,
          url: this._formatUrl(href),
          download_links: [],
        };

        results.push(game);
        if (typeof onGameFound === "function") {
          onGameFound(game);
        }
      }

      if (results.length === 0) {
        return await this._scrapeFallback(page_number, onGameFound);
      }

      return results;
    } catch (err) {
      console.warn("[SteamRIP Scraper] Falling back to pre-installed mirror:", err.message);
      return await this._scrapeFallback(page_number, onGameFound);
    }
  },

  async get_games_by_category(category, page = 1, onGameFound) {
    if (typeof page === "function") {
      onGameFound = page;
      page = 1;
    }

    try {
      const url =
        page === 1
          ? `${BASE_URL}/category/${category}/`
          : `${BASE_URL}/category/${category}/page/${page}/`;
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const results = [];

      const posts = $("li.post, div.slide, article").toArray();
      for (const post of posts) {
        const titleTag = $(post).find("h2.post-title a, h2.thumb-title a, h2 a");
        if (!titleTag.length) continue;

        const rawName = titleTag.text().trim();
        const href = titleTag.attr("href");
        if (!rawName || !href) continue;

        const img = $(post).find("a.post-thumb img, img");
        const thumbnail_link =
          img.attr("data-src-webp") ||
          img.attr("data-src") ||
          $(post).attr("data-back-webp") ||
          $(post).attr("data-back") ||
          img.attr("src") ||
          "";

        const cleanName = this._cleanName(rawName);

        const game = {
          name: cleanName || rawName,
          clean_name: cleanName || rawName,
          thumbnail_link,
          categories: [category],
          url: this._formatUrl(href),
          download_links: [],
        };

        results.push(game);
        if (typeof onGameFound === "function") {
          onGameFound(game);
        }
      }

      if (results.length === 0) {
        return await this._scrapeFallback(page, onGameFound);
      }

      return results;
    } catch (err) {
      return await this._scrapeFallback(page, onGameFound);
    }
  },

  async search_games(query, page = 1, onGameFound) {
    if (typeof page === "function") {
      onGameFound = page;
      page = 1;
    }

    try {
      const url =
        page === 1
          ? `${BASE_URL}/?s=${encodeURIComponent(query)}`
          : `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}`;

      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const results = [];

      const posts = $("li.post, div.slide, article").toArray();
      for (const post of posts) {
        const titleTag = $(post).find("h2.post-title a, h2.thumb-title a, h2 a");
        if (!titleTag.length) continue;

        const rawName = titleTag.text().trim();
        const href = titleTag.attr("href");
        if (!rawName || !href) continue;

        const img = $(post).find("a.post-thumb img, img");
        const thumbnail_link =
          img.attr("data-src-webp") ||
          img.attr("data-src") ||
          $(post).attr("data-back-webp") ||
          $(post).attr("data-back") ||
          img.attr("src") ||
          "";

        const cleanName = this._cleanName(rawName);

        const game = {
          name: cleanName || rawName,
          clean_name: cleanName || rawName,
          thumbnail_link,
          url: this._formatUrl(href),
          download_links: [],
        };

        results.push(game);
        if (typeof onGameFound === "function") {
          onGameFound(game);
        }
      }

      if (results.length === 0) {
        return await this._scrapeFallback(page, onGameFound);
      }

      return results;
    } catch (err) {
      return await this._scrapeFallback(page, onGameFound);
    }
  },

  async get_game_details(url) {
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const download_links = [];

      $("a").each((_, el) => {
        let href = $(el).attr("href") || "";
        if (
          href.includes("gofile") ||
          href.includes("megadb") ||
          href.includes("buzzheavier") ||
          href.includes("datanodes") ||
          href.includes("pixeldrain") ||
          href.includes("1fichier") ||
          href.includes("qiwi") ||
          href.startsWith("magnet:")
        ) {
          if (href.startsWith("//")) href = "https:" + href;
          if (href.startsWith("http") && !download_links.includes(href)) {
            download_links.push(href);
          }
        }
      });

      const titleTag = $("h1.post-title, h1.entry-title, h1").first();
      const rawTitle = titleTag.text().trim();

      return {
        name: this._cleanName(rawTitle) || rawTitle,
        clean_name: this._cleanName(rawTitle) || rawTitle,
        download_links,
      };
    } catch (err) {
      return { download_links: [] };
    }
  },
};
