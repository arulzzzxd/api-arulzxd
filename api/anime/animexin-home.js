/**
 * NAMA SCRAPE  :: ANIMEXIN HOME
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
  if (input.startsWith('//')) return `https:${input}`;
  return `${BASE_URL}/${input.replace(/^\//, '')}`;
}

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const url = page === 1 ? BASE_URL : `${BASE_URL}/page/${page}/`;
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const schedule = [];
    $('.listSchh').each((i, el) => {
      const day = $(el).find('h2').text().trim();
      const animeList = [];
      $(el).find('.subSchh a').each((j, link) => {
        const title = $(link).text().trim();
        const href = $(link).attr('href');
        if (title && href && href !== '#') {
          animeList.push({ title, url: normalizeUrl(href) });
        }
      });
      if (day && animeList.length) schedule.push({ day, animeList });
    });

    const latestReleases = [];
    $('.styleegg').each((i, el) => {
      const title = $(el).find('.eggtitle').text().trim() || $(el).find('.tt h2').text().trim();
      const episode = $(el).find('.eggepisode').text().trim();
      const type = $(el).find('.eggtype').text().trim();
      const href = $(el).find('a').attr('href');
      const img = $(el).find('img').attr('src');
      if (title && href) {
        latestReleases.push({
          title,
          episode: episode || 'Ongoing',
          type: type || 'ONA',
          url: normalizeUrl(href),
          image: img || null
        });
      }
    });

    return res.json({
      status: true,
      page,
      data: { schedule, latestReleases }
    });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

router.desc = "Mengambil data halaman utama (homepage) Animexin termasuk rilis terbaru dan jadwal tayang singkat. Parameter opsional: ?page=1";
router.status = "ready";
router.type = "free";
module.exports = router;
