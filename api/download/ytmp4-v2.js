const express = require("express");
const router = express.Router();
const axios = require("axios");
const cheerio = require("cheerio");

/**
 * Fungsi helper untuk scraping data dari yt-mp4.net
 * @param {string} targetUrl - URL video YouTube
 */
async function scrapeYtMp4(targetUrl) {
  const baseUrl = "https://yt-mp4.net";

  // 1. Mengirim permintaan POST ke layanan konversi yt-mp4.net
  const response = await axios.post(
    `${baseUrl}/api/ajaxSearch`,
    new URLSearchParams({
      q: targetUrl,
      vt: "mp4"
    }),
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": `${baseUrl}/`,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      },
      timeout: 10000
    }
  );

  const html = response.data?.data || response.data;
  if (!html) throw new Error("Gagal mengambil data dari penyedia.");

  const $ = cheerio.load(html);

  // 2. Parsing informasi umum video
  const title = $(".caption b, .title, h3").first().text().trim() || "Tidak ada judul";
  const duration = $(".duration, .time, p:contains('Duration')").first().text().replace(/Duration:\s*/i, "").trim() || "N/A";
  const thumbnail = $(".img-thumbnail, img").attr("src") || "";

  // 3. Parsing daftar opsi kualitas & link unduhan
  const downloads = [];

  $("table tbody tr, .download-item").each((_, el) => {
    const quality = $(el).find("td:nth-child(1), .quality").text().trim();
    const size = $(el).find("td:nth-child(2), .size").text().trim();
    const downloadLink = $(el).find("a[href]").attr("href");

    if (quality && downloadLink) {
      downloads.push({
        quality: quality.replace(/\s+/g, " "),
        size: size || "N/A",
        url: downloadLink.startsWith("http") ? downloadLink : `${baseUrl}${downloadLink}`
      });
    }
  });

  return {
    title,
    duration,
    thumbnail,
    downloads
  };
}

// ENDPOINT ROUTER
router.get("/", async (req, res) => {
  try {
    const { url, quality = "720" } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        creator: "ArulzXD",
        message: "Parameter url diperlukan."
      });
    }

    // Panggil fungsi scraper
    const scrapedData = await scrapeYtMp4(url);

    // Filter berdasarkan parameter quality (opsional, jika opsi spesifik ditemukan)
    let selectedQuality = scrapedData.downloads.find((item) =>
      item.quality.toLowerCase().includes(quality.toLowerCase())
    );

    res.json({
      status: true,
      creator: "ArulzXD",
      result: {
        title: scrapedData.title,
        duration: scrapedData.duration,
        thumbnail: scrapedData.thumbnail,
        selected_quality: selectedQuality || null,
        media: scrapedData.downloads
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