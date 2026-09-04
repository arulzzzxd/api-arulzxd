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

async function fetchSections() {
  const res = await axios.get(`${BASE_URL}/`, {
    timeout: 15000,
    headers: { "accept": "text/html,*/*", "user-agent": UA }
  });

  const $ = cheerio.load(res.data);
  const sections = [];

  $("h2, h3, .section-title").each((_, heading) => {
    const title = clean($(heading).text());
    if (!title) return;

    const area = $(heading).parent().parent();
    const items = [];

    area.find('a[href*="/dramas/"], a[href*="/drama/"]').each((__, a) => {
      const link = $(a);
      const url = absUrl(link.attr("href"));
      if (!url || url.includes("/ep") || url.includes("/watch")) return;

      const card = link.closest("div, article, li");
      const img = card.find("img").first();
      const itemTitle = clean(link.text()) || clean(img.attr("alt"));

      if (itemTitle) {
        items.push({
          section: title,
          title: itemTitle,
          slug: slugFromUrl(url),
          url,
          image: absUrl(img.attr("src") || img.attr("data-src"))
        });
      }
    });

    const unique = uniqueBy(items, "url");
    if (unique.length > 0) {
      sections.push({
        name: title,
        total: unique.length,
        items: unique
      });
    }
  });

  return uniqueBy(sections, "name");
}

router.get("/", async (req, res) => {
  try {
    const cacheKey = "pinedrama_recommendations";

    try {
      const cachedDoc = await CacheModel.findOne({ key: cacheKey });
      if (cachedDoc) return res.json(cachedDoc.data);
    } catch (e) {}

    const sections = await fetchSections();

    const responseData = {
      status: true,
      creator: "ArulzXD",
      updatedAt: new Date().toISOString(),
      result: {
        totalSections: sections.length,
        sections
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

router.desc = "Mengambil rekomendasi & seksi short drama terbaru di beranda PineDrama.";
router.status = "ready";
router.type = "free";

module.exports = router;