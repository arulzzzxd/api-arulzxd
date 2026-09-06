/**
 * ✦ Nama Scrape : Get Random Waifu Aoi
 * ✦ Author      : xyzan code (Anomaki Team) & ArulzXD
 * ✦ Deskripsi   : Mengambil daftar gambar acak waifu dari situs Aoi.live beserta judul dan jumlah like.
 */

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const router = express.Router();

async function aoirandom(jumlah = 1) {
  const url = 'https://aoi.live';
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const img = [];
    const judul = [];
    const like = [];

    $('img.post-image').each((index, element) => {
      const imags = $(element).attr('src');
      if (imags) {
        img.push(imags);
      }
    });

    $('div[data-v-3b96c720]').each((index, element) => {
      const title = $(element).text().trim();
      if (title) {
        judul.push(title);
      }
    });

    $('div.num-text').each((index, element) => {
      const jumlhlik = $(element).text().trim();
      if (jumlhlik) {
        like.push(jumlhlik);
      }
    });

    const randomimg = [];
    const judule = [];
    const jmlhlike = [];

    const totalToFetch = Math.min(jumlah, img.length);

    while (randomimg.length < totalToFetch && img.length > 0) {
      const ri = Math.floor(Math.random() * img.length);
      randomimg.push(img.splice(ri, 1)[0]);
      judule.push(judul.splice(ri, 1)[0]);
      jmlhlike.push(like.splice(ri, 1)[0]);
    }

    const results = randomimg.map((imgUrl, index) => ({
      image: imgUrl,
      title: judule[index] || 'No title',
      like: jmlhlike[index] || '0'
    }));

    return results;
  } catch (error) {
    console.error('Error fetching aoi random:', error.message);
    return [];
  }
}

router.get('/', async (req, res) => {
  try {
    const amount = parseInt(req.query.jumlah || req.query.count || '1', 10);
    const limit = Math.max(1, Math.min(amount, 20)); // Batasi maksimal 20 gambar per request

    const results = await aoirandom(limit);

    if (!results || results.length === 0) {
      return res.status(500).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Gagal mengambil data waifu dari Aoi.live.'
      });
    }

    return res.json({
      status: true,
      creator: 'ArulzXD',
      count: results.length,
      result: results
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message || 'Terjadi kesalahan saat memproses data.'
    });
  }
});

router.desc = "Mengambil data dan gambar Waifu acak dari Aoi.live.";
router.paramsConfig = {
  jumlah: "contoh: 5"
};
router.status = "ready";
router.type = "free";

module.exports = router;
