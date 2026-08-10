/**
 * NAMA SCRAPE  :: BEST HD WALLPAPER (AUTO RANDOM PAGE)
 * [•] BASIS        :: besthdwallpaper.com
 */

const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();

async function wallpaper(title) {
  // Otomatis memilih halaman acak antara 1 sampai 20
  const randomPage = Math.floor(Math.random() * 20) + 1;

  const { data } = await axios.get(
    `https://www.besthdwallpaper.com/search?CurrentPage=${randomPage}&q=${encodeURIComponent(title)}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }
  );

  const $ = cheerio.load(data);
  const hasil = [];

  $('div.grid-item').each(function (_, b) {
    const itemTitle = $(b).find('div.info > a > h3').text().trim();
    if (itemTitle) {
      hasil.push({
        title: itemTitle,
        type: $(b).find('div.info > a:nth-child(2)').text().trim(),
        source: 'https://www.besthdwallpaper.com' + $(b).find('div > a:nth-child(3)').attr('href'),
        image: [
          $(b).find('picture > img').attr('data-src') || $(b).find('picture > img').attr('src'),
          $(b).find('picture > source:nth-child(1)').attr('srcset'),
          $(b).find('picture > source:nth-child(2)').attr('srcset')
        ].filter(Boolean)
      });
    }
  });

  return {
    pageUsed: randomPage,
    results: hasil
  };
}

// Endpoint GET Utama
router.get('/', async (req, res) => {
  const query = req.query.query;

  if (!query) {
    return res.status(400).json({
      status: false,
      error: "Missing 'q', 'query', or 'title' parameter"
    });
  }

  try {
    const data = await wallpaper(query);

    if (!data.results || data.results.length === 0) {
      return res.status(404).json({
        status: false,
        error: "Gambar tidak ditemukan untuk kata kunci tersebut."
      });
    }

    return res.json({
      status: true,
      query: query,
      page: data.pageUsed,
      total: data.results.length,
      data: data.results
    });

  } catch (error) {
    return res.status(error.response?.status || 500).json({
      status: false,
      error: error.message
    });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
