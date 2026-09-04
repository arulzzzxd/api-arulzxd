'use strict';

const express = require('express');
const router = express.Router();

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTmdbImage(value, width = 'w500') {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return `${TMDB_IMAGE_BASE}/${width}${value}`;
  return `${TMDB_IMAGE_BASE}/${width}/${value}`;
}

function extractJsonArrayByKey(text, key) {
  if (!text || !key) return null;
  const needle = `"${key}":`;
  let searchFrom = 0;

  while (true) {
    const idx = text.indexOf(needle, searchFrom);
    if (idx === -1) return null;

    const start = text.indexOf('[', idx + needle.length);
    if (start === -1) return null;

    let inString = false;
    let escaped = false;
    let depth = 0;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }

      if (ch === '"') inString = true;
      else if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') depth--;

      if (depth === 0 && ch === ']') {
        const slice = text.slice(start, i + 1);
        try {
          return JSON.parse(slice);
        } catch {
          break;
        }
      }
    }
    searchFrom = idx + needle.length;
  }
}

function extractNumberByKey(text, key) {
  if (!text || !key) return null;
  const re = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*(\\d+)`);
  const match = text.match(re);
  return match ? Number(match[1]) : null;
}

function normalizeItem(raw) {
  if (!raw) return raw;
  if (typeof raw === 'string') return { title: raw };
  if (typeof raw !== 'object') return raw;

  const id = raw.id ?? raw.tmdbId ?? raw.tmdb_id ?? raw.movieId ?? raw.tvId;
  const mediaType =
    raw.mediaType ??
    raw.media_type ??
    raw.type ??
    (raw.tvId || raw.first_air_date ? 'tv' : 'movie');

  const title =
    raw.title ??
    raw.name ??
    raw.label ??
    raw.original_title ??
    raw.original_name ??
    null;

  const year =
    raw.year ??
    (raw.releaseDate
      ? Number(String(raw.releaseDate).slice(0, 4))
      : raw.release_date
      ? Number(String(raw.release_date).slice(0, 4))
      : null);

  return {
    id: id ?? null,
    mediaType,
    title,
    year,
    rating: raw.rating ?? raw.vote_average ?? raw.voteAverage ?? raw.score ?? null,
    voteCount: raw.voteCount ?? raw.vote_count ?? null,
    posterUrl: normalizeTmdbImage(raw.posterUrl ?? raw.poster_path ?? raw.poster, 'w500'),
    backdropUrl: normalizeTmdbImage(
      raw.backdropUrl ?? raw.backdrop_path ?? raw.backdrop,
      'w1280'
    ),
    overview: raw.overview ?? raw.description ?? raw.synopsis ?? null,
    genres: raw.genres ?? raw.genreIds ?? raw.genre_ids ?? [],
    releaseDate: raw.releaseDate ?? raw.release_date ?? raw.first_air_date ?? null,
    logoUrl: raw.logoUrl ?? raw.logo ?? null,
    originalLanguage: raw.originalLanguage ?? raw.original_language ?? null,
    originCountry: raw.originCountry ?? raw.origin_country ?? null,
    imdbId: raw.imdbId ?? raw.imdb_id ?? null,
    url: id && mediaType ? `https://veloflix.my.id/title/${mediaType}/${id}` : null,
    watchUrl: id && mediaType ? `https://veloflix.my.id/watch/${mediaType}/${id}?play=1` : null,
  };
}

function parseCategoryPayload(text, fallbackPage = 1) {
  if (!text) {
    return { items: [], currentPage: fallbackPage, totalPages: 1, totalResults: 0 };
  }

  let items = extractJsonArrayByKey(text, 'initialItems');
  if (!items || !Array.isArray(items)) {
    return { items: [], currentPage: fallbackPage, totalPages: 1, totalResults: 0 };
  }

  return {
    items: items.map((item) => normalizeItem(item)),
    currentPage: extractNumberByKey(text, 'currentPage') ?? fallbackPage,
    totalPages: extractNumberByKey(text, 'totalPages') ?? 1,
    totalResults: extractNumberByKey(text, 'totalResults') ?? items.length,
  };
}

async function getCategoryPage(type = 'movie', genre, page = 1) {
  const pathname = `/category/${type}`;
  const url = new URL(pathname, 'https://veloflix.my.id');
  url.searchParams.set('page', String(page));
  if (genre) url.searchParams.set('genre', String(genre));

  const rootTree = '["",{"children":["__PAGE__",{}]},null,null,true]';
  const categoryTree = `["",{"children":["category",{"children":[["type","${type}","d"],{"children":["__PAGE__",{}]}]}]},null,null,true]`;

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      'Accept': 'text/x-component',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://veloflix.my.id/',
      'Origin': 'https://veloflix.my.id',
      'RSC': '1',
      'Next-Router-Prefetch': '1',
      'Next-Url': pathname,
      'Next-Router-State-Tree': encodeURIComponent(categoryTree),
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  return parseCategoryPayload(text, page);
}

router.get('/', async (req, res) => {
  try {
    const type = (req.query.type || 'movie').toLowerCase();
    const genre = req.query.genre || req.query.text;
    const page = parseInt(req.query.page) || 1;

    const result = await getCategoryPage(type, genre, page);

    return res.json({
      status: true,
      creator: 'ArulzXD',
      type,
      genre: genre || null,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      totalResults: result.totalResults,
      result: result.items,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: 'ArulzXD',
      message: err.message,
    });
  }
});

router.desc = "Mengambil katalog film atau serial TV berdasarkan kategori genre dan urutan halaman.";
router.paramsConfig = {
  type: {
    type: "select",
    options: ["movie", "tv"],
    default: "movie",
  },
  genre: "number/id genre (contoh: 28 untuk Action)",
  page: "number",
};
router.status = "ready";
router.type = "free";

module.exports = router;