/**
 * NAMA SCRAPE  :: GETDL DOWNLOADER
 * [•] BASIS        :: getdl.space
 */

const axios = require('axios');
const express = require('express');
const router = express.Router();

const BASE_URL = 'https://getdl.space';
const API_ENDPOINT = `${BASE_URL}/api/download`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  'Referer': `${BASE_URL}/id`,
  'Origin': BASE_URL,
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/plain, */*',
  'Cookie': 'NEXT_LOCALE=id' 
};

// Fungsi Scraper GetDL
async function scrapeGetDL(videoUrl) {
  try {
    const response = await axios.post(
      API_ENDPOINT, 
      { url: videoUrl }, 
      {
        headers: HEADERS,
        responseType: 'json'
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
    const result = await scrapeGetDL(url);

    if (!result) {
      return res.status(400).json({ error: "Gagal mengambil data atau media tidak ditemukan." });
    }

    return res.json({
      status: true,
      data: result
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;
