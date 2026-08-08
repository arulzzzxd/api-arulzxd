/**
 * NAMA SCRAPE  :: SSVID ALL-IN-ONE DOWNLOADER
 * [•] BASIS        :: ssvid.net
 */

const axios = require('axios');
const express = require('express');
const router = express.Router();

// Fungsi Scraper SSVID
async function scrapeSsvid(url) {
  try {
    const params = new URLSearchParams();
    params.append('query', url);
    params.append('vt', 'home');

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept': '*/*',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
      'Referer': 'https://ssvid.net/en'
    };

    const response = await axios.post(
      'https://ssvid.net/api/ajax/search?hl=en',
      params.toString(),
      {
        headers,
        compress: true,
        timeout: 10000
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

  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ 
      status: false, 
      error: "Parameter 'url' tidak valid atau tidak ditemukan." 
    });
  }

  try {
    const result = await scrapeSsvid(url);

    if (result.status !== "ok" && result.status !== "success" && !result.mess && !result.links) {
      return res.status(400).json({
        status: false,
        error: result.mess || "Gagal mengambil data dari server SSVID."
      });
    }

    return res.json({
      status: true,
      data: result
    });

  } catch (e) {
    return res.status(e.response?.status || 500).json({
      status: false,
      error: e.message,
      data: e.response?.data || null
    });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
