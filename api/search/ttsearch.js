const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const chromium = require("@sparticuz/chromium"); // 1. Tambahkan di bagian atas

puppeteer.use(StealthPlugin());

const router = express.Router();

async function scrapeTikTokSearch(keyword) {
  if (!keyword) throw new Error("Kata kunci pencarian kosong");

  let browser;
  try {
    // 2. Ganti puppeteer.launch lama dengan konfigurasi chromium ini:
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const searchUrl = `https://www.tiktok.com/search?q=${encodeURIComponent(keyword)}`;
    
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // Tunggu elemen daftar video muncul
    await page.waitForSelector('[data-e2e="search_top-item"]', { timeout: 15000 });

    // Gulir halaman ke bawah untuk memuat lebih banyak hasil
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight || totalHeight > 3000) {
            clearInterval(timer);
            resolve();
          }
        }, 300);
      });
    });

    // Ekstrak informasi detail video
    const results = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-e2e="search_top-item"]');
      const videoData = [];

      items.forEach((item) => {
        const linkElement = item.querySelector('a[href*="/video/"]');
        const descElement = item.querySelector('[data-e2e="search-card-desc"]') || 
                            item.querySelector('[data-e2e="search-card-video-caption"]');
        const authorElement = item.querySelector('[data-e2e="search-card-user-unique-id"]') ||
                              item.querySelector('[data-e2e="search-card-user-name"]');
        
        const viewsElement = item.querySelector('[data-e2e="video-views"]') || 
                             item.querySelector('[data-e2e="search-card-play-count"]') ||
                             item.querySelector('.video-count');

        const likesElement = item.querySelector('[data-e2e="search-card-like-count"]') ||
                             item.querySelector('[data-e2e="like-count"]');

        if (linkElement) {
          const descText = descElement ? descElement.innerText.trim() : "Tidak ada deskripsi";

          videoData.push({
            title: descText,
            description: descText,
            url: linkElement.href,
            author: authorElement ? authorElement.innerText.trim() : "Tidak diketahui",
            views: viewsElement ? viewsElement.innerText.trim() : "0",
            likes: likesElement ? likesElement.innerText.trim() : "0"
          });
        }
      });

      return videoData;
    });

    return results;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

router.get('/', async (req, res) => {
  try {
    const keyboards = (req.query.keyboards || req.query.keywords || req.query.q)?.trim();

    if (!keyboards) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Masukkan parameter keyboards (contoh: ?keyboards=resep masakan)'
      });
    }

    const data = await scrapeTikTokSearch(keyboards);

    if (!data || data.length === 0) {
      return res.status(404).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Tidak ada video yang ditemukan untuk kata kunci tersebut.'
      });
    }

    return res.json({
      status: true,
      creator: 'ArulzXD',
      result: data
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message || 'Terjadi kesalahan pada server saat memproses scraping.'
    });
  }
});

router.desc = "Scraper pencarian TikTok via Puppeteer Serverless";
router.paramsConfig = {
  keyboards: "keyboards: resep masakan"
};
router.status = "ready";
router.type = "free";

module.exports = router;
