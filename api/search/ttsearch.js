const express = require("express");
const axios = require("axios");

const router = express.Router();

// Gunakan URL tanpa 'www' untuk mengurangi pemicu Cloudflare Challenge
const API_URL = "https://tikwm.com/api/feed/search";

function fullUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://tikwm.com${url}`;
}

function formatCount(num) {
  if (!num || isNaN(num)) return "0";
  return Number(num).toLocaleString("id-ID");
}

async function tikwmSearch(keywords) {
  if (!keywords) throw new Error("Kata kunci pencarian kosong");

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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest",
      "Origin": "https://tikwm.com",
      "Referer": "https://tikwm.com/",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "Sec-Ch-Ua": '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin"
    },
    timeout: 10000
  });

  const json = response.data;

  if (typeof json !== "object" || json === null) {
    throw new Error("Layanan TikWM sedang terproteksi Cloudflare. Coba lagi nanti.");
  }

  if (json.code !== 0) {
    throw new Error(json.msg || `Gagal mengambil data (Code: ${json.code})`);
  }

  const videos = Array.isArray(json?.data?.videos) ? json.data.videos : [];

  return videos.map((item) => {
    const titleText = item.title || "Tidak ada deskripsi";
    return {
      title: titleText,
      description: titleText,
      url: fullUrl(item.play),
      wmplay: fullUrl(item.wmplay),
      music: fullUrl(item.music),
      cover: fullUrl(item.cover),
      author: item.author?.nickname || item.author?.unique_id || "Tidak diketahui",
      views: formatCount(item.play_count),
      likes: formatCount(item.digg_count),
      comments: formatCount(item.comment_count),
      shares: formatCount(item.share_count)
    };
  });
}

router.get('/', async (req, res) => {
  try {
    const keyboards = (req.query.keyboards || req.query.keywords || req.query.q)?.trim();

    if (!keyboards) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Masukkan parameter keyboards (contoh: ?keyboards=resep mendoan)'
      });
    }

    const data = await tikwmSearch(keyboards);

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
    console.error("TikTok Search Error:", err.message);
    const isCloudflare = err.response?.status === 403;
    return res.status(isCloudflare ? 503 : 500).json({
      status: false,
      creator: 'ArulzXD',
      message: isCloudflare 
        ? 'Akses ke TikWM diblokir oleh Cloudflare WAF Vercel. Silakan coba beberapa saat lagi.' 
        : (err.message || 'Terjadi kesalahan pada server saat memproses pencarian.')
    });
  }
});

router.desc = "Pencarian video TikTok via TikWM API";
router.paramsConfig = {
  keyboards: "keyboards: resep mendoan"
};
router.status = "ready";
router.type = "free";

module.exports = router;
