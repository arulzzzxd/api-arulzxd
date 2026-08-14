/**
 * NAMA SCRAPE  :: LUVYAA LIST MANGA
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

async function getList(type = 'manga', filters = {}) {
  const { status = '', genre = '', order = 'update', page = 1 } = filters;
  let url = `${BASE}/manga/?type=${type}&order=${order}`;
  if (status) url += `&status=${status}`;
  if (genre) url += `&genre%5B%5D=${genre}`;
  if (page > 1) url += `&page=${page}`;
  const html = await getHTML(url);
  const results = [];
  const regex = /<a href="https:\/\/v4\.luvyaa\.co\/([^"]+)\/"[^>]*title="([^"]+)"/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (!m[1].includes('chapter') && !m[1].includes('page') && !m[1].includes('manga') && !results.find(r => r.slug === m[1])) {
      results.push({ title: m[2].trim(), slug: m[1], url: BASE + '/' + m[1] + '/' });
    }
  }
  return { type, status: status || 'all', genre: genre || 'all', order, page, total: results.length, results };
}

router.get('/', async (req, res) => {
  try {
    const type = req.query.type || 'manga';
    const status = req.query.status || '';
    const genre = req.query.genre || '';
    const order = req.query.order || 'update';
    const page = parseInt(req.query.page) || 1;

    const data = await getList(type, { status, genre, order, page });
    return res.json({ success: true, author: 'Nimzz', data });
  } catch (e) {
    return res.status(500).json({ success: false, author: 'Nimzz', error: e.message });
  }
});

router.paramsConfig = {
    type: {
        type: "select",
        options: [
            "manga", "manhua", "manhwa", "novel", "pornwa"
        ]
    },
    status: {
        type: "select",
        options: [
            "", "ongoing", "completed", "hiatus"
        ]
    },
    order: {
        type: "select",
        options: [
            'update', 'popular', 'title', 'titlereverse'
        ]
    }
};

router.status = "ready";
router.type = "free";
module.exports = router;
