/**
 * NAMA SCRAPE  :: KOMIKU MANGA INFO
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

async function manga_info(slug) {
  const html = await _req(`${_cfg.base}/manga/${slug}/`);
  const t = html.match(/<title>Komik ([^<]*) - Komiku<\/title>/);
  if (!t) return null;
  const syn = html.match(/<div class="seriestucon">[\s\S]*?<p>([^<]*)<\/p>/);
  const img = html.match(/src="(https:\/\/img\.komiku\.org\/[^"]*\.(jpg|png|webp)[^"]*)"/);
  const type = html.match(/itemprop="additionalType" content="([^"]*)"/)?.[1] || '';
  const status = html.match(/itemprop="creativeWorkStatus" content="([^"]*)"/)?.[1] || '';
  const genres = [...html.matchAll(/itemprop="genre" content="([^"]*)"/g)].map(m => m[1]);
  const author = html.match(/itemprop="name" content="([^"]*)"><\/span>\s*<\/span>\s*<span itemprop="publisher"/)?.[1] || '';
  const chs = [];
  const ch = /href="\/([^"]*)-chapter-(\d+[\.\d]*)\/"/g;
  let x;
  while ((x = ch.exec(html)) !== null) {
    if (!chs.find(c => c.num === x[2])) chs.push({ num: x[2], url: `/${x[1]}-chapter-${x[2]}/` });
  }
  return { slug, title: t[1].trim(), type, status, genres, author, synopsis: syn?.[1]?.trim() || '', cover: img?.[1] || '', chapters: chs.slice(0, 15) };
}

// Endpoint GET /
router.get('/', async (req, res) => {
  const slug = req.query.slug;
  if (!slug) {
    return res.status(400).json({ status: false, error: "Missing 'slug' parameter" });
  }

  try {
    const data = await manga_info(slug);
    if (!data) {
      return res.status(404).json({ status: false, error: "Manga tidak ditemukan" });
    }
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
