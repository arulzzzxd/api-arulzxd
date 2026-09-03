const express = require('express');
const router = express.Router();

const BASE = 'https://4kwallpapers.com';
const UA = 'Mozilla/5.0 (Linux; Android 10; M2006C3MG)';

const headers = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5'
};

async function fetchPage(url) {
  const res = await fetch(url, { headers });
  return res.text();
}

function extractWallpapers(html) {
  const items = [];
  const regex = /<a[^>]+title="([^"]+)"[^>]+class="wallpapers__canvas_image"[^>]+href="(https:\/\/4kwallpapers\.com\/[^"]+\.html)"[\s\S]*?<img[^>]+src="([^"]+)"/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    items.push({
      title: m[1].replace(' Wallpaper', ''),
      url: m[2],
      thumbnail: m[3]
    });
  }
  return [...new Map(items.map(i => [i.url, i])).values()];
}

async function scrapeList(path, page = 1) {
  const url = page > 1 ? `${BASE}${path}?page=${page}` : `${BASE}${path}`;
  const html = await fetchPage(url);

  if (path.includes('collections')) {
    const regex = /<a[^>]+title="([^"]+)"[^>]+href="(\/[a-z-]+\/)"/g;
    const collections = [];
    let m;
    while ((m = regex.exec(html)) !== null) {
      collections.push({
        title: m[1].replace(' Wallpapers', ''),
        url: `${BASE}${m[2]}`
      });
    }
    return collections;
  }

  return extractWallpapers(html);
}

async function searchTag(query) {
  const res = await fetch(`${BASE}/search-api?action=tagsearch&mainsearchtext=${encodeURIComponent(query)}`, { headers });
  return res.json();
}

async function searchWallpapers(query, page = 1) {
  const url = `${BASE}/search/?q=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ''}`;
  const html = await fetchPage(url);

  const results = extractWallpapers(html);

  if (results.length === 0) {
    const regex = /<a[^>]+href="(https:\/\/4kwallpapers\.com\/[a-z-]+\/[a-z0-9-]+-\d+\.html)"[^>]*>/gi;
    const links = [];
    let m;
    while ((m = regex.exec(html)) !== null) {
      links.push({
        title: m[1].split('/').pop().replace(/-\d+\.html$/, '').replace(/-/g, ' '),
        url: m[1]
      });
    }
    return [...new Map(links.map(l => [l.url, l])).values()];
  }

  return results;
}

async function scrapeDetail(url) {
  const html = await fetchPage(url);

  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const authorMatch = html.match(/class="author-link"[^>]*>([^<]+)</);
  const descMatch = html.match(/<meta name="description" content="([^"]+)"/);
  const keywordsMatch = html.match(/<meta name="keywords" content="([^"]+)"/);

  const categories = [];
  const catRegex = /<span class="right-tags">Categories<\/span><a href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  let m;
  while ((m = catRegex.exec(html)) !== null) {
    categories.push({
      url: m[1].startsWith('http') ? m[1] : `${BASE}${m[1]}`,
      name: m[2].trim()
    });
  }

  const tags = [];
  const tagBlock = html.match(/<span class="right-tags">Tags<\/span>([\s\S]*?)<\/p>/);
  if (tagBlock) {
    const tagLinkRegex = /href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    while ((m = tagLinkRegex.exec(tagBlock[1])) !== null) {
      tags.push({
        url: m[1].startsWith('http') ? m[1] : `${BASE}${m[1]}`,
        name: m[2].trim()
      });
    }
  }

  const resolutions = [];
  const resRegex = /href="(\/images\/wallpapers\/[^"]+-(\d+x\d+)-\d+\.jpg)"/gi;
  while ((m = resRegex.exec(html)) !== null) {
    resolutions.push({ resolution: m[2], url: `${BASE}${m[1]}` });
  }

  const originalMatch = html.match(/href="(\/images\/wallpapers\/[^"]+-(\d+)\.jpg)"/);
  const original = originalMatch ? `${BASE}${originalMatch[1]}` : '';

  const related = extractWallpapers(html).filter(w => w.url !== url);

  return {
    title: titleMatch ? titleMatch[1].trim() : '',
    url,
    author: authorMatch ? authorMatch[1].trim() : '',
    description: descMatch ? descMatch[1] : '',
    keywords: keywordsMatch ? keywordsMatch[1].split(', ').filter(k => k) : [],
    categories,
    tags,
    original,
    resolutions: [...new Map(resolutions.map(r => [r.resolution, r])).values()],
    related
  };
}

// Endpoint 1: List Wallpapers (Home, Best, Popular, Random, Collections)
router.get('/', async (req, res) => {
  try {
    const mode = (req.query.mode || req.query.type || 'home').toLowerCase();
    const page = parseInt(req.query.page) || 1;

    const paths = {
      home: '/',
      best: '/best-4k-wallpapers/',
      popular: '/most-popular-4k-wallpapers/',
      random: '/random-wallpapers/',
      collections: '/collections-packs/'
    };

    const targetPath = paths[mode] || '/';
    const result = await scrapeList(targetPath, page);

    return res.json({
      status: true,
      creator: 'ArulzXD',
      mode,
      page,
      total: result.length,
      result
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message
    });
  }
});

// Endpoint 2: Search Wallpapers
router.get('/search', async (req, res) => {
  try {
    const text = req.query.text?.trim() || req.query.q?.trim();
    const page = parseInt(req.query.page) || 1;

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Masukkan parameter text atau q (contoh: ?text=Nature)'
      });
    }

    const result = await searchWallpapers(text, page);

    return res.json({
      status: true,
      creator: 'ArulzXD',
      query: text,
      page,
      total: result.length,
      result
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message
    });
  }
});

// Endpoint 3: Tag Search API
router.get('/search-tag', async (req, res) => {
  try {
    const text = req.query.text?.trim() || req.query.q?.trim();

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Masukkan parameter text atau q (contoh: ?text=Anime)'
      });
    }

    const result = await searchTag(text);

    return res.json({
      status: true,
      creator: 'ArulzXD',
      result
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message
    });
  }
});

// Endpoint 4: Detail Wallpaper
router.get('/detail', async (req, res) => {
  try {
    const url = req.query.url?.trim() || req.query.text?.trim();

    if (!url) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Masukkan parameter url (contoh: ?url=https://4kwallpapers.com/space/gargantua-black-9621.html)'
      });
    }

    const result = await scrapeDetail(url);

    return res.json({
      status: true,
      creator: 'ArulzXD',
      result
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message
    });
  }
});

router.desc = "Mengekstrak wallpaper Kualitas 4K dari 4kwallpapers.com (Home, Search, Tag, Detail, Popular, Collections).";
router.paramsConfig = {
  mode: "home | best | popular | random | collections",
  text: "text/query/url",
  page: "number"
};
router.status = "ready";
router.type = "free";

module.exports = router;