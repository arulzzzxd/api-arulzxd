/**
 * NAMA SCRAPE  :: ANIMEXIN RELEASE SCHEDULE
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
    const url = `${BASE_URL}/release-date/`;
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const schedule = {};
    $('.schedulepage').each((i, el) => {
      const day = $(el).find('.releases h3 span').text().trim();
      const animeList = [];
      $(el).find('.bsx').each((j, item) => {
        const link = $(item).find('a');
        const title = $(item).find('.tt').text().trim();
        const href = link.attr('href');
        const time = $(item).find('.cndwn').text().trim() || $(item).find('.epx').text().trim();
        const episode = $(item).find('.epx').text().trim();
        const img = $(item).find('img').attr('src');
        if (title && href) {
          animeList.push({
            title,
            url: normalizeUrl(href),
            time: time || 'Unknown',
            episode: episode || null,
            image: img || null
          });
        }
      });
      if (day && animeList.length) schedule[day] = animeList;
    });

    return res.json({
      status: true,
      data: { schedule }
    });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

router.desc = "Mengambil jadwal rilis mingguan anime/donghua berdasarkan hari penayangan.";
router.status = "ready";
router.type = "free";
module.exports = router;
