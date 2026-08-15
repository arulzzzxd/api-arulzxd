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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Referer': BASE_URL,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    },
    timeout: 30000,
    maxRedirects: 5,
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });
  return res.data;
}

function extractSlug(url) {
  if (!url) return null;
  return url.replace(/^https?:\/\/animexin\.dev\//i, '').replace(/^\//, '').replace(/\/$/, '');
}

router.get('/', async (req, res) => {
  try {
    const pageParam = req.query.page;

    // Proteksi: Parameter page dibuat WAJIB (Tidak Opsional)
    if (!pageParam) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'page' wajib diisi. Contoh: ?page=1"
      });
    }

    const page = parseInt(pageParam);
    if (isNaN(page) || page < 1) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'page' harus berupa angka positif."
      });
    }

    const url = page === 2 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`;
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const schedule = [];
    $('.listSchh, .schedulepage, .schedule').each((i, el) => {
      const day = $(el).find('h2, h3, .releases h3 span').first().text().trim();
      const animeList = [];
      $(el).find('a').each((j, link) => {
        const title = $(link).text().trim();
        const href = $(link).attr('href');
        if (title && href && href !== '#') {
          animeList.push({ title, slug: extractSlug(href) });
        }
      });
      if (day && animeList.length) schedule.push({ day, animeList });
    });

    const latestReleases = [];
    $('.styleegg, .bsx, .postbody .listupd .bs').each((i, el) => {
      const title = $(el).find('.eggtitle, .tt h2, .tt').first().text().trim();
      const episode = $(el).find('.eggepisode, .bt .epx, .epx').first().text().trim();
      const type = $(el).find('.eggtype, .typez').first().text().trim();
      const href = $(el).find('a').attr('href');
      const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
      if (title && href) {
        latestReleases.push({
          title,
          episode: episode || 'Ongoing',
          type: type || 'ONA',
          slug: extractSlug(href),
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

router.desc = "Mengambil data halaman utama Animexin. Parameter wajib: ?page=1";
router.status = "ready";
router.type = "free";
module.exports = router;
