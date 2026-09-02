const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();
const BASE_URL = "https://melolo.com";

function generateRandomIP() {
  const ranges = [
    [1, 1], [2, 2], [5, 5], [23, 23], [27, 27], [31, 31],
    [36, 36], [37, 37], [39, 39], [42, 42], [46, 46],
    [49, 49], [50, 50], [60, 60], [114, 114], [117, 117]
  ];
  const range = ranges[Math.floor(Math.random() * ranges.length)];
  return [
    range[0],
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256)
  ].join(".");
}

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

function parseSearchResults(html, type) {
  const $ = cheerio.load(html);
  const results = [];

  // 1. Coba ekstrak data jika terdapat Embedded State JSON (__NEXT_DATA__ / __NUXT__)
  const nextDataScript = $("#__NEXT_DATA__").html();
  if (nextDataScript) {
    try {
      const jsonState = JSON.parse(nextDataScript);
      // Ambil array pencarian dari data state Next.js (sesuaikan key internalnya jika ada)
      const stateResults = jsonState?.props?.pageProps?.searchResults || [];
      stateResults.forEach(item => {
        results.push({
          title: item.title || item.name,
          url: `${BASE_URL}/dramas/${item.id || item.slug}`
        });
      });
      if (results.length > 0) return results;
    } catch (e) {
      // Mengabaikan error parsing JSON dan beralih ke fallback HTML
    }
  }

  // 2. Fallback: Tangkap link dengan selector lebih longgar (merangkul pola URL drama / series / play)
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    const title = $(el).text().trim() || $(el).attr("title");

    if (href && title) {
      const lowerHref = href.toLowerCase();
      let isMatch = false;

      // Pelonggaran filter path URL untuk Short Drama
      if (type === "short_dramas" && (lowerHref.includes("/dramas/") || lowerHref.includes("/series/") || lowerHref.includes("/play/"))) {
        isMatch = true;
      } else if (type === "novels" && (lowerHref.includes("/novels/") || lowerHref.includes("/book/"))) {
        isMatch = true;
      } else if (type === "articles" && lowerHref.includes("/article")) {
        isMatch = true;
      }

      if (isMatch) {
        const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;
        if (!results.some(item => item.url === fullUrl)) {
          results.push({
            title: title.replace(/\s+/g, " "),
            url: fullUrl
          });
        }
      }
    }
  });

  return results;
}

router.get("/", async (req, res) => {
  try {
    const query = req.query.query;
const type = req.query.type;
const limit = req.query.limit ? Number(req.query.limit) : 5;

    if (!query || !type) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'query' dan 'type' wajib diisi"
      });
    }

    const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;
    const html = await fetchHtml(searchUrl);
    const parsedResults = parseSearchResults(html, type);

    const parsedLimit = Math.max(1, parseInt(limit, 10) || 5);
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
      error: error.message
    });
  }
});

module.exports = router;