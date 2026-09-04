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

function formatDramaItem(item) {
  const title = item.title || item.name || item.dramaName || "";
  const slug = item.slug || item.id || slugFromUrl(item.url);
  const url = item.url ? absUrl(item.url) : (slug ? `${BASE_URL}/dramas/${slug}` : null);
  const image = item.cover || item.image || item.poster || item.coverUrl || item.thumbnail;

  if (!title || !url) return null;

  return {
    section: "Search Results",
    title: clean(title),
    slug: String(slug),
    url,
    image: absUrl(image),
    genre: item.genre || (Array.isArray(item.genres) ? item.genres[0]?.name || item.genres[0] : null) || null,
    rating: item.rating ? String(item.rating) : null
  };
}

async function fetchFromApi(query) {
  try {
    const res = await axios.get(`${BASE_URL}/api/dramas/search?q=${encodeURIComponent(query)}`, {
      timeout: 10000,
      headers: {
        "accept": "application/json, text/plain, */*",
        "referer": `${BASE_URL}/search?q=${encodeURIComponent(query)}`,
        "user-agent": UA
      }
    });

    if (res.status === 200 && res.data) {
      const rawData = Array.isArray(res.data) ? res.data : (res.data.dramas || res.data.results || res.data.data || []);
      const items = rawData.map(formatDramaItem).filter(Boolean);
      return uniqueBy(items, "url");
    }
  } catch (err) {}
  return null;
}

async function fetchSearchHtml(query) {
  const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;
  const res = await axios.get(searchUrl, {
    timeout: 15000,
    headers: { "accept": "text/html,*/*", "user-agent": UA }
  });

  const $ = cheerio.load(res.data);
  const items = [];

  $('a[href*="/dramas/"], a[href*="/drama/"]').each((_, el) => {
    const link = $(el);
    const url = absUrl(link.attr("href"));
    if (!url || url.includes("/ep") || url.includes("/watch")) return;

    const container = link.closest("div, article, li");
    const img = container.find("img").first();
    const title = clean(link.text()) || clean(img.attr("alt"));

    if (!title) return;

    const formatted = formatDramaItem({
      title,
      url,
      image: absUrl(img.attr("src") || img.attr("data-src")),
      genre: clean(container.find('a[href*="/genres/"]').first().text()) || null
    });

    if (formatted) items.push(formatted);
  });

  return { url: searchUrl, items: uniqueBy(items, "url") };
}

router.get("/", async (req, res) => {
  try {
    const query = req.query.text?.trim() || req.query.q?.trim() || "CEO";
    const cacheKey = `pinedrama_search_${query.toLowerCase()}`;

    try {
      const cachedDoc = await CacheModel.findOne({ key: cacheKey });
      if (cachedDoc) return res.json(cachedDoc.data);
    } catch (e) {}

    let apiItems = await fetchFromApi(query);
    let targetUrl = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;

    if (!apiItems || apiItems.length === 0) {
      const htmlResult = await fetchSearchHtml(query);
      apiItems = htmlResult.items;
      targetUrl = htmlResult.url;
    }

    const responseData = {
      status: true,
      creator: "ArulzXD",
      query,
      input: targetUrl,
      updatedAt: new Date().toISOString(),
      result: {
        total: apiItems.length,
        items: apiItems
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

router.desc = "Mencari daftar drama di PineDrama berdasarkan kata kunci.";
router.paramsConfig = { text: "text (contoh: CEO)" };
router.status = "ready";
router.type = "free";

module.exports = router;