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
    
    // Ambil sinopsis dari paragraf pertama entry-content yang bukan metadata
    let synopsis = "";
    $(".entry-content p").each((_, el) => {
      const text = $(el).text().trim();
      if (text && !text.includes("Judul") && !text.includes("Japanese") && !synopsis) {
        synopsis = text;
      }
    });

    const poster = $(".entry-content img").first().attr("src") || $(".post-thumbnail img").attr("src") || "";

    const episodes = [];
    const seenUrls = new Set();

    // 1. Coba tangkap link per episode jika berupa batch/list di dalam tabel/box download
    $(".download, .mctnx, .entry-content, .list-eps").find("a").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim();

      if (href && text) {
        // Filter agar mengambil link episode/server dan menghindari link eksternal atau nav utama
        const isEpisodeLink = /episode|\bep\b|\b\d{1,3}\b/i.test(text) || href.includes("nimegami.id");
        
        if (!seenUrls.has(href) && !href.includes("#") && !href.endsWith("nimegami.id/")) {
          seenUrls.add(href);
          episodes.push({
            title: text,
            url: href
          });
        }
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

router.desc = "Mengambil detail anime beserta seluruh daftar link episode/download yang tersedia.";
router.paramsConfig = {
  url: "text (wajib, URL detail anime dari Nimegami)"
};
router.status = "ready";
router.type = "free";

module.exports = router;
