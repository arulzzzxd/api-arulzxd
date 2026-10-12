const express = require('express');
const axios = require('axios');

const router = express.Router();

const BASE_URL = 'https://getdl.space';
const API_ENDPOINT = `${BASE_URL}/api/download`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Referer': `${BASE_URL}/id`,
  'Origin': BASE_URL,
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cookie': 'NEXT_LOCALE=id'
};

async function getRawApiResponse(targetUrl) {
  // Membiarkan error diteruskan ke router handler agar status code asli terdeteksi
  const response = await axios.post(
    API_ENDPOINT,
    { url: targetUrl },
    {
      headers: HEADERS,
      responseType: 'json',
      timeout: 10000 // Limit waktu request 10 detik
    }
  );

  return {
    status_code: response.status,
    metadata: response.data
  };
}

router.get('/', async (req, res) => {
  try {
    const url = req.query.url?.trim();

    if (!url) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Masukkan parameter url/link (contoh: ?url=https://vt.tiktok.com/.../)'
      });
    }

    const result = await getRawApiResponse(url);

    return res.json({
      status: true,
      creator: 'ArulzXD',
      result: result
    });

  } catch (err) {
    console.error('[ERROR Request]:', err.message);

    // Menangkap detail status error asli dari Axios
    const statusCode = err.response?.status || 500;
    const errorDetails = err.response?.data || err.message;

    return res.status(statusCode).json({
      status: false,
      creator: 'ArulzXD',
      message: 'Gagal mengekstrak media dari URL yang diberikan.',
      error_detail: errorDetails
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
