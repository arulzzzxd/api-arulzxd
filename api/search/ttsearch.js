const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());
const router = express.Router();

const BASE_URL = "https://www.tikwm.com";

function fullUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return BASE_URL + url;
}

router.get("/", async (req, res) => {
  const searchQuery = req.query.query;

  if (!searchQuery) {
    return res.status(400).json({ 
      status: false, 
      error: "Missing required 'query' parameter" 
    });
  }

  const count = req.query.count || "12";
  const cursor = req.query.cursor || "0";
  const hd = req.query.hd || "1";

  const started = Date.now();
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Tembak API langsung dari dalam browser yang sudah lolos Cloudflare
    const json = await page.evaluate(async (query, count, cursor, hd) => {
      const body = new URLSearchParams({
        unique_id: `user_${Math.random().toString(36).substring(2, 10)}`,
        count: String(count),
        cursor: String(cursor),
        web: "1",
        hd: String(hd),
        keywords: query,
        url: ""
      });

      const response = await fetch("https://www.tikwm.com/api/feed/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest"
        },
        body
      });

      return await response.json();
    }, searchQuery, count, cursor, hd);

    const videos = Array.isArray(json?.data?.videos) ? json.data.videos : [];
    const isOk = json?.code === 0;

    return res.status(isOk ? 200 : 400).json({
      status: isOk,
      code: isOk ? 200 : json.code || 400,
      input: {
        query: searchQuery,
        count: parseInt(count),
        cursor: parseInt(cursor),
        hd: parseInt(hd)
      },
      total: videos.length,
      cursor: json?.data?.cursor ?? null,
      has_more: json?.data?.hasMore ?? false,
      result: videos.map((item) => ({
        id: item.video_id || item.id || null,
        title: item.title || null,
        author: item.author?.nickname || item.author?.unique_id || null,
        duration: item.duration || 0,
        play: fullUrl(item.play),
        wmplay: fullUrl(item.wmplay),
        music: fullUrl(item.music),
        cover: fullUrl(item.cover),
        stats: {
          play: item.play_count || 0,
          like: item.digg_count || 0,
          comment: item.comment_count || 0,
          share: item.share_count || 0,
          download: item.download_count || 0
        }
      })),
      time_ms: Date.now() - started
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      code: 500,
      input: { query: searchQuery, count, cursor, hd },
      result: [],
      error: error.message,
      time_ms: Date.now() - started
    });
  } finally {
    if (browser) await browser.close();
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
