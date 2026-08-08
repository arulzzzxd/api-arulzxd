/**
 * NAMA SCRAPE  :: BYPASS LINKS
 * [•] BASIS        :: bypass-links.com
 */

const axios = require("axios");
const express = require("express");
const router = express.Router();

const HEADERS = {
  accept: "*/*",
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "cache-control": "no-cache",
  pragma: "no-cache",
  "sec-ch-ua": '"Mises";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
  "sec-ch-ua-mobile": "?1",
  "sec-ch-ua-platform": '"Android"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  Referer: "https://bypass-links.com/"
};

// Fungsi Mengambil Token
async function getToken() {
  const res = await axios.get("https://bypass-links.com/api/token", {
    headers: HEADERS
  });
  return res.data.token;
}

// Fungsi Scraper Bypass Link
async function bypassLink(url) {
  try {
    const bypass_token = await getToken();
    const res = await axios.post(
      "https://bypass-links.com/api/bypass",
      { url, bypass_token },
      { headers: { ...HEADERS, "content-type": "application/json" } }
    );
    return res.data;
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
    const result = await bypassLink(url);

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
