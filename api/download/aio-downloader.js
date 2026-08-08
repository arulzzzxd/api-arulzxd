/**
 * NAMA SCRAPE  :: SAVEFBS DOWNLOADER
 * [•] BASIS        :: savefbs.com
 */

const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();

// Fungsi Scraper SaveFBS
async function scrapeSaveFBS(videoUrl) {
  try {
    const { data: html } = await axios.post(
      "https://savefbs.com/api/v1/aio/html",
      {
        vid: videoUrl,
        prefix: "savefbs.com",
        ex: "",
        format: ""
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Referer": "https://savefbs.com/all-in-one-video-downloader/",
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/137 Mobile Safari/537.36"
        }
      }
    );

    const $ = cheerio.load(html);

    // Parse Data
    const title = $("h3.text-sm").text().trim() || null;
    const description =
      $(".text-gray-700").text().trim() ||
      $(".text-gray-600").text().trim() ||
      null;

    const owner =
      $("p.text-gray-600")
        .first()
        .text()
        .replace("Owner:", "")
        .trim() || null;

    const thumbnail = $("img.aio-thumbnail").attr("src") || null;

    const downloads = [];
    $("a.download-btn").each((_, el) => {
      const url = $(el).attr("href");
      const label = $(el).text().trim();

      if (url) {
        downloads.push({
          label,
          url
        });
      }
    });

    return {
      title,
      description,
      owner,
      thumbnail,
      downloads
    };
  } catch (error) {
    throw error;
  }
}

// Endpoint GET Utama
router.get('/', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing 'url' parameter" });

  try {
    const result = await scrapeSaveFBS(url);

    if (!result.downloads || result.downloads.length === 0) {
      return res.status(400).json({ error: "Gagal mengambil data atau media tidak ditemukan." });
    }

    return res.json({
      status: true,
      data: {
        judul: result.title,
        deskripsi: result.description,
        pemilik: result.owner,
        cover: result.thumbnail,
        downloads: result.downloads
      }
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;
