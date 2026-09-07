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
    const video = $("iframe").attr("src") || "";
    const downloads = [];
    $(".download a, .mctnx a, .entry-content a").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim();
      if (href && text && !href.includes("nimegami")) {
        downloads.push({ server: text, url: href });
      }
    });
    return { title, synopsis, video, downloads: downloads.slice(0, 6) };
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

router.desc = "Mengambil detail anime, sinopsis, streaming video, dan link unduhan (6 link teratas).";
router.paramsConfig = {
  url: "wajib, URL detail dari nimegami"
};
router.status = "ready";
router.type = "free";

module.exports = router;