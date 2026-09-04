const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const mongoose = require("mongoose");

const router = express.Router();

// Schema dan Model Cache MongoDB (TTL 60 detik)
const cacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 }
});

const CacheModel = mongoose.models.Cache || mongoose.model('Cache', cacheSchema);

const BASE_URL = "https://pinedrama.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function clean(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function absUrl(url) {
  if (!url) return null;
  try {
    return new URL(url, BASE_URL).href;
  } catch {
    return url;
  }
}

function slugFromUrl(url) {
  if (!url) return null;
  const cleanUrl = url.split("?")[0].replace(/\/$/, "");
  return cleanUrl.split("/").pop() || null;
}

function uniqueBy(items, key) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const value = item[key];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(item);
  }

  return result;
}

// Format item agar seragam
function formatDramaItem(item, defaultSection = "Search Results") {
  const title = item.title || item.name || item.dramaName || "";
  const slug = item.slug || item.id || slugFromUrl(item.url);
  const url = item.url ? absUrl(item.url) : (slug ? `${BASE_URL}/dramas/${slug}` : null);
  const image = item.cover || item.image || item.poster || item.coverUrl || item.thumbnail;

  if (!title || !url) return null;

  return {
    section: defaultSection,
    title: clean(title),
    slug: String(slug),
    url,
    image: absUrl(image),
    genre: item.genre || (Array.isArray(item.genres) ? item.genres[0]?.name || item.genres[0] : null) || null,
    rating: item.rating ? String(item.rating) : null
  };
}

// 1. Coba Ambil Data via Internal API PineDrama
async function fetchFromApi(query) {
  const searchApiUrl = `${BASE_URL}/api/dramas/search?q=${encodeURIComponent(query)}`;
  
  try {
    const res = await axios.get(searchApiUrl, {
      timeout: 10000,
      headers: {
        "accept": "application/json, text/plain, */*",
        "referer": `${BASE_URL}/search?q=${encodeURIComponent(query)}`,
        "user-agent": UA
      }
    });

    if (res.status === 200 && res.data) {
      const rawData = Array.isArray(res.data) 
        ? res.data 
        : (res.data.dramas || res.data.results || res.data.data || []);

      const items = rawData
        .map(item => formatDramaItem(item, "Search Results"))
        .filter(Boolean);

      return uniqueBy(items, "url");
    }
  } catch (err) {
    // Silently fail to fallback HTML scraper
  }
  return null;
}

// 2. Scraper Halaman HTML (Fallback)
async function fetchSearchHtml(query) {
  const searchUrl = query 
    ? `${BASE_URL}/search?q=${encodeURIComponent(query)}` 
    : `${BASE_URL}/search`;

  const res = await axios.get(searchUrl, {
    timeout: 15000,
    validateStatus: () => true,
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "referer": `${BASE_URL}/`,
      "user-agent": UA
    }
  });

  if (res.status !== 200) {
    throw new Error(`Gagal membuka search: HTTP ${res.status}`);
  }

  return { url: searchUrl, html: res.data };
}

function parseNextDataHtml(html) {
  try {
    const $ = cheerio.load(html);
    
    // Check Next.js script tag
    const script = $("#__NEXT_DATA__").html();
    if (script) {
      const jsonData = JSON.parse(script);
      const props = jsonData?.props?.pageProps;
      const rawList = props?.dramas || props?.searchResults || props?.searchResultsData || props?.data || [];

      if (Array.isArray(rawList) && rawList.length > 0) {
        return rawList.map(item => formatDramaItem(item, "Search Results")).filter(Boolean);
      }
    }

    // Check inline script state JSON (jika Next.js App Router / RSC)
    let matchedItems = [];
    $("script").each((_, el) => {
      const content = $(el).html() || "";
      if (content.includes("dramas") || content.includes("searchResults")) {
        const matches = content.match(/\{"id":.*?"title":.*?\}/g);
        if (matches) {
          matches.forEach(jsonStr => {
            try {
              const obj = JSON.parse(jsonStr);
              const formatted = formatDramaItem(obj, "Search Results");
              if (formatted) matchedItems.push(formatted);
            } catch (e) {}
          });
        }
      }
    });

    return matchedItems.length > 0 ? matchedItems : null;
  } catch (err) {
    return null;
  }
}

function parseMainSearchResults($, html) {
  // Coba Next.js parser terlebih dahulu
  const nextItems = parseNextDataHtml(html);
  if (nextItems && nextItems.length > 0) {
    const unique = uniqueBy(nextItems, "url");
    return { title: "Search Results", total: unique.length, items: unique };
  }

  // Fallback: DOM Parsing Selector
  const items = [];

  $('a[href*="/dramas/"], a[href*="/drama/"]').each((_, el) => {
    const link = $(el);
    const url = absUrl(link.attr("href"));
    
    if (!url || url.includes("/ep") || url.includes("/watch")) return;

    const container = link.closest("div, article, li, card");
    const img = container.find("img").first();
    const title = clean(link.text()) || clean(img.attr("alt")) || clean(container.find("h2, h3, h4, p, span").first().text());

    if (!title || title.length < 2) return;

    const image = absUrl(img.attr("src") || img.attr("data-src") || img.attr("srcset"));
    const genreLink = container.find('a[href*="/genres/"]').first();

    const formatted = formatDramaItem({
      title,
      url,
      image,
      genre: clean(genreLink.text()) || null
    }, "Search Results");

    if (formatted) items.push(formatted);
  });

  const uniqueItems = uniqueBy(items, "url");

  return {
    title: "Search Results",
    total: uniqueItems.length,
    items: uniqueItems
  };
}

function parseHotGenres($) {
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

function parseSections($) {
  const sections = [];

  $("h2, h3, .section-title").each((_, heading) => {
    const title = clean($(heading).text());
    if (!title || title.toLowerCase().includes("search")) return;

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
        const formatted = formatDramaItem({
          title: itemTitle,
          url,
          image: absUrl(img.attr("src") || img.attr("data-src"))
        }, title);

        if (formatted) items.push(formatted);
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

function compareUpdates(oldData, newData) {
  const oldItems = oldData?.result?.all || [];
  const newItems = newData?.result?.all || [];

  const oldSlugs = new Set(oldItems.map(item => item.slug).filter(Boolean));
  const newItemsOnly = newItems.filter(item => item.slug && !oldSlugs.has(item.slug));

  const bySection = {};

  for (const item of newItemsOnly) {
    const key = item.section || "Search";
    if (!bySection[key]) bySection[key] = [];
    bySection[key].push(item);
  }

  return {
    hasUpdate: newItemsOnly.length > 0,
    totalNew: newItemsOnly.length,
    newItems: newItemsOnly,
    newBySection: bySection
  };
}

router.get("/", async (req, res) => {
  try {
    const query = req.query.text?.trim() || req.query.q?.trim() || "Romance";
    const cacheKey = `pinedrama_search_${query.toLowerCase()}`;

    // 1. Ambil cache lama dari MongoDB
    let oldCacheDoc = null;
    try {
      oldCacheDoc = await CacheModel.findOne({ key: cacheKey });
    } catch (e) {
      console.warn("[MongoDB Cache Warning]: Gagal membaca cache", e.message);
    }

    let searchResult = { title: "Search Results", total: 0, items: [] };
    let sections = [];
    let hotGenres = [];
    let targetUrl = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;

    // 2. Percobaan A: Ambil langsung dari Internal API PineDrama
    const apiItems = await fetchFromApi(query);

    if (apiItems && apiItems.length > 0) {
      searchResult = {
        title: "Search Results",
        total: apiItems.length,
        items: apiItems
      };
    } else {
      // 3. Percobaan B: Fallback Scraping Halaman Web
      const { url, html } = await fetchSearchHtml(query);
      targetUrl = url;
      const $ = cheerio.load(html);

      searchResult = parseMainSearchResults($, html);
      sections = parseSections($);
      hotGenres = parseHotGenres($);
    }

    const all = uniqueBy([...searchResult.items, ...sections.flatMap(s => s.items)], "url");

    const responseData = {
      status: true,
      creator: "ArulzXD",
      query,
      input: targetUrl,
      updatedAt: new Date().toISOString(),
      result: {
        search: searchResult,
        hotGenres,
        sections,
        all
      }
    };

    // 4. Bandingkan pembaruan data
    responseData.update = compareUpdates(oldCacheDoc?.data, responseData);

    // 5. Simpan/Update cache di MongoDB
    try {
      await CacheModel.findOneAndUpdate(
        { key: cacheKey },
        { data: responseData, createdAt: new Date() },
        { upsert: true, new: true }
      );
    } catch (e) {
      console.warn("[MongoDB Cache Warning]: Gagal memperbarui cache", e.message);
    }

    return res.json(responseData);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: err.message
    });
  }
});

router.desc = "Mencari drama, genre populer, dan rekomendasi short drama dari PineDrama berdasarkan kata kunci dengan MongoDB TTL Caching.";
router.paramsConfig = {
  text: "text (contoh: CEO)"
};
router.status = "ready";
router.type = "free";

module.exports = router;
