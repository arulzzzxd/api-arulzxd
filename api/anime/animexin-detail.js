/**
 * NAMA SCRAPE  :: ANIMEXIN DETAIL
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
    const input = req.query.slug;
    if (!input) return res.status(400).json({ status: false, error: "Parameter 'url' atau 'slug' diperlukan." });

    const url = normalizeUrl(input);
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const title = $('.infox h1').text().trim() || $('.entry-title').text().trim();
    const poster = $('.thumb img').attr('src') || null;
    const status = $('.spe span:contains("Status:")').text().replace('Status:', '').trim() || 'Ongoing';
    const type = $('.spe span:contains("Type:")').text().replace('Type:', '').trim() || 'ONA';
    const genres = $('.genxed a').map((_, el) => $(el).text().trim()).get();
    const synopsis = $('.entry-content p').first().text().trim() || '';

    const episodesList = [];
    $('.eplister ul li').each((i, el) => {
      const $el = $(el);
      const href = $el.find('a').attr('href');
      const epNum = $el.find('.epl-num').text().trim();
      const epTitle = $el.find('.epl-title').text().trim();
      const date = $el.find('.epl-date').text().trim();
      if (href && epNum) {
        episodesList.push({
          episode: epNum,
          title: epTitle || epNum,
          date: date || null,
          url: normalizeUrl(href)
        });
      }
    });

    return res.json({
      status: true,
      data: {
        title,
        poster,
        status,
        type,
        genres,
        synopsis,
        episodesList
      }
    });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

router.desc = "Mengambil detail lengkap anime/donghua beserta daftar episodenya. Parameter wajib: ?slug=swallowed-star-season-5 atau ?url=https://animexin.dev/...";
router.status = "ready";
router.type = "free";
module.exports = router;
