const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();

const BASE_URL = "https://www.tikwm.com";
const API_URL = `${BASE_URL}/api/feed/search`;

function randomUniqueId() {
  return `user_${crypto.randomBytes(6).toString("hex")}`;
}

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
  const uniqueId = randomUniqueId();

  const params = new URLSearchParams({
    unique_id: uniqueId,
    count: String(count),
    cursor: String(cursor),
    web: "1",
    hd: String(hd),
    keywords: searchQuery,
    url: "" 
  });

  try {
    const response = await axios.post(API_URL, params.toString(), {
      headers: {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "accept-language": "en-US,en;q=0.9,id;q=0.8",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "origin": BASE_URL,
        "priority": "u=1, i",
        "referer": `${BASE_URL}/`,
        "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "x-requested-with": "XMLHttpRequest"
      },
      timeout: 10000,
      validateStatus: () => true // Mencegah axios throw error jika status != 200
    });

    const json = response.data;

    // Jika response berupa HTML (Cloudflare challenge) atau bukan JSON
    if (typeof json !== "object" || json === null) {
      return res.status(503).json({
        status: false,
        code: response.status,
        input: { query: searchQuery, count, cursor, hd },
        result: [],
        error: "Terdeteksi proteksi Cloudflare (Challenge Page)",
        time_ms: Date.now() - started
      });
    }

    const videos = Array.isArray(json?.data?.videos) ? json.data.videos : [];
    const isOk = response.status === 200 && json.code === 0;

    return res.status(isOk ? 200 : 400).json({
      status: isOk,
      code: isOk ? 200 : json.code || response.status,
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
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
