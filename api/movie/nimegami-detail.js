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

    let synopsis = "";
    $(".entry-content p").each((_, el) => {
      const text = $(el).text().trim();
      if (text && !text.includes("Judul") && !text.includes("Japanese") && !synopsis) {
        synopsis = text;
      }
    });

    const poster = $(".entry-content img").first().attr("src") || $(".post-thumbnail img").attr("src") || "";

    const episodesList = [];

    // Loop setiap box download episode/batch (elemen div berlatar biru di Nimegami)
    $(".list-download, .download, .mctnx, .box-download").each((_, box) => {
      const $box = $(box);

      // Ambil Judul Episode (misal: "BanG Dream! Ave Mujica Episode 1 Sub Indo")
      const epTitle = $box.find(".title-download, .sub-title, h3, strong").first().text().trim();
      if (!epTitle) return;

      const resolutionsList = [];

      // Loop setiap baris resolusi di dalam box episode tersebut
      $box.find(".row-download, .item-download, tr, p").each((_, row) => {
        const $row = $(row);
        const rowText = $row.text().trim();

        // Deteksi resolusi (360p, 480p, 720p, 1080p)
        const resMatch = rowText.match(/(360p|480p|720p|1080p)/i);
        if (!resMatch) return;

        const resolution = resMatch[0];
        const servers = [];

        // Ambil link server download (MiteDrive, Berkasdrive, Usersdrive, dll)
        $row.find("a").each((_, link) => {
          const href = $(link).attr("href");
          const serverName = $(link).text().trim();

          if (href && serverName && !serverName.match(/360p|480p|720p|1080p/i)) {
            servers.push({
              server: serverName,
              url: href
            });
          }
        });

        if (servers.length > 0) {
          resolutionsList.push({
            resolution: resolution,
            servers: servers
          });
        }
      });

      if (resolutionsList.length > 0) {
        episodesList.push({
          episode: epTitle,
          downloads: resolutionsList
        });
      }
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
    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: err.message || "Terjadi kesalahan pada server."
    });
  }
});

router.desc = "Mengambil detail anime beserta link unduhan terstruktur per episode, resolusi, dan server.";
router.paramsConfig = {
  url: "text (wajib, URL detail anime dari Nimegami)"
};
router.status = "ready";
router.type = "free";

module.exports = router;
