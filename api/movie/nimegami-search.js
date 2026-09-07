const express = require('express');
const cheerio = require('cheerio');

const router = express.Router();

class NimegamiSearch {
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

  async search(query) {
    if (!query) throw new Error("Query parameter is required");
    const html = await this._fetch(`${this.baseUrl}?s=${encodeURIComponent(query)}`);
    const $ = cheerio.load(html);
    const results = [];
    $("article").each((_, el) => {
      const $el = $(el);
      const title = $el.find("h2, h3").text().trim();
      const link = $el.find("a").first().attr("href");
      const image = $el.find("img").attr("src");
      if (title && link) results.push({ title, link, image: image || "" });
    });
    return results.slice(0, 3);
  }
}

const scraper = new NimegamiSearch();

router.get('/', async (req, res) => {
  try {
    const query = req.query.q || req.query.query;

    if (!query) {
      return res.status(400).json({
        status: false,
        creator: "ArulzXD",
        message: "Masukkan parameter query pencarian (contoh: ?q=naruto)"
      });
    }

    const data = await scraper.search(query);
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

router.desc = "Mencari anime di Nimegami berdasarkan kata kunci (3 hasil teratas).";
router.paramsConfig = {
  q: "wajib, contoh: naruto"
};
router.status = "ready";
router.type = "free";

module.exports = router;