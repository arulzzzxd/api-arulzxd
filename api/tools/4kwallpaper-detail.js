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

router.get('/', async (req, res) => {
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

router.desc = "Mengambil detail wallpaper, resolusi download (HD, 4K), tags, dan wallpaper terkait.";
router.paramsConfig = {
  url: "text"
};
router.status = "ready";
router.type = "free";

module.exports = router;