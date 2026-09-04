'use strict';

const express = require('express');
const router = express.Router();

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

function decodeHtmlEntities(value = '') {
  return String(value)
    .replace(/&#(x[0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex.slice(1), 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

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

function normalizeDetail(data, fallbackType, fallbackId) {
  const base = normalizeItem(data || {});

  return {
    ...base,
    id: data?.id ?? fallbackId ?? base.id,
    mediaType: data?.mediaType ?? fallbackType ?? base.mediaType,
    cast: Array.isArray(data?.cast)
      ? data.cast.map((c) => ({
          id: c.id ?? null,
          name: c.name ?? null,
          character: c.character ?? c.role ?? null,
          profileUrl: normalizeTmdbImage(c.profileUrl ?? c.profile_path, 'w185'),
        }))
      : [],
    recommendations: Array.isArray(data?.recommendations)
      ? data.recommendations.map((r) => normalizeItem(r))
      : [],
    seasons: Array.isArray(data?.seasons) ? data.seasons : [],
    nextEpisodeToAir: data?.nextEpisodeToAir ?? null,
    trailerYoutubeId: data?.trailerYoutubeId ?? data?.trailer ?? null,
    providers: data?.providers ?? [],
    imdbId: data?.imdbId ?? data?.imdb_id ?? base.imdbId,
  };
}

async function getTitleDetail(type, id) {
  try {
    const res = await fetch(`https://veloflix.my.id/api/title/${type}/${id}`, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'application/json',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://veloflix.my.id/',
        'Origin': 'https://veloflix.my.id',
      },
    });

    if (res.ok) {
      const json = await res.json();
      const payload = json?.data ?? json;

      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return normalizeDetail(payload, type, id);
      }
      if (Array.isArray(payload) && payload.length) {
        return normalizeDetail(payload[0], type, id);
      }
    }
  } catch {
  }

  // Fallback: Scrape HTML Meta apabila API internal tidak mengembalikan JSON
  const htmlRes = await fetch(`https://veloflix.my.id/title/${type}/${id}`, {
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': 'https://veloflix.my.id/',
    },
  });

  if (!htmlRes.ok) {
    throw new Error(`Gagal mengambil detail untuk ${type}/${id}`);
  }

  const html = await htmlRes.text();
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : '';

  return {
    id: Number(id),
    mediaType: type,
    title: rawTitle.replace(/\s*\|\s*Veloflix\s*$/i, '').trim(),
    source: 'html-fallback',
  };
}

router.get('/', async (req, res) => {
  try {
    const type = (req.query.type || 'movie').toLowerCase();
    const id = req.query.id?.trim() || req.query.text?.trim();

    if (!id) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Masukkan parameter id atau text (contoh: ?type=movie&id=969681)',
      });
    }

    const result = await getTitleDetail(type, id);

    return res.json({
      status: true,
      creator: 'ArulzXD',
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

router.desc = "Mengambil detail film atau serial TV lengkap (Pemeran, Sinopsis, Rekomendasi, Season) berdasarkan TMDB ID.";
router.paramsConfig = {
  type: {
    type: "select",
    options: ["movie", "tv"],
    default: "movie",
  },
  id: "text/TMDB ID (contoh: 969681)",
};
router.status = "ready";
router.type = "free";

module.exports = router;