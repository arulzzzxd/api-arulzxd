/**
 * NAMA SCRAPE  :: TIKWM PHOTO SEARCH
 * [•] BASIS        :: tikwm.com
 * [•] CONVERTED    :: Express Router API
 */

const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const BASE_URL = "https://www.tikwm.com";
const API_URL = `${BASE_URL}/api/photo/search`;

function randomUniqueId() {
  return `user_${crypto.randomBytes(6).toString("hex")}`;
}

function fullUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return BASE_URL + url;
}

// Endpoint GET Utama
router.get("/", async (req, res) => {
  // Menggunakan parameter 'query' sebagai pengganti 'keywords'
  const searchQuery = req.query.query;
  
  // Validasi input parameter query wajib ada
  if (!searchQuery) {
    return res.status(400).json({ 
      status: false, 
      error: "Missing required 'query' parameter" 
    });
  }

  // Pengaturan default opsional untuk pagination & kualitas gambar
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
    keywords: searchQuery, // Dipasangkan ke payload internal TikWM
    url: "" 
  });

  const headers = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    Origin: BASE_URL,
    Referer: `${BASE_URL}/`
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers,
      body: params
    });

    const text = await response.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    if (!json) {
      return res.status(response.status || 502).json({
        status: false,
        code: response.status,
        input: { query: searchQuery, count, cursor, hd },
        result: [],
        error: "Response dari server penampung bukan format JSON",
        preview: text.slice(0, 300),
        time_ms: Date.now() - started
      });
    }

    const videos = Array.isArray(json?.data?.videos) ? json.data.videos : [];
    const isOk = response.ok && json.code === 0;

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
        cover: fullUrl(item.cover),
        music: fullUrl(item.music),
        images_total: Array.isArray(item.images) ? item.images.length : 0,
        images: Array.isArray(item.images) ? item.images : [],
        stats: {
          play: item.play_count || 0,
          like: item.digg_count || 0,
          comment: item.comment_count || 0,
          share: item.share_count || 0
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
