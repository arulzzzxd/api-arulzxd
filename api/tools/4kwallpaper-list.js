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

router.desc = "Mengambil daftar wallpaper 4K berdasarkan kategori pilihan (home, best, popular, random, collections).";
router.paramsConfig = {
  mode: {
    type: "select",
    options: ["home", "best", "popular", "random", "collections"],
    default: "home"
  },
  page: "number"
};
router.status = "ready";
router.type = "free";

module.exports = router;