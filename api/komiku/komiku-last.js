/**
 * NAMA SCRAPE  :: KOMIKU LATEST MANGA
 * [•] BASIS        :: komiku.org
 */

const express = require('express');
const router = express.Router();

const _cfg = {
  base: 'https://komiku.org',
  ua: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'
};

async function _req(url) {
  const r = await fetch(url, { headers: { 'User-Agent': _cfg.ua } });
  return r.text();
}

async function latest() {
  const html = await _req(_cfg.base);
  const items = [];
  const pat = /href="\/([^"]*)-chapter-(\d+[\.\d]*)\/"/g;
  let m;
  while ((m = pat.exec(html)) !== null) {
    if (!items.find(i => i.slug === m[1])) {
      items.push({ slug: m[1], chapter: m[2] });
    }
  }
  return items.slice(0, 20);
}

// Endpoint GET /
router.get('/', async (req, res) => {
  try {
    const results = await latest();
    return res.json({
      status: true,
      total: results.length,
      data: results
    });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
