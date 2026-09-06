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

router.get('/', async (req, res) => {
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

router.desc = "Mencari wallpaper 4K berdasarkan kata kunci query.";
router.paramsConfig = {
  text: "text",
  page: "number"
};
router.status = "ready";
router.type = "free";

module.exports = router;