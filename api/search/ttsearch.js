const express = require("express");
const axios = require("axios");

const router = express.Router();

const TARGET_URL = "https://tikwm.com/api/feed/search";
const CORS_KEY = "509fdaae";

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

  // Format URL CorsProxy dengan API key
  const proxyParams = new URLSearchParams({
    key: CORS_KEY,
    url: TARGET_URL
  });
  const proxyUrl = `https://corsproxy.io/?${proxyParams.toString()}`;

  // Body payload untuk TikWM
  const body = new URLSearchParams({
    keywords,
    count: "12",
    cursor: "0",
    web: "1",
    hd: "1"
  });

  const response = await axios.post(proxyUrl, body.toString(), {
    headers: {
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest"
    },
    timeout: 15000
  });

  const json = response.data;

  if (typeof json !== "object" || json === null) {
    throw new Error("Response dari proxy bukan format JSON yang valid");
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
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message || 'Terjadi kesalahan pada server saat memproses pencarian.'
    });
  }
});

router.desc = "Pencarian video TikTok via CorsProxy Key & TikWM API";
router.paramsConfig = {
  keyboards: "keyboards: resep mendoan"
};
router.status = "error";
router.type = "free";

module.exports = router;
