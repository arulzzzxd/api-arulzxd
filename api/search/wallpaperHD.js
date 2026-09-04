const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

async function wallpaper(title, page = 1) {
  const url = `https://www.besthdwallpaper.com/search?CurrentPage=${page}&q=${encodeURIComponent(title)}`;
  
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    },
    timeout: 10000
  });

  const $ = cheerio.load(data);
  const hasil = [];

  $("div.grid-item").each(function (_, b) {
    const rawHref = $(b).find("div > a:nth-child(3)").attr("href") || $(b).find("div.info > a").attr("href") || "";
    const source = rawHref.startsWith("http")
      ? rawHref
      : `https://www.besthdwallpaper.com/${rawHref.replace(/^\/+/, "")}`;

    const imgSrc = $(b).find("picture > img").attr("data-src") || $(b).find("picture > img").attr("src") || "";
    const source1 = $(b).find("picture > source:nth-child(1)").attr("srcset") || "";
    const source2 = $(b).find("picture > source:nth-child(2)").attr("srcset") || "";

    const cleanUrl = (u) => (u ? (u.startsWith("http") ? u : u.startsWith("//") ? `https:${u}` : `https://www.besthdwallpaper.com/${u.replace(/^\/+/, "")}`) : null);

    const images = [cleanUrl(imgSrc), cleanUrl(source1), cleanUrl(source2)].filter(Boolean);

    hasil.push({
      title: $(b).find("div.info > a > h3").text().trim() || $(b).find("picture > img").attr("alt") || "Wallpaper",
      type: $(b).find("div.info > a:nth-child(2)").text().trim() || "General",
      source: source,
      image: [...new Set(images)]
    });
  });

  return hasil;
}

router.get("/", async (req, res) => {
  try {
    const text = req.query.text?.trim() || req.query.q?.trim();
    const page = parseInt(req.query.page) || 1;

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: "ArulzXD",
        message: "Masukkan parameter text atau q (contoh: ?text=anime)"
      });
    }

    const result = await wallpaper(text, page);

    return res.json({
      status: true,
      creator: "ArulzXD",
      query: text,
      page: page,
      total: result.length,
      result: result
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: err.message || "Terjadi kesalahan saat mengambil data wallpaper"
    });
  }
});

router.desc = "Mencari wallpaper Kualitas HD dari BestHDWallpaper berdasarkan kata kunci.";
router.paramsConfig = {
  text: "text",
  page: "number"
};
router.status = "ready";
router.type = "free";

module.exports = router;
