/**
 * NAMA SCRAPE  :: VLIPSY MEME & SHORT VIDEO SEARCH
 * [•] BASIS        :: apiv2.vlipsy.com
 */

const https = require('https');
const express = require('express');
const router = express.Router();

function apiRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'apiv2.vlipsy.com',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error('JSON parse error: ' + err.message));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function searchVlips(query, limit = 10) {
  const encodedQuery = encodeURIComponent(query.toLowerCase().replace(/[^a-z0-9\s]/g, ''));
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
  const path = `/v1/vlips/search?q=${encodedQuery}&limit=${safeLimit}&pos=0&key=vl_hFxn07bG43d0n9t`;

  return await apiRequest(path);
}

// Endpoint GET Utama
router.get('/', async (req, res) => {
  const query = req.query.q || req.query.query;
  const limit = req.query.limit || 10;

  if (!query) {
    return res.status(400).json({
      status: false,
      error: "Missing 'q' or 'query' parameter"
    });
  }

  try {
    const result = await searchVlips(query, limit);

    return res.json({
      status: true,
      query: query,
      total: result.data ? result.data.length : 0,
      data: result.data || [],
      full_result: result
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      error: err.message
    });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
