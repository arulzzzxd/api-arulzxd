const express = require('express');
const router = express.Router();
const axios = require('axios');

// ======================================================
// CORE SCRAPER FUNCTION (YOUTUBE TRANSCRIPT - INDONESIA ONLY)
// ======================================================
async function youtubeTranscript(url) {
    const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([^&\n?#]+)/)?.[1];
    if (!videoId) throw new Error('Invalid YouTube URL');

    const response = await axios.post(`https://www.youtube.com/youtubei/v1/player`, {
        context: {
            client: {
                clientName: 'ANDROID',
                clientVersion: '20.10.38'
            }
        },
        videoId
    }, {
        headers: {
            'Content-Type': 'application/json'
        }
    });

    const data = response.data;

    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) throw new Error('Transkrip tidak tersedia untuk video ini');

    // Mengunci pencarian hanya untuk bahasa 'id' (Indonesia)
    const track = tracks.find(t => t.languageCode === 'id');
    if (!track) throw new Error('Transkrip bahasa Indonesia tidak tersedia untuk video ini');
    
    // Ambil data XML subtitle
    const xmlUrl = track.baseUrl.replace(/&fmt=\w+$/, '');
    const xmlResponse = await axios.get(xmlUrl);
    const xml = xmlResponse.data;

    // Bersihkan tag XML dan entitas HTML
    const lines = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
        .map(m => m[1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/<[^>]+>/g, '')
            .trim()
        )
        .filter(Boolean);

    return {
        videoId,
        lang: 'id',
        result: lines.join(' ')
    };
}

// ======================================================
// ENDPOINT GET UTAMA
// ======================================================
router.get('/', async (req, res) => {
    const url = req.query.url;

    // Sekarang hanya memeriksa parameter url saja
    if (!url) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'url' wajib diisi! Contoh: ?url=https://youtube.com/watch?v=xxxx"
        });
    }

    try {
        const result = await youtubeTranscript(url);

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            result,
            metadata: {
                source: 'YouTube Transcript',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: 'Gagal mengambil transkrip video YouTube',
            error: error.message || error,
            timestamp: new Date().toISOString()
        });
    }
});

// Ekspor router untuk digunakan di index.js kamu
router.status = "ready"; 
router.type = "free";
module.exports = router;