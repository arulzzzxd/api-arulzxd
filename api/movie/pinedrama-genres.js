const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const mongoose = require("mongoose");

const router = express.Router();

const cacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 }
});

const CacheModel = mongoose.models.Cache || mongoose.model('Cache', cacheSchema);

const BASE_URL = "https://pinedrama.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
}

function absUrl(url) {
  if (!url) return null;
  try { return new URL(url, BASE_URL).href; } catch { return url; }
}

function slugFromUrl(url) {
  if (!url) return null;
  return url.split("?")[0].replace(/\/$/, "").split("/").pop() || null;
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter(item => {
    const val = item[key];
    if (!val || seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}

async function fetchGenres() {
  const res = await axios.get(`${BASE_URL}/search`, {
    timeout: 15000,
    headers: { "accept": "text/html,*/*", "user-agent": UA }
  });

  const $ = cheerio.load(res.data);
  const items = [];

  $('a[href*="/genres/"], a[href*="/genre/"]').each((_, el) => {
    const a = $(el);
    const name = clean(a.text());
    const url = absUrl(a.attr("href"));

    if (!name || !url) return;
    if (name.match(/^\d+$/) || name === "..." || name.length > 30) return;

    items.push({
      name,
      slug: slugFromUrl(url),
      url
    });
  });

  return uniqueBy(items, "url");
}

router.get("/", async (req, res) => {
  try {
    const cacheKey = "pinedrama_hot_genres";

    try {
      const cachedDoc = await CacheModel.findOne({ key: cacheKey });
      if (cachedDoc) return res.json(cachedDoc.data);
    } catch (e) {}

    const genres = await fetchGenres();

    const responseData = {
      status: true,
      creator: "ArulzXD",
      updatedAt: new Date().toISOString(),
      result: {
        total: genres.length,
        genres
      }
    };

    try {
      await CacheModel.findOneAndUpdate(
        { key: cacheKey },
        { data: responseData, createdAt: new Date() },
        { upsert: true, new: true }
      );
    } catch (e) {}

    return res.json(responseData);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, creator: "ArulzXD", message: err.message });
  }
});

router.desc = "Mengambil daftar genre drama populer yang tersedia di PineDrama.";
router.status = "ready";
router.type = "free";

module.exports = router;