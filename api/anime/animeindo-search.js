/**
 * NAMA SCRAPE  :: ANIMEINDO SEARCH
 * [•] BASIS        :: anime-indo.lol
 */

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const router = express.Router();
const BASE_URL = 'https://anime-indo.lol';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.104 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.2903.70',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
];

let uaIndex = 0;

function getHeaders(ref) {
  const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
  uaIndex++;
  return { 'User-Agent': ua, 'Referer': ref || BASE_URL };
}

function extractSlug(url) {
  if (!url) return null;
  return url.replace(/^https?:\/\/anime-indo\.lol\/anime\//i, '').replace(/^https?:\/\/anime-indo\.lol\//i, '').replace(/^\//, '').replace(/\/$/, '');
}

router.get('/', async (req, res) => {
  try {
    const q = req.query.q || req.query.query;
    if (!q) {
      return res.status(400).json({ status: false, error: "Parameter 'q' atau 'query' wajib diisi. Contoh: ?q=naruto" });
    }

    const url = `${BASE_URL}/search.php?q=${encodeURIComponent(q)}`;
    const response = await axios.get(url, {
      headers: getHeaders(url),
      timeout: 30000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const $ = cheerio.load(response.data);
    const items = [];

    $('.otable').each((i, el) => {
      const $el = $(el);
      const $title = $el.find('.videsc a:first');
      const $thumb = $el.find('.vithumb img');
      const title = $title.text().trim();
      const href = $title.attr('href');
      const thumbnail = $thumb.attr('src') || $thumb.attr('data-original') || null;

      if (title && href) {
        items.push({
          title,
          slug: extractSlug(href),
          thumbnail: thumbnail ? (thumbnail.startsWith('http') ? thumbnail : BASE_URL + thumbnail) : null
        });
      }
    });

    return res.json({ status: true, data: { query: q, total: items.length, items } });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

router.desc = "Mencari anime berdasarkan kata kunci. Parameter wajib: ?q=naruto";
router.status = "ready";
router.type = "free";
module.exports = router;
