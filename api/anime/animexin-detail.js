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

function slugToUrl(slug) {
  if (!slug) return null;
  const cleanSlug = slug.replace(/^https?:\/\/animexin\.dev\//i, '').replace(/^\//, '').replace(/\/$/, '');
  return `${BASE_URL}/${cleanSlug}/`;
}

router.get('/', async (req, res) => {
  try {
    const slug = req.query.slug;
    if (!slug) return res.status(400).json({ status: false, error: "Parameter 'slug' wajib diisi." });

    const url = slugToUrl(slug);
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const title = $('.infox h1').text().trim() || $('.entry-title').text().trim();
    const poster = $('.thumb img').attr('src') || $('.bigcover .ime img').attr('src') || null;
    const status = $('.spe span:contains("Status:")').text().replace('Status:', '').trim() || 'Ongoing';
    const type = $('.spe span:contains("Type:")').text().replace('Type:', '').trim() || 'ONA';
    const genres = $('.genxed a').map((_, el) => $(el).text().trim()).get();
    const synopsis = $('.entry-content p').first().text().trim() || $('.synp .entry-content p').text().trim() || '';

    const episodesList = [];
    $('.eplister ul li').each((i, el) => {
      const $el = $(el);
      const href = $el.find('a').attr('href');
      const epNum = $el.find('.epl-num').text().trim();
      const epTitle = $el.find('.epl-title').text().trim();
      const date = $el.find('.epl-date').text().trim();
      if (href) {
        const epSlug = href.replace(/^https?:\/\/animexin\.dev\//i, '').replace(/^\//, '').replace(/\/$/, '');
        episodesList.push({
          episode: epNum || `Episode ${i + 1}`,
          title: epTitle || epNum || `Episode ${i + 1}`,
          date: date || null,
          slug: epSlug
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

router.desc = "Mengambil detail anime. Parameter wajib: ?slug=aliens-among-immortals";
router.status = "ready";
router.type = "free";
module.exports = router;
