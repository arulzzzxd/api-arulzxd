/**
 * NAMA SCRAPE  :: KOMIKU CHAPTER IMAGES
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

async function chapter_imgs(slug, chap) {
  const html = await _req(`${_cfg.base}/${slug}-chapter-${chap}/`);
  const t = html.match(/<title>([^<]*)<\/title>/);
  const imgs = [];
  const pat = /src="(https:\/\/img\.komiku\.org\/upload5\/[^"]*\.(jpg|png|webp)[^"]*)"/g;
  let m;
  while ((m = pat.exec(html)) !== null) {
    if (!imgs.includes(m[1])) imgs.push(m[1]);
  }
  return { slug, chapter: chap, title: t?.[1] || '', images: imgs, total: imgs.length };
}

// Endpoint GET /
router.get('/', async (req, res) => {
  const slug = req.query.slug;
  const chap = req.query.chapter;

  if (!slug || !chap) {
    return res.status(400).json({ status: false, error: "Missing 'slug' or 'chap'/'chapter' parameter" });
  }

  try {
    const data = await chapter_imgs(slug, chap);
    return res.json({
      status: true,
      data
    });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
