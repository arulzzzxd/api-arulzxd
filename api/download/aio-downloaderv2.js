/**
 * NAMA SCRAPE  :: GETDL SPACE DOWNLOADER
 * [•] BASIS        :: getdl.space
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();

const SITE = 'https://getdl.space';
const HOME = `${SITE}/en`;
const API_SESSION = `${SITE}/api/session`;
const API_DOWNLOAD = `${SITE}/api/download`;
const UA =
  'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

/* ------------------------------------------------------------------ */
/* Utilitas                                                            */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function humanSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/* Beberapa platform (mis. Facebook) mengembalikan URL dengan escape berlebih
   ("https:\/\/..." atau \u002F) sehingga harus dinormalisasi dulu. */
function normalizeUrl(u) {
  if (typeof u !== 'string' || !u) return u;
  let s = u.replace(/\\u002f/gi, '/').replace(/\\\//g, '/');
  if (s !== u) s = s.trim();
  return s;
}

/* Deteksi platform di sisi klien - regex identik dengan bundle GetDL */
const PLATFORM_PATTERNS = {
  tiktok: /tiktok\.com/i,
  douyin: /(?:^|\/\/)(?:[\w-]+\.)*douyin\.com(?:\/|$)/i,
  instagram: /instagram\.com/i,
  facebook: /facebook\.com|fb\.watch/i,
  youtube: /youtube\.com|youtu\.be/i,
  twitter: /twitter\.com|x\.com/i,
  threads: /threads\.net/i,
  capcut: /capcut\.com/i,
  spotify: /spotify\.com/i,
  soundcloud: /soundcloud\.com/i,
  pinterest: /(?:www\.)?pinterest\.(?:com|co\.uk|ca|de|fr|jp)/i,
  bilibili: /(?:www\.)?bilibili\.(?:tv|com)/i,
  snapchat: /snapchat\.com/i,
  pixiv: /pixiv\.net/i,
};

function detectPlatform(url) {
  for (const [id, re] of Object.entries(PLATFORM_PATTERNS)) {
    if (re.test(url)) return id;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* HTTP client                                                         */
/* ------------------------------------------------------------------ */

function makeClient() {
  return axios.create({
    timeout: 25000,
    maxRedirects: 5,
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    },
  });
}

/* ------------------------------------------------------------------ */
/* 1. Scrape halaman utama (daftar platform, meta, FAQ)                */
/* ------------------------------------------------------------------ */

async function scrapeSite(client) {
  const empty = {
    site_name: 'GetDL',
    site_url: SITE,
    site_description: null,
    supported_platforms: [],
    supported_features_jsonld: [],
    faq: [],
  };
  try {
    const { data: html } = await client.get(HOME, { timeout: 20000 });
    const $ = cheerio.load(html);

    const siteName =
      ($('header a span.font-display').first().text() || '').trim() ||
      ($('header a').first().text() || '').trim() ||
      'GetDL';
    const siteDescription =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      null;

    /* Daftar platform dari chip "Works with" (di-render server-side) */
    const platforms = [];
    $('section').each((_, sec) => {
      const label = $(sec).find('p').first().text().trim().toLowerCase();
      if (label !== 'works with') return;
      $(sec)
        .find('div')
        .each((__, div) => {
          const $d =$(div);
          const name = $d.find('span.text-sm.font-medium').first().text().trim();
          if (name && !platforms.some((p) => p.name === name)) {
            platforms.push({ name });
          }
        });
    });

    /* JSON-LD: featureList + FAQ */
    const features = [];
    const faq = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      let j;
      try {
        j = JSON.parse($(el).text());
      } catch {
        return;
      }
      if (!j || typeof j !== 'object') return;
      if (j['@type'] === 'WebApplication' && Array.isArray(j.featureList)) {
        features.push(...j.featureList);
      }
      if (j['@type'] === 'FAQPage' && Array.isArray(j.mainEntity)) {
        for (const q of j.mainEntity) {
          if (q && q.name) {
            faq.push({
              question: q.name,
              answer: (q.acceptedAnswer && q.acceptedAnswer.text) || null,
            });
          }
        }
      }
    });

    /* fallback: kalau chip tidak terbaca, ambil dari featureList JSON-LD */
    const finalPlatforms =
      platforms.length > 0
        ? platforms
        : features.map((f) => ({ name: String(f).replace(/\s*downloader\s*$/i, '') }));

    return {
      site_name: siteName,
      site_url: SITE,
      site_description: siteDescription,
      supported_platforms: finalPlatforms,
      supported_features_jsonld: features,
      faq,
      _warning: finalPlatforms.length ? undefined : 'platform_list_empty',
    };
  } catch (err) {
    return { ...empty, _warning: `site_scrape_failed: ${errMessage(err)}` };
  }
}

/* ------------------------------------------------------------------ */
/* 2. Session (cookie getdl_sid + sessionId)                           */
/* ------------------------------------------------------------------ */

async function createSession(client) {
  const res = await client.get(API_SESSION, {
    timeout: 15000,
    headers: { Referer: `${HOME}`, Origin: SITE },
  });
  const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  if (!body || !body.success || !body.sessionId) {
    const e = new Error('Gagal membuat sesi di getdl.space');
    e.code = 'SESSION_CREATE_FAILED';
    throw e;
  }
  const setCookie = res.headers['set-cookie'] || [];
  const raw = setCookie.find((c) => /^getdl_sid=/i.test(c)) || '';
  const cookie = raw.split(';')[0];
  if (!cookie) {
    const e = new Error('Cookie getdl_sid tidak diterima dari server');
    e.code = 'NO_COOKIE';
    throw e;
  }
  return { sessionId: body.sessionId, cookie };
}

/* ------------------------------------------------------------------ */
/* 3. Resolve konten                                                   */
/* ------------------------------------------------------------------ */

function errMessage(err) {
  if (!err) return 'unknown error';
  if (err.response && err.response.data && err.response.data.error) return err.response.data.error;
  if (err.code === 'ECONNABORTED') return 'Request timeout';
  return err.message || String(err);
}

async function resolveContent(client, targetUrl, session, opts, sessionRef) {
  const delays = [8000, 15000, 25000];
  let lastError = null;

  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      const res = await client.post(
        API_DOWNLOAD,
        { url: targetUrl, sessionId: session.sessionId },
        {
          timeout: opts.timeout,
          /* API membalas error dengan HTTP 429/502, jangan lempar exception */
          validateStatus: () => true,
          headers: {
            'Content-Type': 'application/json',
            Origin: SITE,
            Referer: `${HOME}`,
            Cookie: session.cookie,
          },
        }
      );
      let body = res.data;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = null;
        }
      }

      if (body && body.success && body.data) return { body, session };

      const code = (body && body.code) || `HTTP_${res.status}`;

      /* sesi tidak valid -> buat sesi baru lalu coba lagi (tanpa menghabiskan retry) */
      if (code === 'SESSION_REQUIRED' && sessionRef.refreshed < 2) {
        sessionRef.refreshed++;
        session = await createSession(client);
        sessionRef.session = session;
        attempt--;
        continue;
      }

      /* rate limit -> tunggu lalu coba lagi */
      if (code === 'RATE_LIMITED' && attempt < opts.retries) {
        const wait = delays[Math.min(attempt, delays.length - 1)];
        lastError = {
          code,
          message: (body && body.error) || 'Rate limited',
          http_status: res.status,
        };
        await sleep(wait);
        continue;
      }

      /* error sementara dari upstream (502/503) -> retry singkat */
      if (
        (code === 'RESOLVE_FAILED' || res.status >= 500) &&
        attempt < opts.retries &&
        attempt < 1
      ) {
        lastError = {
          code,
          message: (body && body.error) || 'Resolve failed',
          http_status: res.status,
        };
        await sleep(4000);
        continue;
      }

      return {
        body,
        session,
        fatal: {
          code,
          message: (body && body.error) || `Permintaan gagal (HTTP ${res.status})`,
          http_status: res.status,
        },
      };
    } catch (err) {
      const transient = [
        'ECONNRESET',
        'ECONNABORTED',
        'ETIMEDOUT',
        'EAI_AGAIN',
        'ENOTFOUND',
        'EPIPE',
      ].includes(err.code);
      lastError = { code: err.code || 'NETWORK_ERROR', message: errMessage(err) };
      if (attempt < opts.retries && transient) {
        await sleep([2000, 5000, 10000][Math.min(attempt, 2)]);
        continue;
      }
      return { fatal: { code: lastError.code, message: lastError.message } };
    }
  }
  return { fatal: lastError || { code: 'UNKNOWN', message: 'Gagal total' } };
}

/* ------------------------------------------------------------------ */
/* 4. Probe ukuran file (HEAD + Range, opsional)                       */
/* ------------------------------------------------------------------ */

const NON_MEDIA_TYPE =
  /mpegurl|application\/x-mpegurl|text\/|application\/json|application\/xml|image\/svg/i;

function headInfo(headers) {
  const len = parseInt(headers['content-length'], 10);
  return {
    content_type: String(headers['content-type'] || '').split(';')[0].trim() || null,
    bytes: Number.isFinite(len) && len > 0 ? len : null,
    content_range: String(headers['content-range'] || ''),
  };
}

function usableSize(info) {
  if (!info || !info.bytes || info.bytes <= 0) return false;
  if (info.content_type && NON_MEDIA_TYPE.test(info.content_type)) return false;
  return true;
}

async function probeMedia(client, url) {
  const out = { file_size_bytes: null, content_type: null };
  if (!url) return out;

  try {
    const res = await client.head(url, {
      timeout: 8000,
      maxRedirects: 5,
      headers: { Referer: `${HOME}`, Origin: SITE, Accept: '*/*' },
      validateStatus: (s) => s >= 200 && s < 400,
    });
    const info = headInfo(res.headers);
    out.content_type = info.content_type;
    if (usableSize(info)) {
      out.file_size_bytes = info.bytes;
      return out;
    }
  } catch {
    /* lanjut ke fallback */
  }

  try {
    const res = await client.get(url, {
      timeout: 8000,
      maxRedirects: 5,
      responseType: 'stream',
      headers: { Referer: `${HOME}`, Origin: SITE, Range: 'bytes=0-0', Accept: '*/*' },
      validateStatus: (s) => s >= 200 && s < 400,
    });
    if (res.data && typeof res.data.destroy === 'function') res.data.destroy();
    const info = headInfo(res.headers);
    if (!out.content_type) out.content_type = info.content_type;

    const m = /\/(\d+)\s*$/.exec(info.content_range);
    if (m && !NON_MEDIA_TYPE.test(info.content_type || '')) {
      const total = parseInt(m[1], 10);
      if (Number.isFinite(total) && total > 1) out.file_size_bytes = total;
    } else if (usableSize(info) && !/^bytes 0-0\//.test(info.content_range)) {
      out.file_size_bytes = info.bytes;
    }
  } catch {
    /* abaikan */
  }
  return out;
}

async function enrichMedia(client, downloads, concurrency = 5) {
  const results = new Array(downloads.length).fill(null);
  let idx = 0;
  const worker = async () => {
    while (idx < downloads.length) {
      const i = idx++;
      results[i] = await probeMedia(client, normalizeUrl(downloads[i].url));
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, downloads.length) }, worker));
  return results;
}

/* ------------------------------------------------------------------ */
/* 5. Susun output                                                     */
/* ------------------------------------------------------------------ */

function normalizeAuthor(author) {
  if (!author) return null;
  if (typeof author === 'string') return { name: author, username: null, avatar: null };
  return {
    name: author.name || author.username || null,
    username: author.username || null,
    avatar: normalizeUrl(author.avatar || author.image || author.profile_pic) || null,
  };
}

function sizeFromLabel(label) {
  if (typeof label !== 'string') return null;
  const m = /(?:^|[\s\-–(])\s*(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB|B)\s*\)?\s*$/i.exec(label);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const mult = { b: 1, kb: 1024, mb: 1048576, gb: 1073741824, tb: 1099511627776 }[
    m[2].toLowerCase()
  ];
  const bytes = Math.round(n * mult);
  return bytes > 0 ? bytes : null;
}

function buildMedia(downloads, probes) {
  if (!Array.isArray(downloads)) return [];
  return downloads.map((d, i) => {
    const probe = (probes && probes[i]) || {};
    let bytes = probe.file_size_bytes || null;
    let source = bytes ? 'head' : null;
    if (!bytes) {
      bytes = sizeFromLabel(d.label);
      if (bytes) source = 'label';
    }
    return {
      label: d.label || null,
      quality: d.quality || null,
      format: d.ext || null,
      content_type: probe.content_type || null,
      file_size_bytes: bytes,
      file_size_human: humanSize(bytes),
      file_size_source: source,
      url: normalizeUrl(d.url) || null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Endpoint GET Utama (Hanya Parameter `url`)                          */
/* ------------------------------------------------------------------ */

router.get('/', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: "Missing 'url' parameter" });
  }

  try {
    const u = new URL(targetUrl);
    if (!/^https?:$/.test(u.protocol)) throw new Error('protokol');
  } catch {
    return res.status(400).json({ error: `URL tidak valid: ${targetUrl}` });
  }

  // Opsi di-hardcode di dalam agar tidak membebani parameter request
  const opts = {
    url: targetUrl,
    size: true,
    site: false,
    timeout: 60000,
    retries: 3,
  };

  const client = makeClient();
  const startedAt = new Date().toISOString();

  const output = {
    scraped_at: startedAt,
    status: 'success',
    error: null,
    warning: null,
    content: null,
  };

  try {
    /* (1) Session */
    let session;
    try {
      session = await createSession(client);
    } catch (err) {
      return res.status(500).json({
        status: 'error',
        error: { code: err.code || 'SESSION_FAILED', message: errMessage(err) },
      });
    }

    /* (2) Resolve */
    const sessionRef = { session, refreshed: 0 };
    const result = await resolveContent(client, opts.url, session, opts, sessionRef);

    if (result.fatal || !result.body || !result.body.success || !result.body.data) {
      return res.status(400).json({
        status: 'error',
        error: result.fatal || {
          code: (result.body && result.body.code) || 'UNKNOWN',
          message: (result.body && result.body.error) || 'Tidak ada data yang dikembalikan',
        },
      });
    }

    const data = result.body.data;
    const downloads = Array.isArray(data.downloads) ? data.downloads : [];

    /* (3) Probe Ukuran File */
    let probes = null;
    if (opts.size && downloads.length) {
      probes = await enrichMedia(client, downloads);
    }

    const media = buildMedia(downloads, probes);
    const formats = [...new Set(media.map((m) => m.format).filter(Boolean))];

    output.content = {
      platform: data.platform || detectPlatform(opts.url) || null,
      type: data.type || null,
      title: data.title || null,
      creator: normalizeAuthor(data.author),
      thumbnail: data.thumbnail || null,
      duration_seconds: Number.isFinite(data.duration) ? data.duration : null,
      duration_human: Number.isFinite(data.duration)
        ? new Date(data.duration * 1000).toISOString().substr(11, 8)
        : null,
      available_formats: formats,
      media_count: media.length,
      media,
    };

    return res.json(output);
  } catch (err) {
    return res.status(500).json({
      scraped_at: new Date().toISOString(),
      status: 'error',
      error: { code: err.code || 'UNCAUGHT', message: errMessage(err) },
    });
  }
});

router.status = 'ready';
router.type = 'free';
module.exports = router;
