/**
 * NAMA SCRAPE  :: MANGA18 HOME
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

function extractManga(html, page = 1, limit = 20) {
  const manga = [];
  const seen = new Set();
  const allImgs = [...html.matchAll(/<img[^>]*src="(https?:\/\/manga18\.me\/webtoon\/[^"]+-thumbnail\.jpg)"/gi)].map(m => m[1]);
  const linkRegex = /<a[^>]*href="(\/manga\/([^"]+))"/gi;
  let match;
  const links = [];

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1], slug = match[2];
    if (url.includes('/chapter-')) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    const context = html.substring(Math.max(0, match.index - 500), match.index + 500);
    const titleMatch = context.match(/<h[23][^>]*>([^<]+)<\/h[23]>/);
    const altMatch = context.match(/alt="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : (altMatch ? altMatch[1] : slug.replace(/-/g, ' '));
    links.push({ url: BASE + url, title: title.trim().replace(/&#8217;|&amp;/g, "'").replace(/&#038;/g, '&'), slug });
  }

  links.forEach((link, i) => {
    manga.push({ title: link.title, url: link.url, slug: link.slug, thumbnail: allImgs[i] || null });
  });

  const pageLinks = [...html.matchAll(/page[=/_](\d+)/gi)].map(m => parseInt(m[1]));
  return { manga: manga.slice(0, limit), current_page: page, total_pages: pageLinks.length ? Math.max(...pageLinks) : 1 };
}

// GET /
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const html = await fetchHTML(`${BASE}/?page=${page}`);
    const data = extractManga(html, page, limit);

    return res.json({
      success: true,
      mode: 'home',
      total: data.manga.length,
      ...data
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.status = "ready";
router.type = "premium";
module.exports = router;
