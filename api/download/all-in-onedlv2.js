/*
 * All-in-One Downloader (TikTok, Instagram, YouTube, Facebook, dll)
 * base      : vidssave.com
 * by   : febry.is-a.dev (please do not remove the wm, respect)
 * Date     : 25-07-2026
 */

const express = require('express');

const router = express.Router();

class VidsSave {
  constructor() {
    this.baseUrl = "https://api.vidssave.com/api/contentsite_api";
    this.auth = "20250901majwlqo";
    this.domain = "api-ak.vidssave.com";
  }

  async download(url) {
    if (!url) throw new Error("URL is required");

    const payload = new URLSearchParams({
      auth: this.auth,
      domain: this.domain,
      origin: "source",
      link: url
    });

    const res = await fetch(`${this.baseUrl}/media/parse`, {
      method: "POST",
      headers: {
        accept: "*/*",
        "accept-language": "id-ID",
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://vidssave.com",
        pragma: "no-cache",
        referer: "https://vidssave.com/",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36"
      },
      body: payload.toString()
    });

    const data = await res.json();
    return data?.data || data;
  }
}

const api = new VidsSave();

router.get('/', async (req, res) => {
  try {
    const targetUrl = req.query.url?.trim() || req.query.link?.trim() || req.query.q?.trim();

    if (!targetUrl) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Masukkan parameter url/link (contoh: ?url=https://www.tiktok.com/@user/video/123456789)'
      });
    }

    const result = await api.download(targetUrl);

    if (!result) {
      return res.status(404).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Gagal mengekstrak media dari URL yang diberikan.'
      });
    }

    return res.json({
      status: true,
      creator: 'ArulzXD',
      result: result
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message || 'Terjadi kesalahan pada server saat memproses unduhan.'
    });
  }
});

router.desc = "Pengunduh media All-in-One untuk mendownload video/foto dari YouTube, TikTok, Instagram, Facebook, Threads, Pinterest, dan platform sosial media lainnya.";
router.paramsConfig = {
  url: "text (wajib, URL video/media yang ingin diunduh)"
};
router.status = "ready";
router.type = "free";

module.exports = router;
