/**
 * NAMA SCRAPE  :: ANIMEXIN EPISODE
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

    const title = $('.entry-title').text().trim();
    const defaultPlayer = $('.player-embed iframe').attr('src') || null;

    const servers = [];
    $('.mirror option').each((i, el) => {
      const value = $(el).attr('value');
      const label = $(el).text().trim();
      if (value && label && label !== 'Select Video Server') {
        let iframeSrc = null;
        try {
          const decoded = Buffer.from(value, 'base64').toString('utf-8');
          const iframeMatch = decoded.match(/src="([^"]+)"/);
          if (iframeMatch) iframeSrc = iframeMatch[1];
        } catch (e) {}
        servers.push({ label, url: iframeSrc || null });
      }
    });

    const downloads = [];
    $('.soraddlx').each((i, el) => {
      const subtitle = $(el).find('.sorattlx h3').text().trim();
      const links = [];
      $(el).find('.soraurlx a').each((j, link) => {
        const label = $(link).text().trim();
        const href = $(link).attr('href');
        if (label && href && !href.includes('ko-fi')) {
          links.push({ label, url: href });
        }
      });
      if (subtitle && links.length) {
        downloads.push({ subtitle, links });
      }
    });

    return res.json({
      status: true,
      data: {
        title,
        defaultPlayer,
        servers,
        downloads
      }
    });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

router.desc = "Mengambil link streaming video/embed server dan link unduhan (download) untuk episode tertentu. Parameter wajib: ?slug=swallowed-star-... atau ?url=...";
router.status = "ready";
router.type = "free";
module.exports = router;
