const express = require('express');
const cheerio = require('cheerio');

const router = express.Router();

class NimegamiHome {
  constructor() {
    this.baseUrl = "https://nimegami.id/";
    this.defaultHeaders = {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
  }

  async _fetch(url) {
    const res = await fetch(url, { headers: this.defaultHeaders });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }

  async home() {
    const html = await this._fetch(this.baseUrl);
    const $ = cheerio.load(html);
    const items = [];
    $("article").each((_, el) => {
      const $el = $(el);
      const title = $el.find("h2, h3").text().trim();
      const link = $el.find("a").first().attr("href");
      const image = $el.find("img").attr("src");
      if (title && link) items.push({ title, link, image: image || "" });
    });
    return items;
  }
}

const scraper = new NimegamiHome();

router.get('/', async (req, res) => {
  try {
    const data = await scraper.home();
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

router.desc = "Mengambil daftar anime terbaru dari halaman utama Nimegami.";
router.paramsConfig = {};
router.status = "ready";
router.type = "free";

module.exports = router;
