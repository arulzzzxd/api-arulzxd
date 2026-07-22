/**
 * NAMA SCRAPE  :: MCPEDL ADVANCED SEARCH & DETAIL
 * [•] BASIS        :: api.mcpedl.com
 * [•] CONVERTED    :: Express Router API
 */

const axios = require("axios");
const express = require("express");
const router = express.Router();

const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";
const DESCRIPTION_LIMIT = 700;

const api = axios.create({
  baseURL: "https://api.mcpedl.com",
  timeout: 30000,
  validateStatus: () => true,
  headers: {
    "user-agent": UA,
    "accept": "application/json",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "origin": "https://mcpedl.com",
    "referer": "https://mcpedl.com/"
  }
});

function cleanText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limitText(value, limit = DESCRIPTION_LIMIT) {
  const text = cleanText(value);
  if (!limit || text.length <= limit) return text;
  return text.slice(0, limit).trim() + "...";
}

function getImagesFromHtml(html) {
  const found = [];
  const text = String(html || "");
  const regex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!found.includes(match[1])) found.push(match[1]);
  }
  return found;
}

function getVideosFromHtml(html) {
  const found = [];
  const text = String(html || "");
  const regex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!found.includes(match[1])) found.push(match[1]);
  }
  return found;
}

function cleanHighlight(value) {
  if (!Array.isArray(value)) return [];
  return value.map(x => limitText(x, 250)).filter(Boolean);
}

function compactSearchItem(item) {
  return {
    Id: item.id ?? null,
    Title: item.title ?? null,
    Slug: item.slug ?? null,
    Url: item.slug ? `https://mcpedl.com/${item.slug}/` : null,
    Source: item.source ?? null,
    Score: item.score ?? null,
    Summary: limitText(item.summary, 300),
    Description: limitText(item.description),
    Image: item.image ?? null,
    Created_at: item.created_at ?? null,
    Updated_at: item.updated_at ?? null,
    Downloads_count: item.downloadCount ?? null,
    Rating: item.average_rating ?? null,
    Type_id: item.type_id ?? null,
    Author: {
      Name: item.display_name ?? null,
      Username: item.user_nicename ?? null,
      Id: item.user_id ?? null,
      Avatar: item.user_avatar ?? null
    },
    Tags: Array.isArray(item.cf_tags) ? item.cf_tags.map(tag => ({
      Id: tag.id ?? null,
      Name: tag.name ?? null,
      Slug: tag.slug ?? null,
      Url: tag.url ?? null
    })) : [],
    Highlight: {
      Title: cleanHighlight(item.highlight?.title),
      Description: cleanHighlight(item.highlight?.description)
    }
  };
}

function compactDetail(data) {
  const d = data?.data || data || {};
  const htmlImages = getImagesFromHtml(d.description);
  const htmlVideos = getVideosFromHtml(d.description);
  const images = Array.isArray(d.submission_images) && d.submission_images.length ? d.submission_images : htmlImages;
  const videos = Array.isArray(d.submission_videos) && d.submission_videos.length ? d.submission_videos : htmlVideos;

  return {
    Id: d.id ?? null,
    Submission_id: d.submission_id ?? null,
    Title: d.title ?? null,
    Slug: d.slug ?? null,
    Url: d.slug ? `https://mcpedl.com/${d.slug}/` : null,
    Author: d.username || d.user?.display_name || d.user?.username || null,
    Status: d.status ?? null,
    Type_id: d.type_id ?? null,
    Publish_date: d.publish_date ?? null,
    Update_date: d.update_date ?? null,
    Rating: d.average_rating ?? d.comments_rating?.average ?? null,
    Comments_total: d.comments_total ?? null,
    Short_description: limitText(d.short_description, 300),
    Description: limitText(d.description),
    Changelog: limitText(d.changelog, 500),
    Image: d.image ?? null,
    Thumbnails: d.thumbnails ?? null,
    Categories: Array.isArray(d.categories) ? d.categories.map(x => ({
      Id: x.id ?? null,
      Name: x.name ?? null,
      Slug: x.slug ?? null
    })) : [],
    Tags: Array.isArray(d.cf_tags) ? d.cf_tags.map(x => ({
      Id: x.id ?? null,
      Name: x.name ?? null,
      Slug: x.slug ?? null,
      Url: x.url ?? null
    })) : [],
    Images: images,
    Videos: videos,
    Downloads: Array.isArray(d.downloads) ? d.downloads.map(x => ({
      Id: x.id ?? null,
      Name: x.display_name || x.name || null,
      Url: x.url || x.download_url || x.file || null,
      Type: x.type ?? null,
      File_date: x.fileDate ?? null
    })) : [],
    Revisions: Array.isArray(d.revisions) ? d.revisions.map(x => ({
      Id: x.id ?? null,
      Version: x.version ?? null,
      Changelog: limitText(x.changelog, 350)
    })) : [],
    Related: Array.isArray(d.related) ? d.related.slice(0, 8).map(x => ({
      Id: x.id ?? null,
      Title: x.title ?? null,
      Slug: x.slug ?? null,
      Url: x.slug ? `https://mcpedl.com/${x.slug}/` : null,
      Image: x.image ?? null
    })) : [],
    Comments: Array.isArray(d.comments) ? d.comments.slice(0, 8).map(x => ({
      Id: x.id ?? null,
      Author: x.author || x.user?.display_name || null,
      Text: limitText(x.text, 250),
      Likes: x.likes_count ?? null,
      Created_at: x.created_at ?? null
    })) : []
  };
}

async function searchAdvanced(query, page, sort, updated_at) {
  const res = await api.get("/api/search/advanced", {
    params: { q: query, sort, updated_at, page }
  });

  if (res.status < 200 || res.status >= 300) {
    return {
      ok: false,
      code: res.status,
      page,
      meta: null,
      results: [],
      error: typeof res.data === "string" ? res.data.slice(0, 300) : res.data
    };
  }

  return {
    ok: true,
    code: res.status,
    page,
    meta: res.data?.meta || null,
    results: Array.isArray(res.data?.results) ? res.data.results : []
  };
}

async function getDetail(slug, fullMode) {
  const res = await api.get(`/api/route/slug/${encodeURIComponent(slug)}`);

  if (res.status < 200 || res.status >= 300 || !res.data?.data) {
    return {
      ok: false,
      code: res.status,
      slug,
      error: typeof res.data === "string" ? res.data.slice(0, 300) : res.data
    };
  }

  return {
    ok: true,
    code: res.status,
    slug,
    data: fullMode ? res.data.data : compactDetail(res.data)
  };
}

// Endpoint GET Utama
router.get("/", async (req, res) => {
  const query = req.query.query;
  if (!query) {
    return res.status(400).json({ status: false, error: "Missing required 'q' (search query) parameter" });
  }

  // Pengaturan default jika query parameter optional tidak diisi client
  const targetPage = parseInt(req.query.page) || 1;
  const sort = req.query.sort || "relevance";
  const updatedAt = req.query.updated_at || "2y";
  const detailFull = req.query.detail_full === "true"; // Mengubah string "true" ke boolean

  try {
    const unique = new Map();
    const search = await searchAdvanced(query, targetPage, sort, updatedAt);
    const pageResults = [];

    if (!search.ok) {
      return res.status(search.code || 502).json({
        status: false,
        error: "Gagal mengambil data dari MCPEDL API",
        details: search.error
      });
    }

    // Melakukan scraping detail secara serial per item hasil pencarian
    for (const item of search.results) {
      const slug = item.slug;
      if (!slug) continue;

      const detail = await getDetail(slug, detailFull);

      pageResults.push({
        Search: detailFull ? item : compactSearchItem(item),
        Detail: detail.ok ? detail.data : null,
        Detail_error: detail.ok ? null : {
          Code: detail.code,
          Error: detail.error
        }
      });
    }

    // Filter duplikasi data berdasarkan slug
    for (const item of pageResults) {
      const slug = item.Search?.Slug || item.Search?.slug || item.Detail?.Slug || item.Detail?.slug;
      if (slug && !unique.has(slug)) unique.set(slug, item);
    }

    return res.json({
      status: true,
      code: 200,
      input: {
        query,
        page: targetPage,
        sort,
        updated_at: updatedAt,
        detail_full: detailFull,
        description_limit: DESCRIPTION_LIMIT
      },
      total: unique.size,
      result: [...unique.values()],
      meta: search.meta
    });

  } catch (err) {
    return res.status(500).json({
      status: false,
      code: 500,
      error: err.message
    });
  }
});

router.paramsConfig = {
    query: {
        type: "text",
        required: true,
        placeholder: "Masukkan kata kunci pencarian..."
    },
    page: {
        type: "number",
        default: 1,
        placeholder: "Halaman (Contoh: 1)"
    },
    sort: {
        type: "select",
        default: "relevance",
        options: [
            "relevance",
            "popular",
            "latest",
            "trending"
        ]
    },
    updated_at: {
        type: "select",
        default: "2y",
        options: [
            "all",
            "1d",
            "1w",
            "1m",
            "3m",
            "6m",
            "1y",
            "2y"
        ]
    },
    detail_full: {
        type: "select",
        default: "false",
        options: [
            "false",
            "true"
        ]
    }
};

router.status = "ready";
router.type = "free";
module.exports = router;
