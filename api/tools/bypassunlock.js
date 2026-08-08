/**
 * NAMA SCRAPE  :: IMAGY SCREENSHOT (PUPPETEER)
 * [•] BASIS        :: imagy.app
 */

const express = require('express');
const puppeteer = require('puppeteer');
const router = express.Router();

async function scrapeImagyScreenshot(targetUrl) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Set User-Agent & Viewport agar tidak terdeteksi bot
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 720 });

    await page.goto('https://imagy.app/full-page-screenshot-taker/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Tunggu dan isi elemen input
    await page.waitForSelector('textarea, input[type="text"], input[type="url"]', { timeout: 10000 });
    const urlInput = await page.$('textarea, input[type="url"], input[type="text"]');
    
    if (urlInput) {
      await urlInput.click();
      await urlInput.type(targetUrl);
    }

    // Klik tombol submit/Take Screenshot
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await submitButton.click();
    }

    // Tunggu indikator hasil atau elemen gambar yang selesai di-generate
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Ambil URL hasil screenshot dari tag img / link download jika ada
    const resultUrl = await page.evaluate(() => {
      const img = document.querySelector('img[src*="screenshot"], img[src*="imagy"], .result-image img');
      const a = document.querySelector('a[href*="download"], a[href*=".png"], a[href*=".jpg"]');
      return img?.src || a?.href || null;
    });

    return resultUrl;
  } finally {
    if (browser) await browser.close();
  }
}

// Endpoint GET Utama
router.get('/', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).json({
      status: false,
      error: "Parameter 'url' tidak valid atau tidak ditemukan."
    });
  }

  try {
    const fileUrl = await scrapeImagyScreenshot(targetUrl);

    if (!fileUrl) {
      return res.status(500).json({
        status: false,
        error: "Gagal mengambil URL hasil screenshot."
      });
    }

    return res.json({
      status: true,
      data: {
        targetUrl,
        fileUrl
      }
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      error: err.message
    });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
