/**
 * NAMA SCRAPE  :: BYPASS LINKS (FIXED 403)
 * [•] BASIS        :: bypass-links.com
 */

const axios = require('axios');
const express = require('express');
const router = express.Router();

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function getHeaders(extra = {}) {
  return {
    "accept": "application/json, text/plain, */*",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "origin": "https://bypass-links.com",
    "referer": "https://bypass-links.com/",
    "sec-ch-ua": "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": UA,
    ...extra
  };
}

async function getToken() {
  try {
    // 1. Coba ambil dari /api/token
    const res = await axios.get("https://bypass-links.com/api/token", {
      headers: getHeaders(),
      timeout: 10000
    });
    if (res.data && res.data.token) return res.data.token;
  } catch (err) {
    // Jika 403 / gagal, coba scrape token langsung dari HTML halaman depan
    const page = await axios.get("https://bypass-links.com/", {
      headers: getHeaders(),
      timeout: 10000
    });
    const html = page.data;
    const match = html.match(/token["']?\s*:\s*["']([^"']+)["']/i) || html.match(/name=["']bypass_token["']\s+value=["']([^"']+)["']/i);
    if (match && match[1]) return match[1];
    throw err;
  }
}

async function bypassLink(url) {
  const bypass_token = await getToken();
  
  const res = await axios.post(
    "https://bypass-links.com/api/bypass",
    { url, bypass_token },
    { 
      headers: getHeaders({ "content-type": "application/json" }),
      timeout: 15000
    }
  );
  
  return res.data;
}

// Endpoint GET Utama
router.get('/', async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({
      status: false,
      error: "Missing 'url' parameter"
    });
  }

  try {
    const data = await bypassLink(url);
    return res.json({
      status: true,
      data
    });
  } catch (err) {
    const statusCode = err.response?.status || 500;
    const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message;

    return res.status(statusCode).json({
      status: false,
      code: statusCode,
      error: statusCode === 403 
        ? "Access Forbidden (403): Target dilindungi Cloudflare/Anti-Bot." 
        : errorMessage
    });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
