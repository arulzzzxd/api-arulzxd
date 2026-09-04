const express = require("express");
const router = express.Router();
const axios = require("axios");

const videoQuality = ["1080", "720", "480", "360", "144"];

// Fungsi pembantu khusus scraper ytmp4
async function ytmp4Scraper(url, format) {
  if (!videoQuality.includes(format)) {
    throw new Error(`Kualitas video tidak valid. Pilih salah satu: ${videoQuality.join(", ")}`);
  }

  const params = {
    copyright: "0",
    format: format,
    url: url,
    api: "dfcb6d76f2f6a9894gjkege8a4ab232222"
  };

  const { data: metadata } = await axios.get(
    "https://p.lbserver.xyz/ajax/download.php",
    { params }
  );

  if (!metadata || !metadata.progress_url) {
    throw new Error("Gagal mengambil metadata video dari server.");
  }

  let progress = 0;
  let json;

  return await new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const res = await axios.get(metadata.progress_url);
        json = res.data;
        progress = json?.progress || progress;

        if (progress >= 1000) {
          return resolve({
            title: metadata.title,
            quality: format,
            image: metadata.info?.image || "",
            download: json.download_url,
            alternatif: json.alternative_download_urls || []
          });
        }
      } catch (err) {
        return reject(new Error("Gagal memproses progress unduhan: " + err.message));
      }

      setTimeout(poll, 40);
    };

    poll();
  });
}

router.get("/", async (req, res) => {
  try {
    const url = req.query.url;
    const quality = req.query.quality || '720';

    if (!url) {
      return res.status(400).json({
        status: false,
        creator: "ArulzXD",
        message: "Parameter url diperlukan."
      });
    }

    // Panggil API scraper ytmp4
    const result = await ytmp4Scraper(url, quality);

    res.json({
      status: true,
      creator: "ArulzXD",
      result
    });

  } catch (err) {
    res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: err.message
    });
  }
});

router.paramsConfig = {
  url: "text",
  quality: {
    type: "select",
    options: ["1080", "720", "480", "360", "144"]
  }
};

router.status = "ready";
router.type = "free";
module.exports = router;
