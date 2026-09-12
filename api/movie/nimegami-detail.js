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
    const synopsis = $(".entry-content p").first().text().trim();
    const poster = $(".entry-content img").first().attr("src") || "";

    const episodes = [];

    // Mengambil daftar episode dari elemen link/list yang mengarah ke halaman episode
    $(".list-eps a, .eps-list a, .entry-content ul li a").each((_, el) => {
      const epTitle = $(el).text().trim();
      const epUrl = $(el).attr("href");

      if (epUrl && epUrl.includes("nimegami") && epTitle) {
        episodes.push({
          title: epTitle,
          url: epUrl
        });
      }
    });

    return {
      title,
      synopsis,
      poster,
      total_episodes: episodes.length,
      episodes: episodes
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

router.desc = "Mengambil detail anime beserta daftar link episodenya.";
router.paramsConfig = {
  url: "text (wajib, URL detail anime dari Nimegami)"
};
router.status = "ready";
router.type = "free";

module.exports = router;
