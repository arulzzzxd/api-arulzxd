/**
 * NAMA SCRAPE  :: SSWEB (FULL PAGE SCREENSHOT)
 * [•] BASIS        :: imagy.app / gcp.imagy.app
 */

const axios = require('axios');
const express = require('express');
const router = express.Router();

async function ssweb(url) {
  const headers = {
    'accept': '*/*',
    'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'content-type': 'application/json',
    'origin': 'https://imagy.app',
    'priority': 'u=1, i',
    'referer': 'https://imagy.app/',
    'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
  };

  const payload = {
    url: url,
    browserWidth: 1280,
    browserHeight: 720,
    fullPage: true, // Otomatis Full Page
    deviceScaleFactor: 1,
    format: 'png'
  };

  const res = await axios.post(
    'https://gcp.imagy.app/screenshot/createscreenshot',
    payload,
    { headers }
  );

  return {
    id: res.data.id,
    fileUrl: res.data.fileUrl,
    success: true
  };
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
    const result = await ssweb(url);

    if (!result.fileUrl) {
      return res.status(400).json({
        status: false,
        error: "Gagal membuat screenshot halaman web."
      });
    }

    return res.json({
      status: true,
      data: {
        id: result.id,
        fileUrl: result.fileUrl,
        fullPage: true
      }
    });

  } catch (e) {
    return res.status(e.response?.status || 500).json({
      status: false,
      error: e.message
    });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
