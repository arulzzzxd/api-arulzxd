const express = require('express');
const axios = require('axios');

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

async function getRawApiResponse(targetUrl) {
  try {
    const response = await axios.post(API_ENDPOINT, 
      { url: targetUrl }, 
      {
        headers: HEADERS,
        responseType: 'json'
      }
    );

    const result = {
      status_code: response.status,
      metadata: response.data
    };
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('[ERROR] Request Gagal:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Respon Server:', error.response.data);
    }
  }
}

router.get('/', async (req, res) => {
  try {
    const url = req.query.url?.trim();

    if (!url) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Masukkan parameter url/link (contoh: ?url=https://vt.tiktok.com/spjw.../)'
      });
    }

    const result = await getRawApiResponse(url);

    if (!result) {
      return res.status(404).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Gagal mengekstrak media dari URL yang diberikan.'
      });
    }

    return res.json({
      status: true,
      creator: 'ArulzXD',
      result: result
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message || 'Terjadi kesalahan pada server saat memproses unduhan.'
    });
  }
});

router.desc = "Pengunduh media All-in-One untuk mendownload video/foto dari YouTube, TikTok, Instagram, Facebook, Threads, Pinterest, dan platform sosial media lainnya.";
router.paramsConfig = {
  url: "contoh: https://vt.tiktok.com/Arx.../"
};
router.status = "ready";
router.type = "free";

module.exports = router;
