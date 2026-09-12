const express = require('express');
const cheerio = require('cheerio');

const router = express.Router();

class NimegamiDetail {
  constructor() {
    this.defaultHeaders = {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
  }

  async _fetch(url) {
    const res = await fetch(url, { headers: this.defaultHeaders });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }

  async detail(url) {
    if (!url) throw new Error("URL parameter is required");
    const html = await this._fetch(url);
    const $ = cheerio.load(html);

    const rawTitle = $("h1.entry-title, h2.entry-title").text().trim() || $("title").text().trim();
    const cleanAnimeTitle = rawTitle.replace(/Sub Indo|BD|- Nimegami/gi, "").replace(/:.*$/g, "").trim();

    let synopsis = "";
    $(".entry-content p").each((_, el) => {
      const text = $(el).text().trim();
      if (text && !text.includes("Judul") && !text.includes("Japanese") && !synopsis) {
        synopsis = text;
      }
    });

    const poster = $(".entry-content img").first().attr("src") || $(".post-thumbnail img").attr("src") || "";

    const episodeMap = new Map();

    $(".entry-content a, .download a, .mctnx a").each((_, el) => {
      const href = $(el).attr("href");
      const serverName = $(el).text().trim();

      if (!href || !serverName) return;

      if (!serverName.toLowerCase().includes("berkasdrive")) {
        return;
      }

      let epKey = "";
      let resolution = "Unknown";

      try {
        const urlObj = new URL(href);
        const nameParam = urlObj.searchParams.get("name");
        if (nameParam) {
          const decodedName = decodeURIComponent(nameParam);
          const epMatch = decodedName.match(/Ep[_\s]*(\d+)/i);
          const resMatch = decodedName.match(/(360p|480p|720p|1080p)/i);

          if (epMatch) {
            epKey = `episode_${parseInt(epMatch[1], 10)}`;
          }
          if (resMatch) {
            resolution = resMatch[0];
          }
        }
      } catch (_) {}

      if (!epKey) {
        const parentBoxText = $(el).closest(".list-download, .download, p, div").text().trim();
        const epMatch = parentBoxText.match(/(?:Episode|Ep)\s*(\d+)/i);
        if (epMatch) {
          epKey = `episode_${parseInt(epMatch[1], 10)}`;
        } else {
          epKey = "batch";
        }

        const resMatch = parentBoxText.match(/(360p|480p|720p|1080p)/i);
        if (resMatch) {
          resolution = resMatch[0];
        }
      }

      if (epKey) {
        if (!episodeMap.has(epKey)) {
          episodeMap.set(epKey, new Map());
        }

        const resMap = episodeMap.get(epKey);
        if (!resMap.has(resolution)) {
          resMap.set(resolution, []);
        }

        const servers = resMap.get(resolution);
        if (!servers.some(s => s.url === href)) {
          servers.push({
            server: serverName,
            url: href
          });
        }
      }
    });

    const sortedEpisodeKeys = Array.from(episodeMap.keys()).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, "") || 0, 10);
      const numB = parseInt(b.replace(/\D/g, "") || 0, 10);
      return numA - numB;
    });

    const episodesObj = {};
    const resOrder = ["360p", "480p", "720p", "1080p"];

    sortedEpisodeKeys.forEach(epKey => {
      const resMap = episodeMap.get(epKey);
      episodesObj[epKey] = {};

      const sortedResolutions = Array.from(resMap.keys()).sort((a, b) => {
        return resOrder.indexOf(a) - resOrder.indexOf(b);
      });

      sortedResolutions.forEach(resName => {
        episodesObj[epKey][resName] = resMap.get(resName);
      });
    });

    return {
      title: rawTitle,
      synopsis,
      poster,
      total_episodes: Object.keys(episodesObj).length,
      episodes: episodesObj
    };
  }
}

const scraper = new NimegamiDetail();

router.get('/', async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({
        status: false,
        creator: "ArulzXD",
        message: "Masukkan parameter URL detail anime (contoh: ?url=https://nimegami.id/...)"
      });
    }

    const data = await scraper.detail(url);
    return res.json({
      status: true,
      creator: "ArulzXD",
      result: data
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: err.message || "Terjadi kesalahan pada server."
    });
  }
});

router.desc = "Mengambil detail anime dengan struktur JSON episode yang ringkas dan mudah dibaca.";
router.paramsConfig = {
  url: "URL detail anime dari Nimegami"
};
router.status = "ready";
router.type = "free";

module.exports = router;
