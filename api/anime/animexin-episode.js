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

    const title = $('.entry-title').text().trim() || $('h1.title-section').text().trim();
    
    // Default video iframe player
    let defaultPlayer = $('.player-embed iframe').attr('src') || $('#pembed iframe').attr('src') || $('.videocontent iframe').attr('src') || null;

    // Scrape Streaming Servers
    const servers = [];
    $('.mirror option, select.mirrorselect option, select#selectserver option').each((i, el) => {
      const value = $(el).attr('value');
      const label = $(el).text().trim();
      if (value && label && !label.toLowerCase().includes('select')) {
        let iframeSrc = null;
        try {
          const decoded = Buffer.from(value, 'base64').toString('utf-8');
          const iframeMatch = decoded.match(/src=["']([^"']+)["']/);
          if (iframeMatch) iframeSrc = iframeMatch[1];
        } catch (e) {
          if (value.startsWith('http')) iframeSrc = value;
        }
        servers.push({ label, url: iframeSrc || value });
      }
    });

    // Scrape Link Download berdasarkan struktur HTML Animexin (SoraDdlx / SoraUrlx / Dwonload Section)
    const downloads = [];
    
    // Pola 1: .soraddlx & .soraurlx
    $('.soraddlx, .soraurlx').each((i, el) => {
      const subtitle = $(el).find('h3, .sorattlx').first().text().trim() || 'Download Links';
      const links = [];
      $(el).find('a').each((j, link) => {
        const label = $(link).text().trim();
        const href = $(link).attr('href');
        if (label && href && !href.includes('ko-fi')) {
          links.push({ label, url: href });
        }
      });
      if (links.length) downloads.push({ subtitle, links });
    });

    // Pola 2 (Fallback untuk layout seperti pada gambar screenshot)
    if (downloads.length === 0) {
      $('.soraurlx, [class*="download"]').each((i, el) => {
        const parentTitle = $(el).prev('h3, .sorattlx').text().trim() || $(el).find('strong').first().text().trim() || 'Download';
        const links = [];
        $(el).find('a').each((j, link) => {
          const label = $(link).text().trim();
          const href = $(link).attr('href');
          if (label && href && !href.includes('ko-fi')) {
            links.push({ label, url: href });
          }
        });
        if (links.length) downloads.push({ subtitle: parentTitle, links });
      });
    }

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

router.desc = "Mengambil streaming server & link download episode. Parameter wajib: ?slug=against-the-sky-supreme-episode-540-indonesia-english-sub";
router.status = "ready";
router.type = "free";
module.exports = router;
