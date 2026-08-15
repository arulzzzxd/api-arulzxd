/**
 * NAMA SCRAPE  :: ANIMEINDO HOME
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
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
];

let uaIndex = 0;

function getHeaders(ref = BASE_URL) {
  const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
  uaIndex++;
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Referer': ref
  };
}

function extractSlug(url) {
  if (!url) return null;
  return url.replace(/^https?:\/\/anime-indo\.lol\//i, '').replace(/^\//, '').replace(/\/$/, '');
}

router.get('/', async (req, res) => {
  try {
    const pageParam = req.query.page;
    if (!pageParam) {
      return res.status(400).json({ status: false, error: "Parameter 'page' wajib diisi. Contoh: ?page=1" });
    }

    const page = parseInt(pageParam);
    if (isNaN(page) || page < 1) {
      return res.status(400).json({ status: false, error: "Parameter 'page' harus berupa angka positif." });
    }

    const url = page === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`;
    const response = await axios.get(url, {
      headers: getHeaders(url),
      timeout: 30000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const $ = cheerio.load(response.data);
    const items = [];

    $('.list-anime').each((i, el) => {
      const $el = $(el);
      const link = $el.find('a').attr('href') || $el.parent('a').attr('href');
      const title = $el.find('p').text().trim();
      const image = $el.find('img').attr('data-original') || $el.find('img').attr('src') || null;
      const episode = $el.find('.eps').text().trim() || null;

      if (link && title) {
        items.push({
          title,
          slug: extractSlug(link),
          image: image ? (image.startsWith('http') ? image : BASE_URL + image) : null,
          episode
        });
      }
    });

    return res.json({ status: true, page, data: { items } });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

router.desc = "Mengambil daftar Rilis Anime Terbaru di AnimeIndo. Parameter wajib: ?page=1";
router.status = "ready";
router.type = "free";
module.exports = router;
