const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const mongoose = require("mongoose");

const router = express.Router();

// Schema dan Model Cache MongoDB
const cacheSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now, expires: 60 } 
});

const CacheModel = mongoose.models.Cache || mongoose.model('Cache', cacheSchema);

const BASE_URL = "https://pinedrama.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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

async function fetchSearch(query) {
  const searchUrl = query 
    ? `${BASE_URL}/search?q=${encodeURIComponent(query)}` 
    : `${BASE_URL}/search`;

  const res = await axios.get(searchUrl, {
    timeout: 30000,
    validateStatus: () => true,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9,id;q=0.8",
      referer: `${BASE_URL}/search`,
      "user-agent": UA
    }
  });

  if (res.status !== 200) {
    throw new Error(`Gagal membuka search: HTTP ${res.status}`);
  }

  return {
    url: searchUrl,
    html: res.data
  };
}

function parseNextDataHtml(html) {
  try {
    const $ = cheerio.load(html);
    const script = $("#__NEXT_DATA__").html();
    if (!script) return null;

    const jsonData = JSON.parse(script);
    const props = jsonData?.props?.pageProps;

    if (!props) return null;

    const items = [];
    const rawList = props.dramas || props.searchResults || props.searchResultsData || props.data || [];

    if (Array.isArray(rawList) && rawList.length > 0) {
      for (const item of rawList) {
        const title = item.title || item.name;
        const slug = item.slug || item.id;
        const url = slug ? `${BASE_URL}/dramas/${slug}` : null;
        if (title && url) {
          items.push({
            section: "Search Results",
            title: clean(title),
            slug,
            url,
            image: absUrl(item.cover || item.image || item.poster),
            genre: item.genre || item.genres?.[0]?.name || null,
            rating: item.rating ? String(item.rating) : null
          });
        }
      }
    }

    return items.length > 0 ? items : null;
  } catch (err) {
    return null;
  }
}

function parseMainSearchResults($, html) {
  const nextItems = parseNextDataHtml(html);
  if (nextItems && nextItems.length > 0) {
    const unique = uniqueBy(nextItems, "url");
    return {
      title: "Search Results",
      total: unique.length,
      items: unique
    };
  }

  const items = [];

  $('a[href*="/dramas/"]').each((_, el) => {
    const link = $(el);
    const url = absUrl(link.attr("href"));
    
    if (!url || url.includes("/ep")) return;

    const container = link.closest("div, article, li");
    const img = container.find("img").first();
    const title = clean(link.text()) || clean(img.attr("alt")) || clean(container.find("h2, h3, h4, p").first().text());

    if (!title || title.length < 2) return;

    const image = absUrl(img.attr("src") || img.attr("data-src"));
    const genreLink = container.find('a[href*="/genres/"]').first();
    const genre = clean(genreLink.text()) || null;

    items.push({
      section: "Search Results",
      title,
      slug: slugFromUrl(url),
      url,
      image,
      genre,
      rating: null
    });
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

  $('a[href*="/genres/"]').each((_, el) => {
    const a = $(el);
    const name = clean(a.text());
    const url = absUrl(a.attr("href"));

    if (!name || !url) return;
    if (name.match(/^\d+$/) || name === "...") return;

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

  $("h2, h3").each((_, heading) => {
    const title = clean($(heading).text());
    if (!title) return;

    const area = $(heading).parent();
    const items = [];

    area.find('a[href*="/dramas/"]').each((__, a) => {
      const link = $(a);
      const url = absUrl(link.attr("href"));
      if (!url || url.includes("/ep")) return;

      const card = link.closest("div");
      const img = card.find("img").first();
      const itemTitle = clean(link.text()) || clean(img.attr("alt"));

      if (itemTitle) {
        items.push({
          section: title,
          title: itemTitle,
          slug: slugFromUrl(url),
          url,
          image: absUrl(img.attr("src") || img.attr("data-src")),
          genre: null,
          rating: null
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

function compareUpdates(oldData, newData) {
  const oldItems = oldData?.result?.all || oldData?.Result?.All || [];
  const newItems = newData?.result?.all || newData?.Result?.All || [];

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

    // 1. Ambil data cache lama dari MongoDB
    let oldCacheDoc = null;
    try {
      oldCacheDoc = await CacheModel.findOne({ key: cacheKey });
    } catch (e) {
      console.warn("[MongoDB Cache Warning]: Gagal membaca cache", e.message);
    }

    // 2. Scraping data segar dari PineDrama
    const { url, html } = await fetchSearch(query);
    const $ = cheerio.load(html);

    const searchResult = parseMainSearchResults($, html);
    const sections = parseSections($);
    const hotGenres = parseHotGenres($);
    const all = uniqueBy([...searchResult.items, ...sections.flatMap(s => s.items)], "url");

    const responseData = {
      status: true,
      creator: "ArulzXD",
      query,
      input: url,
      updatedAt: new Date().toISOString(),
      result: {
        search: searchResult,
        hotGenres,
        sections,
        all
      }
    };

    // 3. Bandingkan pembaruan data dengan cache sebelumnya
    responseData.update = compareUpdates(oldCacheDoc?.data, responseData);

    // 4. Simpan/Update cache di MongoDB (otomatis terhapus setelah 60 detik)
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
  text: "text (contoh: Romance)"
};
router.status = "ready";
router.type = "free";

module.exports = router;
