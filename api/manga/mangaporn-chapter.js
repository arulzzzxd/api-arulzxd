/**
 * NAMA SCRAPE  :: MANGA18 CHAPTER
 * [•] BASIS        :: manga18.me
 */

const express = require('express');
const router = express.Router();

const BASE = 'https://manga18.me';
const UA = 'Mozilla/5.0 (Linux; Android 10; M2006C3MG Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/148.0.7778.178 Mobile Safari/537.36';

async function fetchHTML(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

async function getChapter(slug, chapter = 'chapter-1') {
  const html = await fetchHTML(`${BASE}/manga/${slug}/${chapter}`);
  let images = [];
  
  const scriptMatch = html.match(/var\s+chapter_images\s*=\s*(\[[^\]]+\])/);
  if (scriptMatch) try { images = JSON.parse(scriptMatch[1]); } catch (e) {}

  if (!images.length) {
    const dataRegex = /data-src="(https?:\/\/img-r\d?\.manga18\.me\/[^"]+\.(?:jpg|png|webp))"/gi;
    let m;
    while ((m = dataRegex.exec(html)) !== null) images.push(m[1]);
  }
  if (!images.length) {
    const srcRegex = /<img[^>]*src="(https?:\/\/img-r\d?\.manga18\.me\/[^"]+\.(?:jpg|png|webp))"/gi;
    let m;
    while ((m = srcRegex.exec(html)) !== null) images.push(m[1]);
  }
  if (!images.length) {
    images = [...new Set([...html.matchAll(/https?:\/\/img-r\d?\.manga18\.me\/[^"'\s]+\.(?:jpg|png|webp)/gi)].map(m => m[0]))];
  }

  return { slug, chapter, url: `${BASE}/manga/${slug}/${chapter}`, total_pages: images.length, images: [...new Set(images)] };
}

// GET /
router.get('/', async (req, res) => {
  try {
    const slug = req.query.slug;
    const chapter = req.query.chapter || 'chapter-1';

    if (!slug) {
      return res.status(400).json({ success: false, error: "Missing 'slug' parameter" });
    }

    const data = await getChapter(slug, chapter);
    return res.json({
      success: true,
      mode: 'chapter',
      total: data.total_pages,
      ...data
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.status = "ready";
router.type = "premium";
module.exports = router;
