const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

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

// 1. Coba ekstrak data langsung dari Next.js JSON State
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

// 2. Fallback Selector HTML Universal
function parseMainSearchResults($, html) {
  // Coba Next Data JSON terlebih dahulu
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

  // Pindai seluruh tautan drama tanpa membatasi ke ID tertentu
  $('a[href*="/dramas/"]').each((_, el) => {
    const link = $(el);
    const url = absUrl(link.attr("href"));
    
    // Abaikan tautan episode individual (misal: /ep1)
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

router.get("/", async (req, res) => {
  try {
    const query = req.query.text?.trim() || req.query.q?.trim() || "CEO";

    const { url, html } = await fetchSearch(query);
    const $ = cheerio.load(html);

    const searchResult = parseMainSearchResults($, html);
    const sections = parseSections($);
    const hotGenres = parseHotGenres($);

    // Gabungkan seluruh hasil
    const all = uniqueBy([...searchResult.items, ...sections.flatMap(s => s.items)], "url");

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
  text: "text (contoh: CEO)"
};
router.status = "ready";
router.type = "free";

module.exports = router;
