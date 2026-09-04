const express = require('express');
const axios = require('axios');

const router = express.Router();

async function getLyrics(queryOrTrack, artist = '') {
  let trackName = queryOrTrack;
  let artistName = artist;

  // Parsing Spotify URL jika parameter berupa tautan track Spotify
  if (queryOrTrack.includes('spotify.com/track/')) {
    const match = queryOrTrack.match(/track\/([a-zA-Z0-9]+)/);
    if (match) {
      try {
        const oembed = await axios.get(
          `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${match[1]}`,
          { timeout: 5000 }
        );
        trackName = oembed.data?.title?.replace(/\(feat\..*?\)/i, '').trim() || trackName;

        const resEmbed = await axios.get(`https://open.spotify.com/embed/track/${match[1]}`, { timeout: 5000 });
        const matchArtist = resEmbed.data.match(/"artists":\[\{"name":"([^"]+)"/);
        if (matchArtist) {
          artistName = matchArtist[1];
        }
      } catch (_) {}
    }
  }

  // 1. Coba pencarian langsung melalui API LRCLIB (/api/get)
  try {
    const res = await axios.get('https://lrclib.net/api/get', {
      params: {
        track_name: trackName,
        artist_name: artistName,
      },
      timeout: 10000,
    });

    if (res.data && (res.data.plainLyrics || res.data.syncedLyrics)) {
      return {
        status: true,
        trackName: res.data.trackName || trackName,
        artistName: res.data.artistName || artistName,
        albumName: res.data.albumName || null,
        duration: res.data.duration || null,
        plainLyrics: res.data.plainLyrics || null,
        syncedLyrics: res.data.syncedLyrics || null,
      };
    }
  } catch (_) {}

  // 2. Alternatif: Kueri pencarian fuzzy melalui API LRCLIB (/api/search)
  try {
    const searchRes = await axios.get('https://lrclib.net/api/search', {
      params: {
        q: `${trackName} ${artistName}`.trim(),
      },
      timeout: 10000,
    });

    if (Array.isArray(searchRes.data) && searchRes.data.length > 0) {
      const best = searchRes.data[0];
      return {
        status: true,
        trackName: best.trackName || trackName,
        artistName: best.artistName || artistName,
        albumName: best.albumName || null,
        duration: best.duration || null,
        plainLyrics: best.plainLyrics || null,
        syncedLyrics: best.syncedLyrics || null,
      };
    }
  } catch (err) {
    return {
      status: false,
      message: err.message || 'Gagal mengambil lirik',
    };
  }

  return {
    status: false,
    message: 'Lirik lagu tidak ditemukan',
  };
}

router.get('/', async (req, res) => {
  try {
    const text = req.query.text?.trim() || req.query.q?.trim() || req.query.url?.trim();
    const artist = req.query.artist?.trim() || '';

    if (!text) {
      return res.status(400).json({
        status: false,
        creator: 'ArulzXD',
        message: 'Masukkan parameter text atau url (contoh: ?text=Nuvole Bianche atau ?url=https://open.spotify.com/track/...)',
      });
    }

    const result = await getLyrics(text, artist);

    if (!result.status) {
      return res.status(404).json({
        status: false,
        creator: 'ArulzXD',
        message: result.message,
      });
    }

    return res.json({
      status: true,
      creator: 'ArulzXD',
      result: {
        trackName: result.trackName,
        artistName: result.artistName,
        albumName: result.albumName,
        duration: result.duration,
        plainLyrics: result.plainLyrics,
        syncedLyrics: result.syncedLyrics,
      },
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

router.desc = "Mengambil lirik lagu (Plain & Synced LRC) berdasarkan judul lagu/artis atau link Spotify.";
router.paramsConfig = {
  text: "text/judul lagu atau link Spotify",
  artist: "text (opsional)"
};
router.status = "ready";
router.type = "free";

module.exports = router;
