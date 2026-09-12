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

      // Filter khusus: Hanya ambil Berkasdrive
      if (!serverName.toLowerCase().includes("berkasdrive")) {
        return;
      }

      let epName = "";
      let resolution = "Unknown";

      // Metodologi Utama: Parse Query Parameter 'name' secara eksplisit
      try {
        const urlObj = new URL(href);
        const nameParam = urlObj.searchParams.get("name");
        if (nameParam) {
          const decodedName = decodeURIComponent(nameParam);
          
          // Cari pola nomor episode (contoh: Ep_01, Ep_18, Ep 20, S4_Ep_18)
          const epMatch = decodedName.match(/Ep[_\s]*(\d+)/i);
          const resMatch = decodedName.match(/(360p|480p|720p|1080p)/i);

          if (epMatch) {
            const epNum = parseInt(epMatch[1], 10);
            epName = `${cleanAnimeTitle} Episode ${epNum} Sub Indo`;
          }
          if (resMatch) {
            resolution = resMatch[0];
          }
        }
      } catch (_) {}

      // Fallback: Jika parameter 'name' tidak memberikan nomor episode
      if (!epName) {
        const parentBoxText = $(el).closest(".list-download, .download, p, div").text().trim();
        const epMatch = parentBoxText.match(/(?:Episode|Ep)\s*(\d+)/i);
        if (epMatch) {
          const epNum = parseInt(epMatch[1], 10);
          epName = `${cleanAnimeTitle} Episode ${epNum} Sub Indo`;
        } else {
          epName = `${cleanAnimeTitle} Batch Sub Indo`;
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

    // Urutkan Episode secara numerik agar rapih (Episode 1, 2, ..., 20)
    const sortedEpisodeKeys = Array.from(episodeMap.keys()).sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || 0, 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || 0, 10);
      return numA - numB;
    });

    const episodesList = [];
    sortedEpisodeKeys.forEach(epTitle => {
      const resMap = episodeMap.get(epTitle);
      const downloads = [];

      // Urutkan resolusi (360p -> 480p -> 720p -> 1080p)
      const resOrder = ["360p", "480p", "720p", "1080p"];
      const sortedResolutions = Array.from(resMap.keys()).sort((a, b) => {
        return resOrder.indexOf(a) - resOrder.indexOf(b);
      });

      sortedResolutions.forEach(resName => {
        downloads.push({
          resolution: resName,
          servers: resMap.get(resName)
        });
      });

      episodesList.push({
        episode: epTitle,
        downloads: downloads
      });
    });

    return {
      title: rawTitle,
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

router.desc = "Mengambil detail anime dengan memfilter link Berkasdrive terpisah presisi per episode (1-20) dan resolusi.";
router.paramsConfig = {
  url: "text (wajib, URL detail anime dari Nimegami)"
};
router.status = "ready";
router.type = "free";

module.exports = router;
