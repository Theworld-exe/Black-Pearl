const axios = require("axios");

/**
 * Debrid Service API Client for Real-Debrid, AllDebrid, and Torbox
 */

// Validate API Key and get user subscription status
async function validateDebridKey(provider, apiKey) {
  if (!apiKey || !apiKey.trim()) {
    return { valid: false, message: "API key is required" };
  }

  const key = apiKey.trim();

  try {
    if (provider === "realdebrid") {
      const res = await axios.get("https://api.real-debrid.com/rest/1.0/user", {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 10000,
      });

      if (res.data && res.data.id) {
        const isPremium = res.data.type === "premium";
        return {
          valid: true,
          provider: "Real-Debrid",
          username: res.data.username,
          type: res.data.type,
          isPremium,
          expiration: res.data.expiration,
          points: res.data.points || 0,
        };
      }
    } else if (provider === "alldebrid") {
      const res = await axios.get(
        `https://api.alldebrid.com/v4/user?agent=BlackPearl&apikey=${encodeURIComponent(key)}`,
        { timeout: 10000 },
      );

      if (res.data && res.data.status === "success") {
        const user = res.data.data.user;
        return {
          valid: true,
          provider: "AllDebrid",
          username: user.username,
          isPremium: user.isPremium,
          expiration: user.premiumUntil ? new Date(user.premiumUntil * 1000).toISOString() : null,
        };
      }
    } else if (provider === "torbox") {
      const res = await axios.get("https://api.torbox.app/v1/api/user/me", {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 10000,
      });

      if (res.data && res.data.success) {
        const data = res.data.data;
        return {
          valid: true,
          provider: "Torbox",
          username: data.email || "Torbox User",
          isPremium: data.plan > 0,
          plan: data.plan,
        };
      }
    }

    return { valid: false, message: "Invalid API response from provider" };
  } catch (err) {
    const msg =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      "Failed to authenticate with Debrid provider";
    return { valid: false, message: msg };
  }
}

// Unrestrict a hoster file link (e.g. 1fichier, Rapidgator, Mega, etc.)
async function unrestrictLink(provider, apiKey, link) {
  if (!apiKey || !link) return null;
  const key = apiKey.trim();

  try {
    if (provider === "realdebrid") {
      const params = new URLSearchParams();
      params.append("link", link);

      const res = await axios.post(
        "https://api.real-debrid.com/rest/1.0/unrestrict/link",
        params,
        {
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: 15000,
        },
      );

      if (res.data && res.data.download) {
        return {
          url: res.data.download,
          filename: res.data.filename,
          filesize: res.data.filesize,
          provider: "Real-Debrid",
        };
      }
    } else if (provider === "alldebrid") {
      const res = await axios.get(
        `https://api.alldebrid.com/v4/link/unlock?agent=BlackPearl&apikey=${encodeURIComponent(key)}&link=${encodeURIComponent(link)}`,
        { timeout: 15000 },
      );

      if (res.data && res.data.status === "success" && res.data.data?.link) {
        return {
          url: res.data.data.link,
          filename: res.data.data.filename,
          filesize: res.data.data.filesize,
          provider: "AllDebrid",
        };
      }
    }
  } catch (err) {
    console.error(`[Debrid] Unrestrict error (${provider}):`, err.response?.data || err.message);
  }

  return null;
}

// Convert a magnet or torrent to instant cached download links if available
async function unrestrictMagnet(provider, apiKey, magnetUrl) {
  if (!apiKey || !magnetUrl || !magnetUrl.startsWith("magnet:")) return null;
  const key = apiKey.trim();

  try {
    if (provider === "realdebrid") {
      const params = new URLSearchParams();
      params.append("magnet", magnetUrl);

      const addRes = await axios.post(
        "https://api.real-debrid.com/rest/1.0/torrents/addMagnet",
        params,
        {
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: 15000,
        },
      );

      if (addRes.data && addRes.data.id) {
        const torrentId = addRes.data.id;

        // Select all files
        const selectParams = new URLSearchParams();
        selectParams.append("files", "all");
        await axios.post(
          `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`,
          selectParams,
          {
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout: 15000,
          },
        );

        // Check torrent status
        const infoRes = await axios.get(
          `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
          {
            headers: { Authorization: `Bearer ${key}` },
            timeout: 15000,
          },
        );

        if (infoRes.data && infoRes.data.status === "downloaded" && infoRes.data.links?.length > 0) {
          // Instant cache hit! Unrestrict the first or primary link
          const directLinks = [];
          for (const rawLink of infoRes.data.links) {
            const unrestrictRes = await unrestrictLink(provider, apiKey, rawLink);
            if (unrestrictRes?.url) {
              directLinks.push(unrestrictRes);
            }
          }
          if (directLinks.length > 0) {
            return directLinks.length === 1 ? directLinks[0] : directLinks;
          }
        }
      }
    }
  } catch (err) {
    console.error(`[Debrid] Magnet unrestrict error (${provider}):`, err.response?.data || err.message);
  }

  return null;
}

module.exports = {
  validateDebridKey,
  unrestrictLink,
  unrestrictMagnet,
};
