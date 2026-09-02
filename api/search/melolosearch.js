const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();
const BASE_URL = "https://melolo.com";

// Fungsi pembuat IP acak untuk header spoofing
function generateRandomIP() {
  const ranges = [
    [1, 1], [2, 2], [5, 5], [23, 23], [27, 27], [31, 31],
    [36, 36], [37, 37], [39, 39], [42, 42], [46, 46],
    [49, 49], [50, 50], [60, 60], [114, 114], [117, 117],
    [118, 118], [119, 119], [120, 120], [121, 121]
  ];
  const range = ranges[Math.floor(Math.random() * ranges.length)];
  return [
    range[0],
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256)
  ].join(".");
}

// Helper untuk fetch HTML halaman target
async function fetchHtml(targetUrl) {
  const spoofedIp = generateRandomIP();
  const response = await axios.get(targetUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": BASE_URL,
      "X-Forwarded-For": spoofedIp,
      "X-Real-IP": spoofedIp
    },
    timeout: 10000
  });
  return response.data;
}

// Parse HTML menggunakan Cheerio
function parseSearchResults(html, type) {
  const $ = cheerio.load(html);
  const results = [];

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    const title = $(el).text().trim();

    if (href && title) {
      let isMatch = false;

      // Filter berdasarkan tipe konten
      if (type === "short_dramas" && href.includes("/dramas/")) isMatch = true;
      else if (type === "novels" && href.includes("/novels/")) isMatch = true;
      else if (type === "articles" && href.includes("/articles/")) isMatch = true;

      if (isMatch) {
        const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;
        
        // Mencegah duplikasi data
        if (!results.some(item => item.url === fullUrl)) {
          results.push({
            title,
            url: fullUrl
          });
        }
      }
    }
  });

  return results;
}

// Endpoint utama GET /
router.get("/", async (req, res) => {
  try {
    const { query, type, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'query' wajib diisi"
      });
    }

    const validTypes = ["short_dramas", "novels", "articles"];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'type' wajib diisi dengan nilai yang valid",
        available_types: validTypes
      });
    }

    const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;
    const html = await fetchHtml(searchUrl);
    const parsedResults = parseSearchResults(html, type);

    const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
    const finalResults = parsedResults.slice(0, parsedLimit);

    return res.json({
      status: true,
      creator: "ArulzXD",
      query,
      type,
      limit: parsedLimit,
      total_results: finalResults.length,
      results: finalResults
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Terjadi kesalahan pada server"
    });
  }
});

router.status = "ready";
router.type = "free";

module.exports = router;