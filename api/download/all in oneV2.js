/**
 * NAMA SCRAPE  :: ANICHIN STREAMING & DOWNLOADER
 * [•] BASIS        :: anichin.moe
 */

const axios = require("axios");
const cheerio = require("cheerio");
const express = require("express");
const { URL } = require("url");

const router = express.Router();

const BASE_URL = process.env.ANICHIN_URL || "https://anichin.moe";
const TIMEOUT = parseInt(process.env.API_TIMEOUT || "10") * 1000;
const USER_AGENT = process.env.USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const CF_CLEARANCE = process.env.CF_CLEARANCE || "";

function buildHeaders(extra = {}) {
  const h = {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    ...extra,
  };
  if (CF_CLEARANCE) h["Cookie"] = `cf_clearance=${CF_CLEARANCE}`;
  return h;
}

function resolveUrl(slug) {
  if (!slug || slug === "") return BASE_URL;
  if (slug.startsWith("http")) return slug;
  if (slug.startsWith("/")) return `${BASE_URL}${slug}`;
  return `${BASE_URL}/${slug}`;
}

async function fetchHtml(slug) {
  const url = resolveUrl(slug);
  try {
    const res = await axios.get(url, { headers: buildHeaders(), timeout: TIMEOUT, decompress: true });
    return { html: res.data, sourceUrl: url };
  } catch (err) {
    throw new Error(`Fetch failed [${url}]: ${err.message}`);
  }
}

function extractSlug(href) {
  try {
    const parts = new URL(href, BASE_URL).pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || parts[parts.length - 2] || "";
  } catch {
    return href.split("/").filter(Boolean).pop() || "";
  }
}

function parseCards($, wrapper) {
  const cards = [];
  $(wrapper).find("article").each((_, article) => {
    const ttDiv = $(article).find("div.tt");
    if (!ttDiv.length) return;
    const h2 = ttDiv.find("h2");
    const headline = h2.text().trim();
    h2.remove();
    const title = ttDiv.text().trim() || headline;
    const type = $(article).find("div.typez").text().trim() || "Unknown";
    const status = $(article).find("span.epx").text().trim() || "Unknown";
    const img = $(article).find("img[src]").first();
    const thumbnail = img.attr("data-lazy-src") || img.attr("src") || "";
    const a = $(article).find("a[title]").first();
    if (!a.length) return;
    const slug = extractSlug(a.attr("href") || "");
    if (!slug) return;
    cards.push({ title, type, headline, status, thumbnail, slug });
  });
  return cards;
}

function parseInfoDetails($) {
  const info = {};
  $("div.info-content div.spe span").each((_, span) => {
    const text = $(span).text().trim();
    const idx = text.indexOf(":");
    if (idx !== -1) {
      const key = text.slice(0, idx).trim().toLowerCase().replace(/\s+/g, "_");
      const val = text.slice(idx + 1).trim();
      if (key && val) info[key] = val;
    }
  });
  return info;
}

async function getHome(page = 1) {
  const { html, sourceUrl } = await fetchHtml(page > 1 ? `/page/${page}/` : "");
  const $ = cheerio.load(html);
  const sections = [];
  $("div.bixbox.bbnofrm").each((_, section) => {
    const sectionEl = $(section).find("div.releases").children().first();
    const sectionName = sectionEl.length
      ? sectionEl.text().trim().toLowerCase().replace(/\s+/g, "_")
      : "unknown";
    const cards = [];
    $(section).find("article").each((_, article) => {
      const a = $(article).find("a[href]").first();
      if (!a.length) return;
      const href = a.attr("href") || "";
      let title = a.attr("title") || "";
      if (!title) {
        const ttDiv = $(article).find("div.tt");
        title = ttDiv.find("h2").text().trim() || ttDiv.text().trim();
      }
      if (!title || title.length < 2) return;
      const headline = $(article).find("h2").text().trim() || title;
      const type = $(article).find("[class*='typez']").text().trim() || "Unknown";
      const epsText = $(article).find("span.epx").text().replace(/\D/g, "");
      const eps = epsText ? parseInt(epsText) : null;
      const thumbnail = $(article).find("img[src]").first().attr("src") || "";
      const slug = extractSlug(href);
      if (!slug) return;
      cards.push({ title, type, headline, eps, thumbnail, slug });
    });
    if (cards.length) sections.push({ section: sectionName, cards });
  });
  return { results: sections, page, total: sections.length, source: sourceUrl };
}

async function search(query) {
  const { html, sourceUrl } = await fetchHtml(`/?s=${encodeURIComponent(query)}`);
  const $ = cheerio.load(html);
  const cards = parseCards($, "div.bixbox div.listupd");
  return { results: cards, query, total: cards.length, source: sourceUrl };
}

async function getAnimeList() {
  const { html, sourceUrl } = await fetchHtml("/anime");
  const $ = cheerio.load(html);
  const cards = parseCards($, "div.bixbox div.listupd");
  return { results: cards, total: cards.length, source: sourceUrl };
}

async function getInfo(slug) {
  const { html, sourceUrl } = await fetchHtml(slug);
  const $ = cheerio.load(html);
  const name = $("div.infox h1.entry-title[itemprop='name']").text().trim() || "Unknown Title";
  const thumbImg = $("div.thumb img").first();
  const thumbnail = thumbImg.attr("data-lazy-src") || thumbImg.attr("src") || "";
  const genres = [];
  $("div.genxed a").each((_, a) => { const g = $(a).text().trim(); if (g) genres.push(g); });
  const infoDetails = parseInfoDetails($);
  let rating = null;
  const ratingStrong = $("div.rating strong").first();
  if (ratingStrong.length) {
    const parts = ratingStrong.text().trim().split(/\s+/);
    rating = parts[1] || parts[0] || null;
  } else {
    const ns = $("div.rating div.numscore").first();
    if (ns.length) rating = ns.text().trim();
  }
  const synDiv = $("div.entry-content[itemprop='description']");
  const synTitle = (synDiv.find("h1").text().trim() || "") + (synDiv.find("h1").length ? " - " : "");
  const synParagraphs = [];
  synDiv.find("p").each((_, p) => { const t = $(p).text().trim(); if (t) synParagraphs.push(t); });
  const episodes = [];
  $("div.eplister ul li").each((_, li) => {
    const a = $(li).find("a").first();
    if (!a.length || !a.attr("href")) return;
    const epSlug = new URL(a.attr("href"), BASE_URL).pathname.replace(/^\/|\/$/g, "");
    const subtitle = $(li).find("div.epl-title").text().trim() || "Unknown";
    const date = $(li).find("div.epl-date").text().trim() || "Unknown Date";
    const episode = $(li).find("div.epl-num").text().trim() || null;
    episodes.push({ slug: epSlug, subtitle, date, episode, thumbnail });
  });
  return {
    result: { ...infoDetails, name, thumbnail, genre: genres, rating, sinopsis: { title: synTitle.trim(), paragraphs: synParagraphs }, episode: episodes },
    source: sourceUrl,
  };
}

async function getEpisode(slug) {
  const { html, sourceUrl } = await fetchHtml(slug);
  const $ = cheerio.load(html);
  const name = $("h2[itemprop='partOfSeries']").text().trim() || "Unknown Episode";
  let rootSlug = "unknown";
  const bc = $("div.ts-breadcrumb li");
  if (bc.length > 1) {
    const a = bc.eq(1).find("a").first();
    if (a.length) rootSlug = extractSlug(a.attr("href") || "");
  }
  const thumbEl = $("div.thumbnail img").first().length ? $("div.thumbnail img").first() : $("div.thumb img").first();
  const thumbnail = thumbEl.attr("data-lazy-src") || thumbEl.attr("src") || null;
  const genres = [];
  $("div.genxed a").each((_, a) => { const g = $(a).text().trim(); if (g) genres.push(g); });
  const infoDetails = parseInfoDetails($);
  const servers = [];
  $("select.mirror option").each((_, opt) => {
    const label = $(opt).text().trim();
    const rawValue = $(opt).attr("value") || "";
    if (!rawValue) return;
    let embedUrl = null;
    try {
      const decoded = Buffer.from(rawValue, "base64").toString("utf-8");
      embedUrl = cheerio.load(decoded)("iframe").attr("src") || null;
    } catch { }
    servers.push({ label, embedUrl });
  });
  const downloads = [];
  $("div.soraurlx").each((_, row) => {
    const quality = $(row).find("strong").text().trim() || "Unknown";
    const links = [];
    $(row).find("a").each((_, a) => { links.push({ host: $(a).text().trim(), url: $(a).attr("href") || "" }); });
    if (links.length) downloads.push({ quality, links });
  });
  const prevA = $("div.naveps a.prev, a[rel='prev']").first();
  const nextA = $("div.naveps a.next, a[rel='next']").first();
  return {
    result: {
      ...infoDetails, name, rootSlug, thumbnail, genre: genres, servers, downloads,
      navigation: {
        prev: prevA.length ? extractSlug(prevA.attr("href") || "") : null,
        next: nextA.length ? extractSlug(nextA.attr("href") || "") : null,
      },
    },
    source: sourceUrl,
  };
}

async function listGenres() {
  const { html, sourceUrl } = await fetchHtml("/anime");
  const $ = cheerio.load(html);
  const genres = [];
  $("input[name='genre[]'][value]").each((_, input) => {
    const value = $(input).attr("value") || "";
    if (!value) return;
    const name = value.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    genres.push({ name, slug: value });
  });
  return { genres, total: genres.length, source: sourceUrl };
}

async function getGenre(slug, page = 1) {
  let url = `/anime?genre[]=${slug}`;
  if (page > 1) url += `&page=${page}`;
  const { html, sourceUrl } = await fetchHtml(url);
  const $ = cheerio.load(html);
  const cards = parseCards($, "div.bixbox div.listupd");
  return { results: cards, slug, page, total: cards.length, source: sourceUrl };
}

// ================= ENDPOINTS =================

// GET /home?page=1
router.get("/home", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const data = await getHome(page);
    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

// GET /search?q=query
router.get("/search", async (req, res) => {
  try {
    const q = req.query.q || req.query.query;
    if (!q) return res.status(400).json({ status: false, error: "Parameter 'q' atau 'query' wajib diisi." });
    const data = await search(q);
    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

// GET /anime
router.get("/anime", async (req, res) => {
  try {
    const data = await getAnimeList();
    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

// GET /info?slug=anime-slug
router.get("/info", async (req, res) => {
  try {
    const slug = req.query.slug;
    if (!slug) return res.status(400).json({ status: false, error: "Parameter 'slug' wajib diisi." });
    const data = await getInfo(slug);
    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

// GET /episode?slug=episode-slug
router.get("/episode", async (req, res) => {
  try {
    const slug = req.query.slug;
    if (!slug) return res.status(400).json({ status: false, error: "Parameter 'slug' wajib diisi." });
    const data = await getEpisode(slug);
    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

// GET /genre/list
router.get("/genre/list", async (req, res) => {
  try {
    const data = await listGenres();
    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

// GET /genre/get?slug=genre-slug&page=1
router.get("/genre/get", async (req, res) => {
  try {
    const slug = req.query.slug;
    if (!slug) return res.status(400).json({ status: false, error: "Parameter 'slug' wajib diisi." });
    const page = parseInt(req.query.page) || 1;
    const data = await getGenre(slug, page);
    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, error: err.message });
  }
});

router.status = "ready";
router.type = "free";
module.exports = router;
