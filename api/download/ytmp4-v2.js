const express = require("express");
const router = express.Router();
const axios = require("axios");

/**
 * Helper function untuk mengekstrak Video ID dari URL YouTube
 */
function getYouTubeVideoId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

/**
 * Scraping helper untuk media.ytmp3.gg
 * @param {string} targetUrl - URL Video YouTube
 */
async function scrapeYtmp3Gg(targetUrl) {
  const videoId = getYouTubeVideoId(targetUrl);
  if (!videoId) {
    throw new Error("URL YouTube tidak valid.");
  }

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://media.ytmp3.gg/",
    "Origin": "https://media.ytmp3.gg"
  };

  // 1. Inisialisasi permintaan konversi MP4
  const initResponse = await axios.get(`https://api.ytmp3.gg/v2/convert`, {
    params: {
      v: videoId,
      f: "mp4",
      q: "360p"
    },
    headers,
    timeout: 10000
  });

  if (!initResponse.data || initResponse.data.error) {
    throw new Error(initResponse.data?.message || "Gagal menginisialisasi konversi.");
  }

  const taskData = initResponse.data;
  
  // Jika link download langsung tersedia
  if (taskData.url) {
    return {
      title: taskData.title || "YouTube Video",
      duration: taskData.duration || "N/A",
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      quality: taskData.quality || "360p",
      downloadUrl: taskData.url
    };
  }

  // 2. Polling progress jika proses konversi masuk ke antrean (queue/progress)
  const jobId = taskData.id || taskData.jobId;
  if (!jobId) {
    throw new Error("Tidak mendapat ID konversi dari server.");
  }

  let downloadUrl = null;
  let attempts = 0;
  const maxAttempts = 10;

  while (!downloadUrl && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Delay 1.5 detik per hit

    const statusResponse = await axios.get(`https://api.ytmp3.gg/v2/status`, {
      params: { id: jobId },
      headers,
      timeout: 10000
    });

    if (statusResponse.data && statusResponse.data.url) {
      downloadUrl = statusResponse.data.url;
      break;
    }

    if (statusResponse.data?.status === "failed") {
      throw new Error("Proses konversi gagal di sisi server penyedia.");
    }

    attempts++;
  }

  if (!downloadUrl) {
    throw new Error("Waktu konversi habis (Timeout). Silakan coba lagi.");
  }

  return {
    title: taskData.title || "YouTube Video",
    duration: taskData.duration || "N/A",
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    quality: "360p",
    downloadUrl
  };
}

// ENDPOINT ROUTER
router.get("/", async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({
        status: false,
        creator: "ArulzXD",
        message: "Parameter url diperlukan."
      });
    }

    // Panggil fungsi scraper
    const scrapedData = await scrapeYtmp3Gg(url);

    res.json({
      status: true,
      creator: "ArulzXD",
      result: {
        title: scrapedData.title,
        duration: scrapedData.duration,
        thumbnail: scrapedData.thumbnail,
        selected_quality: {
          quality: scrapedData.quality,
          url: scrapedData.downloadUrl
        },
        media: [
          {
            quality: scrapedData.quality,
            url: scrapedData.downloadUrl
          }
        ]
      }
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: err.message || "Terjadi kesalahan saat memproses request."
    });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;