const axios = require("axios");
const express = require("express");
const router = express.Router();

// =========================
// GET SPOTIFY ACCESS TOKEN
// =========================
async function getAccessToken() {
    const { data } = await axios.get(
        "https://open.spotify.com/get_access_token",
        {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
            }
        }
    );

    return data.accessToken;
}

// =========================
// GET TRACK INFO
// =========================
async function getTrack(trackId, token) {
    const { data } = await axios.get(
        `https://api.spotify.com/v1/tracks/${trackId}`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return data;
}

// =========================
// GET LYRICS
// =========================
async function getLyrics(artist, title) {
    const { data } = await axios.get(
        `https://lrclib.net/api/get?artist_name=${encodeURIComponent(
            artist
        )}&track_name=${encodeURIComponent(title)}`
    );

    return data;
}

// =========================
// ENDPOINT
// =========================
router.get("/", async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({
            status: false,
            error: "Missing 'url' parameter"
        });
    }

    try {
        const trackId = url.match(/track\/([A-Za-z0-9]+)/)?.[1];

        if (!trackId) {
            return res.status(400).json({
                status: false,
                error: "Invalid Spotify Track URL"
            });
        }

        const token = await getAccessToken();
        const track = await getTrack(trackId, token);

        const title = track.name;
        const artist = track.artists.map(v => v.name).join(", ");

        let lyrics = {};

        try {
            lyrics = await getLyrics(artist, title);
        } catch {
            lyrics = {};
        }

        return res.status(200).json({
            status: true,
            creator: "Arulzxd",
            result: {
                title,
                artist,
                album: track.album.name,
                release_date: track.album.release_date,
                duration: Math.floor(track.duration_ms / 1000),
                duration_ms: track.duration_ms,
                image: track.album.images?.[0]?.url || null,
                spotify: track.external_urls.spotify,
                lyrics: lyrics.plainLyrics || null,
                syncedLyrics: lyrics.syncedLyrics || null
            }
        });

    } catch (err) {
        return res.status(500).json({
            status: false,
            error: err.response?.data || err.message
        });
    }
});

router.status = "ready";
router.type = "free";
module.exports = router;