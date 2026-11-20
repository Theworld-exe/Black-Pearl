const cheerio = require("cheerio");
const { net } = require("electron");

const BASE_URL = "https://online-fix.me";

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
    console.warn("[OnlineFix] net.fetch fallback:", e.message);
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
  name: "Online-Fix",
  categories: [
    "Co-Op Multiplayer",
    "Action",
    "Shooter",
    "Survival",
    "Horror",
    "Simulator",
    "Arcade",
    "Official Servers",
  ],
  capabilities: {
    hasCategoryPagination: true,
    hasSearchPagination: true,
    hasStreaming: true,
  },

  _cleanName(name) {
    if (!name) return "";
    return name
      .replace(/по сети.*$/i, "")
      .replace(/онлайн.*$/i, "")
      .replace(/online.*$/i, "")
      .replace(/\[.*?\]/g, "")
      .replace(/\(.*?\)/g, "")
      .trim();
  },

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
          if (!link.startsWith("http")) link = `${BASE_URL}${link}`;
          if (thumbnail && !thumbnail.startsWith("http")) thumbnail = `${BASE_URL}${thumbnail}`;

          const clean = this._cleanName(rawName);

          const gameObj = {
            name: clean || rawName,
            clean_name: clean || rawName,
            url: link,
            thumbnail_link: thumbnail,
            download_links: [],
          };

          games.push(gameObj);
          if (typeof onGameFound === "function") {
            onGameFound(gameObj);
          }
        }
      });

      return games;
    } catch (e) {
      console.error("[OnlineFix Scraper Error]:", e.message);
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
    const slugMap = {
      "co-op multiplayer": "coop",
      "action": "action",
      "shooter": "shooter",
      "survival": "survival",
      "horror": "horror",
      "simulator": "simulator",
      "arcade": "arcade",
      "official servers": "officialservers",
    };
    const slug = slugMap[category.toLowerCase()] || "games";
    const url =
      page === 1
        ? `${BASE_URL}/games/${slug}/`
        : `${BASE_URL}/games/${slug}/page/${page}/`;

    return this._scrapeLoop(url, onGameFound);
  },

  async search_games(query, page = 1, onGameFound) {
    if (typeof page === "function") {
      onGameFound = page;
      page = 1;
    }
    const encoded = encodeURIComponent(query);
    const url = `${BASE_URL}/index.php?do=search&subaction=search&story=${encoded}&search_start=${page}`;
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
          href.startsWith("magnet:") ||
          href.includes("torrent")
        ) {
          if (!links.includes(href)) links.push(href);
        }
      });

      const title = $("h2.title, h1").first().text().trim();

      return {
        name: this._cleanName(title) || title,
        clean_name: this._cleanName(title) || title,
        download_links: links,
      };
    } catch (e) {
      return { download_links: [] };
    }
  },
};
