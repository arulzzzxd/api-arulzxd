/**
 * NAMA SCRAPE  :: LUVYAA CHAPTER IMAGES
 * [•] BASIS        :: v4.luvyaa.co
 */

const express = require('express');
const router = express.Router();

const BASE = 'https://v4.luvyaa.co';

async function getHTML(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:150.0) Gecko/20100101 Firefox/150.0',
      'Accept': 'text/html',
      'Referer': BASE + '/'
    }
  });
  return res.text();
}

async function getChapter(slug, chapterNum) {
  const html = await getHTML(`${BASE}/${slug}-chapter-${chapterNum}/`);
  const imagesMatch = html.match(/"images"\s*:\s*\[([^\]]+)\]/);
  if (!imagesMatch) return { slug, chapter: chapterNum, images: [], error: 'No images found' };
  const images = imagesMatch[1].replace(/\\\//g, '/').replace(/"/g, '').split(',').map(url => url.trim());
  const prevMatch = html.match(/"prevUrl"\s*:\s*"([^"]+)"/);
  const nextMatch = html.match(/"nextUrl"\s*:\s*"([^"]+)"/);
  return {
    slug, chapter: chapterNum, images, totalImages: images.length,
    prev: prevMatch ? prevMatch[1].replace(/\\\//g, '/') : null,
    next: nextMatch ? nextMatch[1].replace(/\\\//g, '/') : null
  };
}

router.get('/', async (req, res) => {
  try {
    const slug = req.query.slug;
    const num = req.query.chapter;
    if (!slug) return res.status(400).json({ success: false, author: 'Nimzz', error: "Missing 'slug' parameter" });

    const data = await getChapter(slug, num);
    return res.json({ success: true, author: 'Nimzz', data });
  } catch (e) {
    return res.status(500).json({ success: false, author: 'Nimzz', error: e.message });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
