const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const BASE_URL = "https://pinedrama.com";
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";

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
      "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
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

function parseHotGenres($) {
  const items = [];

  $("main")
    .find('a[href*="/genres/"]')
    .each((_, el) => {
      const a = $(el);
      const name = clean(a.text());
      const url = absUrl(a.attr("href"));

      if (!name || !url) return;
      if (name.match(/^\d+$/)) return;
      if (name === "...") return;

      items.push({
        name,
        slug: slugFromUrl(url),
        url
      });
    });

  return uniqueBy(items, "url");
}

function parseDramaCard($, el, section) {
  const card = $(el);
  const dramaLink = card.find('a[href*="/dramas/"]').first();
  const genreLink = card.find('a[href*="/genres/"]').first();
  const img = card.find("img").first();

  const title = clean(dramaLink.text()) || clean(img.attr("alt"));
  const url = absUrl(dramaLink.attr("href"));
  const image = absUrl(img.attr("src"));
  const genre = clean(genreLink.text()) || null;
  const text = clean(card.text());
  const ratingMatch = text.match(/\b\d(?:\.\d)?\b/);

  if (!title || !url) return null;

  return {
    section,
    title,
    slug: slugFromUrl(url),
    url,
    image,
    genre,
    rating: ratingMatch ? ratingMatch[0] : null
  };
}

function parseMainSearchResults($) {
  const items = [];
  const heading = clean($("#short_drama").text()) || null;
  const area = $("#short_drama").parent();

  area.find('a[href*="/dramas/"]').each((_, el) => {
    const card = $(el).closest("div");
    const item = parseDramaCard($, card, "Search Results");

    if (item) items.push(item);
  });

  const uniqueItems = uniqueBy(items, "url");

  return {
    title: heading,
    total: uniqueItems.length,
    items: uniqueItems
  };
}

function parseSections($) {
  const sections = [];

  $("h2, h3, div").each((_, heading) => {
    const title = clean($(heading).text());

    if (!title) return;
    if (!["New Short Dramas", "Hot Genre"].includes(title)) return;

    const area = $(heading).parent();
    const items = [];

    area.find('a[href*="/dramas/"]').each((__, a) => {
      const card = $(a).closest("div");
      const item = parseDramaCard($, card, title);

      if (item) items.push(item);
    });

    const unique = uniqueBy(items, "url");

    if (unique.length) {
      sections.push({
        name: title,
        total: unique.length,
        items: unique
      });
    }
  });

  return uniqueBy(sections, "name");
}

function parseAllDramas(searchResult, sections) {
  const items = [];

  for (const item of searchResult.items || []) {
    items.push(item);
  }

  for (const section of sections) {
    for (const item of section.items || []) {
      items.push(item);
    }
  }

  return uniqueBy(items, "url");
}

router.get("/", async (req, res) => {
  try {
    const query = req.query.text?.trim() || req.query.q?.trim() || "Romance";

    const { url, html } = await fetchSearch(query);
    const $ = cheerio.load(html);

    const searchResult = parseMainSearchResults($);
    const sections = parseSections($);
    const hotGenres = parseHotGenres($);
    const all = parseAllDramas(searchResult, sections);

    return res.json({
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
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      message: err.message
    });
  }
});

router.desc = "Mencari drama, genre populer, dan rekomendasi short drama dari PineDrama berdasarkan kata kunci.";
router.paramsConfig = {
  text: "text (contoh: Romance)"
};
router.status = "ready";
router.type = "free";

module.exports = router;