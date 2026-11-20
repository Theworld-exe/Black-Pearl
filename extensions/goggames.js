const cheerio = require("cheerio");
const { net } = require("electron");

const BASE_URL = "https://freegogpcgames.com";

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
      return await res.text();
    }
  } catch (e) {
    console.warn("[GOGGames] net.fetch fallback:", e.message);
  }

  const axios = require("axios");
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });
  return data;
}

module.exports = {
  name: "GOG Games",
  categories: [
    "Action",
    "Adventure",
    "RPG",
    "Strategy",
    "Simulation",
    "Shooter",
    "Indie",
    "All Games",
  ],
  capabilities: {
    hasCategoryPagination: true,
    hasSearchPagination: true,
    hasStreaming: true,
  },

  _cleanName(name) {
    if (!name) return "";
    return name
      .replace(/\[.*?\]/g, "")
      .replace(/\(.*?\)/g, "")
      .replace(/–\s*(GOG|v\d+|Build|Deluxe|Edition).*/i, "")
      .replace(/-\s*(GOG|v\d+|Build|Deluxe|Edition).*/i, "")
      .trim();
  },

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
        const thumbnail =
          imgEl.attr("data-src") ||
          imgEl.attr("data-lazy-src") ||
          imgEl.attr("src") ||
          "";

        const cleanName = this._cleanName(rawTitle);

        const gameObj = {
          name: cleanName || rawTitle,
          clean_name: cleanName || rawTitle,
          url: link,
          thumbnail_link: thumbnail,
          download_links: [],
        };

        games.push(gameObj);
        if (typeof onGameFound === "function") {
          onGameFound(gameObj);
        }
      });

      return games;
    } catch (e) {
      console.error("[GOG Scraper Error]:", e.message);
      return [];
    }
  },

  async get_homepage_games(page_number = 1, onGameFound) {
    if (typeof page_number === "function") {
      onGameFound = page_number;
      page_number = 1;
    }
    const url =
      page_number === 1 ? BASE_URL : `${BASE_URL}/page/${page_number}/`;
    return this._scrapeLoop(url, onGameFound);
  },

  async get_games_by_category(category, page = 1, onGameFound) {
    if (typeof page === "function") {
      onGameFound = page;
      page = 1;
    }
    const slug = encodeURIComponent(category.toLowerCase().replace(/\s+/g, "-"));
    const url =
      page === 1
        ? `${BASE_URL}/category/${slug}/`
        : `${BASE_URL}/category/${slug}/page/${page}/`;

    return this._scrapeLoop(url, onGameFound);
  },

  async search_games(query, page = 1, onGameFound) {
    if (typeof page === "function") {
      onGameFound = page;
      page = 1;
    }
    const encoded = encodeURIComponent(query);
    const url =
      page === 1
        ? `${BASE_URL}/?s=${encoded}`
        : `${BASE_URL}/page/${page}/?s=${encoded}`;
    return this._scrapeLoop(url, onGameFound);
  },

  async get_game_details(url) {
    try {
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const links = [];

      $("a").each((_, a) => {
        const href = $(a).attr("href");
        if (!href) return;

        if (
          href.includes("gofile.io") ||
          href.includes("buzzheavier.com") ||
          href.includes("1fichier.com") ||
          href.includes("pixeldrain.com") ||
          href.includes("qiwi.gg") ||
          href.includes("mediafire.com") ||
          href.includes("megaup.net") ||
          href.startsWith("magnet:")
        ) {
          if (!links.includes(href)) links.push(href);
        }
      });

      const rawTitle = $("h1.entry-title").text().trim();

      return {
        name: this._cleanName(rawTitle) || rawTitle,
        clean_name: this._cleanName(rawTitle) || rawTitle,
        download_links: links,
      };
    } catch (e) {
      return { download_links: [] };
    }
  },
};
