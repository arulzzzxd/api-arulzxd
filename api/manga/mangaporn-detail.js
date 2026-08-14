/**
 * NAMA SCRAPE  :: MANGA18 DETAIL
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

async function getDetail(slug) {
  const html = await fetchHTML(`${BASE}/manga/${slug}`);
  const detail = { slug, url: `${BASE}/manga/${slug}`, title: '', description: '', genres: [], chapters: [], thumbnail: '' };
  
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  detail.title = titleMatch ? titleMatch[1].split(' - ')[0].replace(/Read /, '').replace(/ Manhwa at Manga18\.ME/, '').trim() : slug;
  const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/);
  detail.description = descMatch ? descMatch[1] : '';
  
  let m;
  const genreRegex = /<a[^>]*href="\/genre\/[^"]*"[^>]*>([^<]+)<\/a>/gi;
  while ((m = genreRegex.exec(html)) !== null) detail.genres.push(m[1].trim());
  
  const chapterRegex = new RegExp(`<a[^>]*href="(/manga/${slug}/chapter-\\d+)"[^>]*>([^<]+)<\\/a>`, 'gi');
  while ((m = chapterRegex.exec(html)) !== null) detail.chapters.push({ name: m[2].trim(), url: BASE + m[1] });
  
  const imgMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/);
  detail.thumbnail = imgMatch ? imgMatch[1] : '';
  return detail;
}

// GET /
router.get('/', async (req, res) => {
  try {
    const slug = req.query.slug;
    if (!slug) {
      return res.status(400).json({ success: false, error: "Missing 'slug' parameter" });
    }

    const data = await getDetail(slug);
    return res.json({
      success: true,
      mode: 'detail',
      total: data.chapters.length,
      ...data
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.status = "ready";
router.type = "premium";
module.exports = router;
