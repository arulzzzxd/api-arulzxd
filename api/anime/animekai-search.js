/**
 * NAMA SCRAPE  :: ANIMEKAI SEARCH
 * [•] PEMBUAT      :: irfan
 * [•] BASIS        :: animekai.be
 */

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const router = express.Router();
const BASE_URL = 'https://animekai.be';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

let uaIndex = 0;

function getHeaders(ref = BASE_URL) {
  const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
  uaIndex++;
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    'Referer': ref,
    'Cache-Control': 'no-cache'
  };
}

function extractSlug(url) {
  if (!url) return null;
  return url.replace(/^https?:\/\/animekai\.be\//i, '').replace(/^\//, '').replace(/\/$/, '');
}

async function fetchHTML(url) {
  const res = await axios.get(url, {
    headers: getHeaders(url),
    timeout: 15000,
    maxRedirects: 5,
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });
  return res.data;
}

function parseAnimeHTML(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const results = [];

  if (htmlContent.includes('No results found') || htmlContent.includes('0 anime')) {
    return [];
  }

  $('div.aitem').each((index, element) => {
    const titleElement = $(element).find('a.title');
    const title = titleElement.text().trim();
    const href = titleElement.attr('href');
    const slug = extractSlug(href);
    const jpTitle = titleElement.attr('data-jp') || null;
    const imgElement = $(element).find('.poster img');
    const image = imgElement.attr('src') || null;

    let episodes = 'N/A';
    let type = 'N/A';
    let subCount = 0;
    let dubCount = 0;

    const infoSpans = $(element).find('.info span');
    infoSpans.each((i, span) => {
      const text = $(span).text().trim();
      const hasSub = $(span).find('svg use[href="#sub"]').length > 0;
      const hasDub = $(span).find('svg use[href="#dub"]').length > 0;

      if (hasSub) subCount = parseInt(text) || 0;
      else if (hasDub) dubCount = parseInt(text) || 0;
      else if (['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL'].includes(text.toUpperCase())) type = text.toUpperCase();
      else if (!isNaN(parseInt(text))) episodes = text;
    });

    if (type === 'N/A') {
      const fullText = $(element).find('.info').text().trim();
      if (fullText.includes('MOVIE')) type = 'MOVIE';
      else if (fullText.includes('TV')) type = 'TV';
      else if (fullText.includes('OVA')) type = 'OVA';
    }

    if (title) {
      results.push({
        title,
        jp_title: jpTitle,
        slug,
        image,
        type,
        episodes,
        sub_episodes: subCount || null,
        dub_episodes: dubCount || null
      });
    }
  });

  return results;
}

router.get('/', async (req, res) => {
  try {
    const query = req.query.query;

    if (!query) {
      return res.status(400).json({
        status: false,
        error: "Parameter 'q' atau 'query' wajib diisi. Contoh: ?q=naruto"
      });
    }

    const targetUrl = `${BASE_URL}/browse?keyword=${encodeURIComponent(query)}`;
    const html = await fetchHTML(targetUrl);

    if (html.includes('cf-challenge') || html.includes('Cloudflare')) {
      return res.status(503).json({
        status: false,
        error: "Terdeteksi Cloudflare protection pada target server."
      });
    }

    const data = parseAnimeHTML(html);

    return res.json({
      status: true,
      data: {
        query,
        total: data.length,
        results: data
      }
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      error: err.message
    });
  }
});

router.desc = "Melakukan pencarian anime di AnimeKai. Parameter wajib: ?q=naruto";
router.status = "ready";
router.type = "free";
module.exports = router;
