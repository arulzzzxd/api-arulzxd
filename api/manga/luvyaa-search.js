/**
 * NAMA SCRAPE  :: LUVYAA SEARCH
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

async function search(query) {
  const html = await getHTML(BASE + '/?s=' + encodeURIComponent(query));
  const results = [];
  const regex = /<a href="https:\/\/v4\.luvyaa\.co\/([^"]+)\/"[^>]*title="([^"]+)"/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (!m[1].includes('chapter') && !results.find(r => r.slug === m[1])) {
      results.push({ title: m[2].trim(), slug: m[1], url: BASE + '/' + m[1] + '/' });
    }
  }
  return { query, total: results.length, results };
}

router.get('/', async (req, res) => {
  try {
    const q = req.query.query;
    if (!q) return res.status(400).json({ success: false, author: 'arulzxd', error: "Missing 'q' or 'query' parameter" });

    const data = await search(q);
    return res.json({ success: true, author: 'Nimzz', data });
  } catch (e) {
    return res.status(500).json({ success: false, author: 'Nimzz', error: e.message });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
