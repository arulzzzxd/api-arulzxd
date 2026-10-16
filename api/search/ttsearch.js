const express = require("express");
const axios = require("axios");

const router = express.Router();

const BASE_URL = "https://www.tikwm.com";
const API_URL = `${BASE_URL}/api/feed/search`;

function fullUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return BASE_URL + url;
}

async function tikwmSearch(keywords) {
  if (!keywords) throw new Error("Kata kunci pencarian kosong");

  const started = Date.now();

  const body = new URLSearchParams({
    keywords,
    count: "12",
    cursor: "0",
    web: "1",
    hd: "1"
  });

  const response = await axios.post(API_URL, body.toString(), {
    headers: {
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0",
      "X-Requested-With": "XMLHttpRequest",
      "Origin": BASE_URL,
      "Referer": `${BASE_URL}/`
    },
    timeout: 15000
  });

  const json = response.data;
  if (typeof json !== "object" || json === null) {
    throw new Error("Response dari TikWM bukan format JSON yang valid");
  }

  if (json.code !== 0) {
    throw new Error(json.msg || `Gagal mengambil data (Code: ${json.code})`);
  }

  const videos = Array.isArray(json?.data?.videos) ? json.data.videos : [];

  return {
    input: keywords,
    total: videos.length,
    cursor: json?.data?.cursor ?? null,
    hasMore: json?.data?.hasMore ?? false,
    videos: videos.map((item) => ({
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
    timeMs: Date.now() - started
  };
}

router.get('/', async (req, res) => {
  try {
    const keywords = (req.query.keyboards || req.query.keywords)?.trim();

    if (!keywords) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Masukkan parameter keyboards (contoh: ?keyboards=lamborghini)'
      });
    }

    const data = await tikwmSearch(keywords);

    if (!data || data.videos.length === 0) {
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
      message: err.message || 'Terjadi kesalahan pada server saat memproses pencarian.'
    });
  }
});

router.desc = "Pencarian video TikTok";
router.paramsConfig = {
  keyboards: "keyboards: lamborghini"
};
router.status = "ready";
router.type = "free";

module.exports = router;
