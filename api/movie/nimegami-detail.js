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

    const title = $("h1.entry-title, h2.entry-title").text().trim() || $("title").text().trim();

    // Sinopsis
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

      // Filter khusus: Hanya ambil server yang bernama/mengandung "Berkasdrive"
      if (!serverName.toLowerCase().includes("berkasdrive")) {
        return;
      }

      let epName = "";
      let resolution = "Unknown";

      // Metodologi 1: Parsing query parameter name dari URL Berkasdrive
      try {
        const urlObj = new URL(href);
        const nameParam = urlObj.searchParams.get("name");
        if (nameParam) {
          const decodedName = decodeURIComponent(nameParam);
          const epMatch = decodedName.match(/Ep_?(\d+)|Episode\s*(\d+)/i);
          const resMatch = decodedName.match(/(360p|480p|720p|1080p)/i);

          if (epMatch) {
            const epNum = parseInt(epMatch[1] || epMatch[2], 10);
            const baseAnimeName = title.split(":")[0].replace(/Sub Indo|BD|- Nimegami/gi, "").trim();
            epName = `${baseAnimeName} Episode ${epNum} Sub Indo`;
          }
          if (resMatch) {
            resolution = resMatch[0];
          }
        }
      } catch (_) {}

      // Metodologi 2: Fallback ke teks pembungkus jika nama dari URL tidak ditemukan
      if (!epName) {
        const parentBoxText = $(el).closest(".list-download, .download, p, div").text().trim();
        const epMatch = parentBoxText.match(/(?:Episode|Ep)\s*\d+|[^\n]+Episode \d+[^\n]*/i);
        if (epMatch) {
          epName = epMatch[0].trim();
        }
        const resMatch = parentBoxText.match(/(360p|480p|720p|1080p)/i);
        if (resMatch) {
          resolution = resMatch[0];
        }
      }

      if (epName) {
        if (!episodeMap.has(epName)) {
          episodeMap.set(epName, new Map());
        }

        const resMap = episodeMap.get(epName);
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

    // Format output JSON
    const episodesList = [];
    episodeMap.forEach((resMap, epTitle) => {
      const downloads = [];
      resMap.forEach((servers, resName) => {
        downloads.push({
          resolution: resName,
          servers: servers
        });
      });

      episodesList.push({
        episode: epTitle,
        downloads: downloads
      });
    });

    return {
      title,
      synopsis,
      poster,
      total_episodes: episodesList.length,
      episodes: episodesList
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

router.desc = "Mengambil detail anime dengan khusus memfilter dan mengambil link unduhan dari Berkasdrive per episode dan resolusi.";
router.paramsConfig = {
  url: "text (wajib, URL detail anime dari Nimegami)"
};
router.status = "ready";
router.type = "free";

module.exports = router;
