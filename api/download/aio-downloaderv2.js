const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const TARGET_URL = "https://www.videodownloadertools.com/";
const API_URL = new URL("fetch_api.php", TARGET_URL).toString();

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const TIMEOUT = 45000;
const MAX_RETRY = 2;

const PLATFORM_MAP = {
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "m.youtube.com": "YouTube",
  "instagram.com": "Instagram",
  "tiktok.com": "TikTok",
  "vt.tiktok.com": "TikTok",
  "facebook.com": "Facebook",
  "fb.watch": "Facebook",
  "m.facebook.com": "Facebook",
  "twitter.com": "Twitter/X",
  "x.com": "Twitter/X",
  "vimeo.com": "Vimeo",
  "dailymotion.com": "Dailymotion",
  "dai.ly": "Dailymotion",
  "pinterest.com": "Pinterest",
  "pin.it": "Pinterest",
  "reddit.com": "Reddit",
  "redd.it": "Reddit",
  "snapchat.com": "Snapchat",
  "linkedin.com": "LinkedIn",
  "tumblr.com": "Tumblr",
  "twitch.tv": "Twitch",
  "soundcloud.com": "SoundCloud",
  "deezer.com": "Deezer",
  "bilibili.com": "Bilibili",
  "b23.tv": "Bilibili",
  "imgur.com": "Imgur",
  "threads.net": "Threads",
  "threads.com": "Threads",
  "likee.video": "Likee",
  "likee.com": "Likee",
  "kwai.com": "Kwai",
  "kwai-video.com": "Kwai",
  "sharechat.com": "ShareChat",
  "moj.com": "Moj",
  "ted.com": "TED",
  "vk.com": "VK",
  "ok.ru": "Odnoklassniki",
  "weibo.com": "Weibo",
};

const AUDIO_EXT = ["mp3", "m4a", "aac", "opus", "ogg", "wav", "flac"];
const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "bmp", "heic", "avif"];
const VIDEO_EXT = ["mp4", "mov", "webm", "mkv", "avi", "flv", "3gp", "m4v"];
const GIF_EXT = ["gif"];

const ALL_CONTENT_TYPES = ["video", "audio", "photo", "reels", "shorts", "gif"];

const PLATFORM_CONTENT = {
  Instagram: ["video", "audio", "reels", "photo"],
  YouTube: ["video", "audio", "shorts"],
  TikTok: ["video", "audio", "shorts"],
  Facebook: ["video", "audio", "reels"],
  "Twitter/X": ["video", "audio", "gif", "photo"],
  Snapchat: ["video", "audio"],
  Threads: ["video", "photo"],
  Imgur: ["video", "photo", "gif"],
  Pinterest: ["video", "photo", "gif"],
  Tumblr: ["video", "photo", "gif"],
  Reddit: ["video", "audio", "gif"],
  Likee: ["video", "audio", "shorts"],
  Kwai: ["video", "audio"],
  Moj: ["video", "audio"],
  ShareChat: ["video", "audio"],
  Vimeo: ["video", "audio"],
  Dailymotion: ["video", "audio"],
  Bilibili: ["video", "audio"],
  Twitch: ["video", "audio"],
  SoundCloud: ["audio"],
  Deezer: ["audio"],
  TED: ["video", "audio"],
};

function findKey(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of Object.keys(obj)) {
    if (keys.includes(k.toLowerCase())) return obj[k];
  }
  return undefined;
}

function extFromUrl(url) {
  try {
    const p = new URL(url).pathname;
    const m = p.match(/\.([a-z0-9]{2,5})(?:$|\?)/i);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function detectPlatform(rawUrl) {
  let host = "";
  try {
    host = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return { name: null, host: null, detected: false };
  }
  let name = PLATFORM_MAP[host] || null;
  if (!name) {
    for (const domain of Object.keys(PLATFORM_MAP)) {
      if (host === domain || host.endsWith("." + domain)) {
        name = PLATFORM_MAP[domain];
        break;
      }
    }
  }
  return { name: name || "Unknown/Generic", host, detected: Boolean(name) };
}

function contentTypeFromUrl(rawUrl, platformName) {
  const u = String(rawUrl).toLowerCase();
  if (/\/reel\/|\/reels\//.test(u) || (platformName === "Instagram" && /\/p\//.test(u)))
    return "reels";
  if (/\/shorts\//.test(u)) return "shorts";
  if (/\.gif(\?|$)/.test(u)) return "gif";
  if (/\.(jpg|jpeg|png|webp)(\?|$)/.test(u)) return "photo";
  if (/\.(mp3|m4a|aac|opus|ogg)(\?|$)/.test(u)) return "audio";
  return "video";
}

function normalizeMediaOptions(medias) {
  if (!Array.isArray(medias)) return [];
  return medias.map((m, i) => {
    const url = m.url || m.link || m.download_url || "";
    let extension = (m.extension || m.ext || m.format || "").toString().toLowerCase();
    if (!extension) extension = extFromUrl(url) || "mp4";

    const rawType = (m.type || m.mediaType || "").toString().toLowerCase();
    let mediaType = rawType;
    if (AUDIO_EXT.includes(extension) || rawType.includes("audio")) mediaType = "audio";
    else if (IMAGE_EXT.includes(extension)) mediaType = "image";
    else if (GIF_EXT.includes(extension)) mediaType = "gif";
    else if (VIDEO_EXT.includes(extension) || rawType.includes("video")) mediaType = "video";

    const audioOnly = mediaType === "audio";
    const rawQuality = m.quality || m.label || m.resolution || m.height;
    const quality = rawQuality ? String(rawQuality) : "unknown";
    const hasAudio = m.hasAudio !== undefined ? Boolean(m.hasAudio) : !["image", "gif"].includes(mediaType);
    const hasVideo = m.hasVideo !== undefined ? Boolean(m.hasVideo) : ["video"].includes(mediaType);

    return {
      index: i + 1,
      quality,
      resolution: m.height ? `${m.height}p` : m.resolution || quality,
      format: extension.toUpperCase(),
      extension,
      mediaType,
      audioOnly,
      hasVideo,
      hasAudio,
      size: m.size || m.filesize || m.fileSize || null,
      url,
    };
  });
}

function extractSubtitles(raw, options) {
  const subRaw =
    findKey(raw, ["subtitles", "subtitle", "captions", "caption"]) || null;
  const formats = [];
  let available = false;

  const collect = (v) => {
    if (!v) return;
    if (Array.isArray(v)) {
      available = available || v.length > 0;
      for (const item of v) {
        if (typeof item === "string") formats.push(extFromUrl(item) || item);
        else if (item && typeof item === "object") {
          const f = item.lang || item.language || item.format || item.ext ||
            item.label || item.name;
          if (f) formats.push(String(f));
        }
      }
    } else if (typeof v === "object") {
      const keys = Object.keys(v);
      available = available || keys.length > 0;
      formats.push(...keys);
    } else if (typeof v === "string") {
      available = true;
      formats.push(v);
    }
  };
  collect(subRaw);
  for (const o of options) {
    const s = o.subtitles || o.subtitle;
    if (s) collect(s);
  }

  return { available, formats: [...new Set(formats.filter(Boolean))] };
}

async function fetchSite(homeHtml) {
  const $ = cheerio.load(homeHtml);
  const platforms = [];
  $(".slider-item").each((_, el) => {
    const slug = $(el).attr("href") || "";
    const name = ($(el).find("img").attr("alt") || "").trim();
    if (!slug || platforms.find((p) => p.slug === slug)) return;
    platforms.push({
      name: name || slug.replace(/[/-]/g, " ").trim(),
      slug,
      url: new URL(slug, TARGET_URL).toString(),
    });
  });

  const text = $("body").text().replace(/\s+/g, " ").trim();

  const supportedFormats = [];
  for (const f of ["MP4", "MOV", "WEBM", "MP3"]) {
    if (new RegExp("\\b" + f + "\\b", "i").test(text)) supportedFormats.push(f);
  }

  const advertisedResolutions = [];
  for (const r of ["360p", "480p", "720p", "1080p", "1440p", "2K", "4K", "8K"]) {
    if (new RegExp("\\b" + r + "\\b", "i").test(text)) advertisedResolutions.push(r);
  }

  const descriptions = [];
  $("li").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length > 20 && t.length < 240 && !/http|jackpot|news|promo|code/i.test(t)) {
      descriptions.push(t);
    }
  });

  const contentSet = new Set(["video", "audio"]);
  for (const p of platforms) {
    const key = Object.keys(PLATFORM_CONTENT).find(
      (k) => k.toLowerCase() === p.name.toLowerCase()
    );
    const caps = PLATFORM_CONTENT[key] || PLATFORM_CONTENT[p.name];
    if (caps) caps.forEach((c) => contentSet.add(c));
  }
  const supportedContentTypes = ALL_CONTENT_TYPES.filter((t) => contentSet.has(t));

  return {
    title: $("title").text().trim(),
    description: ($('meta[name="description"]').attr("content") || "").trim(),
    supportedPlatforms: platforms,
    platformCount: platforms.length,
    supportedFormats,
    advertisedResolutions,
    supportedContentTypes,
    contentTypeSource: "inferensi dari platform yang terdaftar + teks halaman",
    featureHighlights: descriptions.slice(0, 8),
  };
}

async function getHomepage() {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await axios.get(TARGET_URL, {
        timeout: TIMEOUT,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        maxRedirects: 5,
        validateStatus: (s) => s >= 200 && s < 400,
      });
      return res.data;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRY) await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
  }
  throw lastErr;
}

async function callApi(mediaUrl) {
  const body = new URLSearchParams();
  body.append("url", mediaUrl);
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await axios.post(API_URL, body.toString(), {
        timeout: TIMEOUT,
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Accept: "application/json, text/plain, */*",
          Referer: TARGET_URL,
          Origin: new URL(TARGET_URL).origin,
          "X-Requested-With": "XMLHttpRequest",
        },
        maxRedirects: 5,
        validateStatus: (s) => s >= 200 && s < 500,
      });
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRY) await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
  }
  throw lastErr;
}

function emptySite() {
  return {
    title: null,
    description: "",
    supportedPlatforms: [],
    platformCount: 0,
    supportedFormats: [],
    advertisedResolutions: [],
    supportedContentTypes: ALL_CONTENT_TYPES,
    featureHighlights: [],
  };
}

function safeJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    const m = str.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function scrape(inputUrl, opts) {
  const started = Date.now();
  const result = {
    meta: {
      target: TARGET_URL,
      apiEndpoint: API_URL,
      inputUrl: inputUrl || null,
      scrapedAt: new Date().toISOString(),
      method: "Cheerio (HTML statis) + POST fetch_api.php (JSON)",
      durationMs: 0,
    },
    status: "info",
    progress: 0,
    error: null,
    platform: { name: null, host: null, detected: false },
    contentType: { detected: null, allSiteSupported: ALL_CONTENT_TYPES },
    title: null,
    source: null,
    thumbnail: null,
    mediaUrl: inputUrl || null,
    formats: { available: [], extensions: [] },
    resolutions: [],
    options: [],
    availability: { video: false, audioOnly: false, image: false, gif: false },
    subtitle: { available: false, formats: [] },
    site: emptySite(),
  };

  try {
    const html = await getHomepage();
    result.site = await fetchSite(html);
  } catch (err) {
    result.site = emptySite();
  }

  if (!inputUrl) {
    result.status = result.site.supportedPlatforms.length ? "info" : "failed";
    if (result.status === "failed") result.error = "Target tidak mengembalikan data platform.";
    result.meta.durationMs = Date.now() - started;
    return result;
  }

  let parsed;
  try {
    parsed = new URL(inputUrl);
  } catch {
    result.status = "failed";
    result.error = `URL tidak valid: ${inputUrl}`;
    result.meta.durationMs = Date.now() - started;
    return result;
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    result.status = "failed";
    result.error = "Hanya URL http/https yang didukung.";
    result.meta.durationMs = Date.now() - started;
    return result;
  }

  result.platform = detectPlatform(inputUrl);
  result.contentType.detected = contentTypeFromUrl(inputUrl, result.platform.name);

  try {
    const res = await callApi(inputUrl);
    const data = typeof res.data === "string" ? safeJson(res.data) : res.data;
    if (opts && opts.raw) result.rawApiResponse = data;

    if (!data || typeof data !== "object") {
      result.status = "failed";
      result.error = "Respons API tidak valid (bukan JSON).";
    } else {
      const apiMsg = data.message || data.error || null;
      const rawMedias = data.medias || data.links || data.data || [];
      const options = normalizeMediaOptions(rawMedias);

      if (data.title) result.title = data.title;
      if (data.source) result.source = data.source;
      else result.source = result.platform.name;
      if (data.thumbnail || data.picture || data.cover) {
        result.thumbnail = data.thumbnail || data.picture || data.cover;
      } else if (data.title === undefined && findKey(data, ["thumbnail", "picture"])) {
        result.thumbnail = findKey(data, ["thumbnail", "picture"]);
      }
      result.options = options;

      const exts = [...new Set(options.map((o) => o.extension))];
      result.formats = { available: exts.map((e) => e.toUpperCase()), extensions: exts };
      result.resolutions = [
        ...new Set(options.map((o) => o.resolution).filter((r) => r && r !== "unknown")),
      ];
      result.availability = {
        video: options.some((o) => o.mediaType === "video"),
        audioOnly: options.some((o) => o.audioOnly),
        image: options.some((o) => o.mediaType === "image"),
        gif: options.some((o) => o.mediaType === "gif"),
      };
      result.subtitle = extractSubtitles(data, options);

      if (options.length > 0) {
        result.status = "success";
        result.progress = 100;
        result.error = null;
      } else {
        result.status = "failed";
        result.progress = 0;
        result.error = apiMsg || "Tidak ada media yang ditemukan untuk URL ini.";
      }
    }
  } catch (err) {
    result.status = "failed";
    result.progress = 0;
    if (err.code === "ECONNABORTED" || /timeout/i.test(err.message)) {
      result.error = `Timeout setelah ${TIMEOUT}ms pada endpoint fetch_api.php.`;
    } else if (err.response) {
      result.error = `HTTP ${err.response.status}: ${err.response.statusText || "error"}`;
    } else {
      result.error = `Gagal menghubungi API: ${err.message}`;
    }
  }

  result.meta.durationMs = Date.now() - started;
  return result;
}

// ENDPOINT METHOD GET ONLY
router.get("/", async (req, res) => {
  try {
    const inputUrl = req.query.url?.trim() || req.query.link?.trim();

    if (!inputUrl) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'url' wajib diisi (contoh: ?url=https://www.youtube.com/watch?v=...)",
      });
    }

    const raw = req.query.raw === "true";
    const result = await scrape(inputUrl, { raw });

    return res.status(result.status === "failed" ? 400 : 200).json(result);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message,
    });
  }
});

router.desc = "Downloader All-In-One (AIO) untuk YouTube, TikTok, Instagram, Facebook, dll.";
router.paramsConfig = {
  url: "https://www.youtube.com/watch?v=..."
};
router.status = "ready";
router.type = "free";

module.exports = router;
