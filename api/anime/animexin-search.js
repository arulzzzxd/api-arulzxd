/**
 * NAMA SCRAPE  :: ANIMEXIN SEARCH
 * [•] BASIS        :: animexin.dev
 */

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const router = express.Router();
const BASE_URL = 'https://animexin.dev';

async function fetchHTML(url) {
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': BASE_URL
    },
    timeout: 30000,
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });
  return res.data;
}

function normalizeUrl(input) {
  if (!input) return null;
  if (input.startsWith('http')) return input;
  return `${BASE_URL}/${input.replace(/^\//, '')}`;
}

router.get('/', async (req, res) => {
  try {
    const q = req.query.query;
    if (!q) return res.status(400).json({ status: false, error: "Parameter 'q' atau 'query' wajib diisi." });

    const page = parseInt(req.query.page) || 1;
    const url = page === 1
      ? `${BASE_URL}/?s=${encodeURIComponent(q)}`
      : `${BASE_URL}/page/${page}/?s=${encodeURIComponent(q)}`;

    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const results = [];
    $('.bsx').each((i, el) => {
      const link = $(el).find('a');
      const title = $(el).find('.tt h2').text().trim() || $(el).find('.tt').text().trim();
      const href = link.attr('href');
      const type = $(el).find('.typez').text().trim();
      const status = $(el).find('.bt .epx').text().trim() || $(el).find('.status').text().trim();
      const img = $(el).find('img').attr('src');
      if (title && href) {
        results.push({
          title,
          url: normalizeUrl(href),
          type: type || 'ONA',
          status: status || 'Ongoing',
          image: img || null
        });
      }
    });

    return res.json({
      status: true,
      data: { query: q, page, total: results.length, results }
    });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

router.desc = "Melakukan pencarian judul anime/donghua berdasarkan kata kunci. Parameter wajib: ?q=swallowed & ?page=1";
router.status = "ready";
router.type = "free";
module.exports = router;
