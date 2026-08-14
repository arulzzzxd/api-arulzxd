/**
 * NAMA SCRAPE  :: LUVYAA MANGA DETAIL
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

async function getDetail(slug) {
  const html = await getHTML(BASE + '/' + slug + '/');
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const title = titleMatch ? titleMatch[1].trim() : slug;
  const imgMatch = html.match(/<img[^>]+width="160"[^>]+height="213"[^>]+src="([^"]+)"/);
  const thumbnail = imgMatch ? imgMatch[1] : '';
  const synopsisMatch = html.match(/<meta name="description" content="([^"]+)"/);
  const synopsis = synopsisMatch ? synopsisMatch[1] : '';
  const chapters = [];
  const chapterRegex = /chapter-(\d+)\//g;
  let m;
  while ((m = chapterRegex.exec(html)) !== null) {
    const num = parseInt(m[1]);
    if (!chapters.includes(num)) chapters.push(num);
  }
  chapters.sort((a, b) => a - b);
  const genres = [];
  const genreRegex = /genres\/([a-z0-9-]+)\/" class="meta-pill">([^<]+)<\/a>/g;
  while ((m = genreRegex.exec(html)) !== null) {
    if (!genres.find(g => g.slug === m[1])) genres.push({ slug: m[1], name: m[2].trim() });
  }
  const statusMatch = html.match(/class="status-text">([^<]+)</);
  const typeMatch = html.match(/class="meta-pill">(Manhua|Manhwa|Manga|Novel|Pornwa)<\/a>/);
  const scoreMatch = html.match(/<span>(\d+\.?\d*)<\/span>/);
  return {
    title, slug, thumbnail, synopsis,
    type: typeMatch ? typeMatch[1].trim() : '',
    status: statusMatch ? statusMatch[1].trim() : '',
    score: scoreMatch ? parseFloat(scoreMatch[1]) : null,
    genres, chapters, totalChapters: chapters.length
  };
}

router.get('/', async (req, res) => {
  try {
    const slug = req.query.slug;
    if (!slug) return res.status(400).json({ success: false, author: 'arulzxd', error: "Missing 'slug' parameter" });

    const data = await getDetail(slug);
    return res.json({ success: true, author: 'Nimzz', data });
  } catch (e) {
    return res.status(500).json({ success: false, author: 'Nimzz', error: e.message });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
