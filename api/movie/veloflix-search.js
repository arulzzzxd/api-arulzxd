'use strict';

const express = require('express');
const router = express.Router();

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

function normalizeTmdbImage(value, width = 'w500') {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return `${TMDB_IMAGE_BASE}/${width}${value}`;
  return `${TMDB_IMAGE_BASE}/${width}/${value}`;
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

async function searchVeloflix(query) {
  const url = new URL('https://veloflix.my.id/api/search');
  url.searchParams.set('q', query);

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      'Accept': 'application/json',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://veloflix.my.id/',
      'Origin': 'https://veloflix.my.id',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const list = Array.isArray(json)
    ? json
    : json?.data || json?.result || json?.results || [];

  return list.map((item) =>
    typeof item === 'string' ? { title: item } : normalizeItem(item)
  );
}

router.get('/', async (req, res) => {
  try {
    const text = req.query.text?.trim() || req.query.q?.trim() || req.query.query?.trim();

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Masukkan parameter text atau q (contoh: ?text=spider-man)',
      });
    }

    const result = await searchVeloflix(text);

    return res.json({
      status: true,
      creator: 'ArulzXD',
      total: result.length,
      result,
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

router.desc = "Mencari film atau serial TV di Veloflix berdasarkan kata kunci query.";
router.paramsConfig = {
  text: "text",
};
router.status = "ready";
router.type = "free";

module.exports = router;