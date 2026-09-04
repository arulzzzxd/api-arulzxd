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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function absUrl(url) {
  if (!url) return null;
  try {
    return new URL(url, BASE_URL).href;
  } catch {
    return url;
  }
}

async function fetchHtml(url, referer = BASE_URL + "/") {
  const res = await axios.get(url, {
    timeout: 30000,
    validateStatus: () => true,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      referer,
      "user-agent": UA
    }
  });

  if (res.status !== 200) {
    throw new Error(`Gagal membuka ${url}: HTTP ${res.status}`);
  }

  return res.data;
}

function decodeNextText(html) {
  return html
    .replace(/\\u0026/g, "&")
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\u002f/g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function parseJsonLd($) {
  const items = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    try {
      items.push(JSON.parse(raw));
    } catch {}
  });

  return items;
}

function parseStreamUrls(html) {
  const decoded = decodeNextText(html);
  const items = [];
  const regex = /"episode_id"\s*:\s*(\d+)\s*,\s*"url"\s*:\s*"([^"]+)"/g;

  let match;
  while ((match = regex.exec(decoded)) !== null) {
    items.push({
      Episode: Number(match[1]),
      Url: match[2].replace(/\\u0026/g, "&")
    });
  }

  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.Episode)) return false;
    seen.add(item.Episode);
    return true;
  });
}

function parseEpisodeDetail(html, url, episode) {
  const $ = cheerio.load(html);
  const jsonLd = parseJsonLd($);
  const schema = jsonLd.find(x => x["@type"] === "TVEpisode") || {};
  const title = schema.partOfSeries?.name || clean($("h1").first().text()) || null;
  const episodeTitle = schema.name || null;
  const image = absUrl(schema.image || $('meta[property="og:image"]').attr("content"));
  const description = clean($('meta[name="description"]').attr("content")) || clean(schema.description) || null;

  const genres = [];
  $('a[href*="/genres/"]').each((_, el) => {
    const a = $(el);
    const name = clean(a.text());
    const href = absUrl(a.attr("href"));

    if (!name || !href) return;
    if (genres.some(x => x.url === href)) return;

    genres.push({ name, url: href });
  });

  return {
    Title: title,
    Episode_title: episodeTitle,
    Episode: Number(schema.episodeNumber || episode),
    Url: url,
    Image: image,
    Genres: genres,
    Description: description
  };
}

async function getFreshEpisodeData(slug, episode) {
  const detailUrl = `${BASE_URL}/dramas/${slug}`;
  const episodeUrl = `${BASE_URL}/dramas/${slug}/ep${episode}`;
  const html = await fetchHtml(episodeUrl, detailUrl);
  const detail = parseEpisodeDetail(html, episodeUrl, episode);
  const streams = parseStreamUrls(html);
  const selected = streams.find(item => item.Episode === Number(episode)) || null;

  return {
    detail,
    streams,
    streamUrl: selected?.Url || null
  };
}

// Fungsi untuk mendapatkan stream/response axios langsung dengan penanganan auto-retry jika 403
async function getDirectVideoStream(slug, episode, initialStreamUrl) {
  let streamUrl = initialStreamUrl;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (!streamUrl) {
      throw new Error("Stream tidak ditemukan atau episode terkunci");
    }

    try {
      const response = await axios.get(streamUrl, {
        responseType: "stream",
        timeout: 120000,
        validateStatus: () => true,
        headers: {
          accept: "*/*",
          "accept-encoding": "identity;q=1, *;q=0",
          range: "bytes=0-",
          referer: BASE_URL + "/",
          "user-agent": UA
        }
      });

      if ([200, 206].includes(response.status)) {
        return response;
      }

      if (response.status === 403 && attempt < 3) {
        await sleep(1000);
        const fresh = await getFreshEpisodeData(slug, episode);
        streamUrl = fresh.streamUrl;
        continue;
      }

      throw new Error(`Gagal mengambil video stream: HTTP ${response.status}`);
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(1000);
      const fresh = await getFreshEpisodeData(slug, episode);
      streamUrl = fresh.streamUrl;
    }
  }
}

router.get("/", async (req, res) => {
  try {
    const slug = req.query.slug?.trim() || req.query.text?.trim() || "cooking-my-way-back-to-love";
    const episode = parseInt(req.query.episode || req.query.ep) || 1;
    const isDirectStream = req.query.stream === "true" || req.query.direct === "true";

    const freshData = await getFreshEpisodeData(slug, episode);

    if (!freshData.streamUrl) {
      return res.status(404).json({
        status: false,
        creator: "ArulzXD",
        message: "Stream URL tidak ditemukan atau episode terkunci"
      });
    }

    // Jika pengguna meminta streaming/direct video player
    if (isDirectStream) {
      const videoResponse = await getDirectVideoStream(slug, episode, freshData.streamUrl);
      
      res.setHeader("Content-Type", videoResponse.headers["content-type"] || "video/mp4");
      if (videoResponse.headers["content-length"]) {
        res.setHeader("Content-Length", videoResponse.headers["content-length"]);
      }
      if (videoResponse.headers["accept-ranges"]) {
        res.setHeader("Accept-Ranges", videoResponse.headers["accept-ranges"]);
      }

      return videoResponse.data.pipe(res);
    }

    // Default: kembalikan metadata & link JSON
    return res.json({
      status: true,
      creator: "ArulzXD",
      slug,
      episode,
      result: {
        ...freshData.detail,
        streamUrl: freshData.streamUrl,
        allStreams: freshData.streams
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

router.desc = "Mengambil detail episode, metadata, dan link stream video MP4 dari PineDrama. Tambahkan &stream=true untuk memutar video secara langsung.";
router.paramsConfig = {
  slug: "text (contoh: cooking-my-way-back-to-love)",
  episode: "number (default: 1)",
  stream: "boolean (opsional, set 'true' untuk memutar video langsung)"
};
router.status = "ready";
router.type = "free";

module.exports = router;