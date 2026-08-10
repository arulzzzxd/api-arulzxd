/**
 * NAMA SCRAPE  :: KOMIKU SEARCH
 * [•] BASIS        :: komiku.org / api.komiku.org
 */

const express = require('express');
const router = express.Router();

const _cfg = {
  api: 'https://api.komiku.org',
  ua: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'
};

async function _req(url) {
  const r = await fetch(url, { headers: { 'User-Agent': _cfg.ua } });
  return r.text();
}

async function search_it(q) {
  const html = await _req(`${_cfg.api}/?s=${encodeURIComponent(q)}`);
  const results = [];
  const seen = new Set();
  const pat = /href="\/([^"]*)-chapter-(\d+[\.\d]*)\/"/g;
  let m;
  while ((m = pat.exec(html)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      results.push({ slug: m[1], chapter: m[2] });
    }
  }
  return results;
}

// Endpoint GET /
router.get('/', async (req, res) => {
  const q = req.query.query;
  if (!q) {
    return res.status(400).json({ status: false, error: "Missing 'q' or 'query' parameter" });
  }

  try {
    const results = await search_it(q);
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
