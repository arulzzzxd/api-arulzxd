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
      if (text && !text.includes("Judul") && !text.includes("Japanese") && !text.includes("Download") && !synopsis) {
        synopsis = text;
      }
    });

    // Poster Gambar
    const poster = $(".entry-content img").first().attr("src") || $(".post-thumbnail img").attr("src") || "";

    const episodesList = [];
    let currentEpisode = null;

    // Scan seluruh elemen anak di dalam entry-content atau area download
    const $content = $(".entry-content, .download-area").length ? $(".entry-content, .download-area") : $("body");

    $content.find("h3, h4, p, div.title-download, div, tr").each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();

      // Detect Judul Episode (misal: "BanG Dream! Ave Mujica Episode 1 Sub Indo" atau "Tensei shitara Slime... Episode 1")
      if (text.match(/Episode\s+\d+|Batch\s+Sub\s+Indo|Ep\s+\d+/i) && !text.match(/360p|480p|720p|1080p/i)) {
        if (currentEpisode && currentEpisode.downloads.length > 0) {
          episodesList.push(currentEpisode);
        }
        currentEpisode = {
          episode: text,
          downloads: []
        };
        return;
      }

      // Detect Baris Resolusi (360p, 480p, 720p, 1080p)
      const resMatch = text.match(/(360p|480p|720p|1080p)/i);
      if (resMatch && currentEpisode) {
        const resolution = resMatch[0];
        const servers = [];

        $el.find("a").each((_, link) => {
          const href = $(link).attr("href");
          const serverName = $(link).text().trim();

          if (href && serverName && !serverName.match(/360p|480p|720p|1080p/i) && !href.includes("#")) {
            servers.push({
              server: serverName,
              url: href
            });
          }
        });

        if (servers.length > 0) {
          // Cari apakah resolusi sudah ada di episode aktif ini
          let resGroup = currentEpisode.downloads.find(d => d.resolution.toLowerCase() === resolution.toLowerCase());
          if (!resGroup) {
            resGroup = { resolution: resolution, servers: [] };
            currentEpisode.downloads.push(resGroup);
          }

          // Masukkan server tanpa duplikat
          servers.forEach(s => {
            if (!resGroup.servers.some(existing => existing.url === s.url)) {
              resGroup.servers.push(s);
            }
          });
        }
      }
    });

    // Pindahkan episode terakhir jika ada
    if (currentEpisode && currentEpisode.downloads.length > 0) {
      episodesList.push(currentEpisode);
    }

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

router.desc = "Mengambil detail anime dengan link unduhan terstruktur per episode, resolusi, dan server secara presisi.";
router.paramsConfig = {
  url: "text (wajib, URL detail anime dari Nimegami)"
};
router.status = "ready";
router.type = "free";

module.exports = router;
