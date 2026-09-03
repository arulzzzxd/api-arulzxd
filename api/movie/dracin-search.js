const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

class DracinScraper {
  constructor() {
    this.baseUrl = "https://dracinema.com";
    this.apiKey = "xb3MdwdLrZrpaDXvrLLwfP==";
    this.client = axios.create({
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": `${this.baseUrl}/`,
        "X-API-Key": this.apiKey,
        "Accept": "application/json, text/plain, */*"
      }
    });
  }

  _sanitizeText(text) {
    if (!text) return "";
    return text
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  _normalizeTitle(title) {
    if (!title) return "";
    let cleaned = this._sanitizeText(title);
    return cleaned
      .replace(/\s+Full\s+Episode\s+Subtitle\s+Indonesia\s+-\s+Dracinema/gi, "")
      .replace(/\s+Sub\s+Indo\s+-\s+Dracinema/gi, "")
      .replace(/\s+-\s+Dracinema/gi, "")
      .trim();
  }

  _toSlug(text) {
    if (!text) return "";
    return text
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }

  async search(keyword) {
    if (!keyword || !keyword.trim()) return [];

    try {
      const response = await this.client.get(`${this.baseUrl}/api/search`, {
        params: { keyword: keyword.trim() }
      });

      const data = response.data?.data || [];

      if (Array.isArray(data) && data.length > 0) {
        return data.map((item) => ({
          id: item.originalBookId || item.id || "",
          name: this._normalizeTitle(item.bookName || ""),
          title: this._normalizeTitle(item.bookName || ""),
          cover: item.cover || "",
          introduction: this._sanitizeText(item.introduction || ""),
          episodesCount: item.chapterCount || 16,
          rating: 8.8,
          year: 2023,
          url: `/movie/${this._toSlug(this._normalizeTitle(item.bookName || ""))}-${item.originalBookId || item.id}`,
          slug: this._toSlug(this._normalizeTitle(item.bookName || ""))
        }));
      }
    } catch (err) {
      console.warn(`[!] Search API failed (${err.code || err.message})`);
    }

    return [];
  }
}

const scraper = new DracinScraper();

router.get("/", async (req, res) => {
  try {
    const text = req.query.text?.trim() || req.query.q?.trim();

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: "ArulzXD",
        message: "Masukkan parameter text atau q (contoh: ?text=aku ratu)"
      });
    }

    const result = await scraper.search(text);

    return res.json({
      status: true,
      creator: "ArulzXD",
      total: result.length,
      result
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: err.message
    });
  }
});

router.desc = "Mencari daftar drama/film di Dracinema berdasarkan kata kunci. Parameter wajib: ?text=aku ratu";
router.paramsConfig = {
  text: "text"
};
router.status = "ready";
router.type = "free";

module.exports = router;