const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();

const BASE_URL = "https://www.tikwm.com";
const API_URL = `${BASE_URL}/api/feed/search`;
const TURNSTILE_BYPASS_API = "https://api.ikyyxd.my.id/bypass/turnstile-cf-min";

// Sitekey Cloudflare Turnstile (jika diperlukan oleh target domain)
const TIKWM_SITEKEY = "0x4AAAAAAADn_6K7sP5RkM1v"; 

function randomUniqueId() {
  return `user_${crypto.randomBytes(6).toString("hex")}`;
}

function fullUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return BASE_URL + url;
}

/**
 * Mengambil token bypass dari API Turnstile
 */
async function getTurnstileToken(targetUrl, sitekey) {
  try {
    const res = await axios.get(TURNSTILE_BYPASS_API, {
      params: {
        url: targetUrl,
        sitekey: sitekey
      },
      timeout: 15000
    });

    return res.data?.token || res.data?.result?.token || res.data?.data || null;
  } catch (error) {
    console.error("Gagal mendapatkan token Turnstile:", error.message);
    return null;
  }
}

router.get("/", async (req, res) => {
  const searchQuery = (req.query.query || req.query.keyboards)?.trim();

  if (!searchQuery) {
    return res.status(400).json({ 
      status: false, 
      creator: "ArulzXD",
      error: "Missing required 'query' or 'keyboards' parameter" 
    });
  }

  const count = req.query.count || "12";
  const cursor = req.query.cursor || "0";
  const hd = req.query.hd || "1";

  const started = Date.now();
  const uniqueId = randomUniqueId();

  try {
    // 1. Dapatkan token Turnstile jika diperlukan
    const turnstileToken = await getTurnstileToken(BASE_URL, req.query.sitekey || TIKWM_SITEKEY);

    // 2. Susun payload request ke TikWM
    const params = new URLSearchParams({
      unique_id: uniqueId,
      count: String(count),
      cursor: String(cursor),
      web: "1",
      hd: String(hd),
      keywords: searchQuery,
      url: ""
    });

    if (turnstileToken) {
      params.append("cf-turnstile-response", turnstileToken);
    }

    // 3. Eksekusi request ke API TikWM
    const response = await axios.post(API_URL, params.toString(), {
      headers: {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "origin": BASE_URL,
        "referer": `${BASE_URL}/`,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "x-requested-with": "XMLHttpRequest"
      },
      timeout: 15000
    });

    const json = response.data;

    if (typeof json !== "object" || json === null) {
      return res.status(502).json({
        status: false,
        creator: "ArulzXD",
        code: 502,
        error: "Response dari server penampung bukan format JSON",
        time_ms: Date.now() - started
      });
    }

    const videos = Array.isArray(json?.data?.videos) ? json.data.videos : [];
    const isOk = response.status === 200 && json.code === 0;

    return res.status(isOk ? 200 : 400).json({
      status: isOk,
      creator: "ArulzXD",
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
      creator: "ArulzXD",
      code: 500,
      input: { query: searchQuery, count, cursor, hd },
      result: [],
      error: error.message,
      time_ms: Date.now() - started
    });
  }
});

router.desc = "Pencarian Video TikTok dengan Turnstile Bypass";
router.paramsConfig = {
  query: "query / keyboards: lamborghini"
};
router.status = "ready";
router.type = "free";

module.exports = router;
