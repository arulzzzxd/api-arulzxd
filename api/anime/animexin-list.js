/**
 * NAMA SCRAPE  :: ANIMEXIN LIST
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
    const order = req.query.order || 'update';
    const page = parseInt(req.query.page) || 1;
    const url = page === 1
      ? `${BASE_URL}/anime/?order=${order}`
      : `${BASE_URL}/anime/page/${page}/?order=${order}`;

    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const animeList = [];
    $('.bsx').each((i, el) => {
      const link = $(el).find('a');
      const title = $(el).find('.tt h2').text().trim() || $(el).find('.tt').text().trim();
      const href = link.attr('href');
      const type = $(el).find('.typez').text().trim();
      const status = $(el).find('.bt .epx').text().trim() || $(el).find('.status').text().trim();
      const sub = $(el).find('.bt .sb').text().trim();
      const img = $(el).find('img').attr('src');
      const rating = $(el).find('.numscore').text().trim();
      if (title && href) {
        animeList.push({
          title,
          url: normalizeUrl(href),
          type: type || 'ONA',
          status: status || 'Ongoing',
          sub: sub || 'Sub',
          image: img || null,
          rating: rating || null
        });
      }
    });

    return res.json({
      status: true,
      data: { order, page, animeList }
    });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

router.paramsConfig = {
  order: {
    type: "select",
    options: ["update", "latest", "popular", "rating"]
  }
};

router.desc = "Mendapatkan daftar lengkap anime/donghua berdasarkan urutan tertentu. Parameter: ?order=update/popular/latest/rating & ?page=1";
router.status = "ready";
router.type = "free";
module.exports = router;
