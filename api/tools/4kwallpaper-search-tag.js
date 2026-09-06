const express = require('express');
const router = express.Router();

const BASE = 'https://4kwallpapers.com';
const UA = 'Mozilla/5.0 (Linux; Android 10; M2006C3MG)';

const headers = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5'
};

async function searchTag(query) {
  const res = await fetch(`${BASE}/search-api?action=tagsearch&mainsearchtext=${encodeURIComponent(query)}`, { headers });
  return res.json();
}

router.get('/', async (req, res) => {
  try {
    const text = req.query.text?.trim() || req.query.q?.trim();

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Masukkan parameter text atau q (contoh: ?text=Anime)'
      });
    }

    const result = await searchTag(text);

    return res.json({
      status: true,
      creator: 'ArulzXD',
      result
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message
    });
  }
});

router.desc = "Mencari saran tag/kategori kata kunci dari 4kwallpapers.com.";
router.paramsConfig = {
  text: "text"
};
router.status = "ready";
router.type = "free";

module.exports = router;