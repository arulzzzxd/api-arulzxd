/**
 * NAMA SCRAPE  :: RYTE WEBSITE CHECKER
 * [•] BASIS        :: website-checker-api.ryte.com
 * [•] CONVERTED    :: Express Router API
 */

const axios = require('axios');
const express = require('express');
const router = express.Router();

// Endpoint GET Utama
router.get('/', async (req, res) => {
  const targetUrl = req.query.url;

  // Validasi jika parameter URL tidak diisi oleh client
  if (!targetUrl) {
    return res.status(400).json({
      status: false,
      error: "Missing required 'url' parameter"
    });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
    'Referer': 'https://en.ryte.com/website-checker/'
  };

  try {
    const response = await axios.get(
      `https://website-checker-api.ryte.com/?url=${encodeURIComponent(targetUrl)}`, 
      {
        headers: headers,
        timeout: 15000 // Sedikit dinaikkan untuk mengantisipasi web audit yang agak lambat
      }
    );

    // Mengembalikan data hasil audit website langsung dari Ryte API
    return res.json({
      status: true,
      code: response.status,
      result: response.data
    });

  } catch (e) {
    return res.status(500).json({
      status: false,
      code: 500,
      error: e.message
    });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
