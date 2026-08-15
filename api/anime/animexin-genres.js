/**
 * NAMA SCRAPE  :: ANIMEXIN GENRES LIST
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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Referer': BASE_URL
    },
    timeout: 30000,
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });
  return res.data;
}

router.get('/', async (req, res) => {
  try {
    const url = `${BASE_URL}/genres/`;
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const genres = [];
    $('.taxindex li a').each((i, el) => {
      const name = $(el).find('.name').text().trim();
      const count = $(el).find('.count').text().trim();
      const href = $(el).attr('href');
      if (name && href) {
        const slug = href.replace(/^https?:\/\/animexin\.dev\/genres\//i, '').replace(/\/$/, '');
        genres.push({
          name,
          count: parseInt(count) || 0,
          slug
        });
      }
    });

    return res.json({
      status: true,
      data: { total: genres.length, genres }
    });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

router.desc = "Mendapatkan seluruh daftar genre anime beserta total item dan slug-nya.";
router.status = "ready";
router.type = "free";
module.exports = router;
