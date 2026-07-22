/**
 * NAMA SCRAPE  :: CAPCUT DOWNLOADER
 * [•] PEMBUAT      :: DEFAN (dipastebin.web.id)
 * [•] BASIS        :: snapvideotools.com
 */

const axios = require('axios');
const express = require('express');
const router = express.Router();

// Fungsi Scraper CapCut Snap Video Tools
async function scrapeCapCut(url) {
  try {
    const response = await axios.post("https://snapvideotools.com/id/api/snap", 
      { text: url }, 
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36",
          "Referer": "https://snapvideotools.com/id/capcut-video-downloader",
        }
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
}

// Endpoint GET Utama
router.get('/', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing 'url' parameter" });

  try {
    const result = await scrapeCapCut(url);

    if (result.code !== 0 || !result.data) {
      return res.status(400).json({ error: "Gagal mengambil data." });
    }

    const d = result.data;
    return res.json({
      status: true,
      data: {
        judul: d.title,
        platform: d.platformName,
        cover: d.cover,
        video: d.mediaUrls.map((v, i) => ({
          kualitas: i === 0 ? "tinggi" : i === 1 ? "sedang" : "rendah",
          url: v.url,
          format: v.suffix,
        })),
      }
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;