/**
 * NAMA SCRAPE  :: YTMP3 DOWNLOADER
 * [•] CREATOR      :: arulz
 * [•] BASIS        :: ssvid.cc / convert1s.com
 */

const axios = require('axios');
const express = require('express');
const router = express.Router();

async function ytmp3(ytUrl) {
    const headers = {
        'accept': 'application/json',
        'content-type': 'application/json',
        'origin': 'https://ssvid.cc',
        'referer': 'https://ssvid.cc/',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
    };

    const initRes = await axios.post('https://hub.convert1s.com/api/download', {
        url: ytUrl,
        audio: { bitrate: '128k' },
        output: { type: 'audio', format: 'mp3' }
    }, { headers });

    const { statusUrl, title, duration } = initRes.data;

    if (!statusUrl) {
        throw new Error('Gagal mendapatkan statusUrl dari server.');
    }

    let isCompleted = false;
    let downloadData = null;
    let attempts = 0;
    const maxAttempts = 20; // Batas polling agar tidak infinite loop

    while (!isCompleted && attempts < maxAttempts) {
        const statusRes = await axios.get(statusUrl, { headers });
        
        if (statusRes.data.status === 'completed') {
            isCompleted = true;
            downloadData = statusRes.data;
        } else {
            await new Promise(resolve => setTimeout(resolve, 1500));
            attempts++;
        }
    }

    if (!downloadData) {
        throw new Error('Proses konversi membutuhkan waktu terlalu lama (Timeout).');
    }

    return {
        title: downloadData.title || title,
        duration: downloadData.duration || duration,
        downloadUrl: downloadData.downloadUrl
    };
}

// Endpoint GET Utama
router.get('/', async (req, res) => {
    const url = req.query.url;

    if (!url || !/^https?:\/\//i.test(url)) {
        return res.status(400).json({
            status: false,
            error: "Missing or invalid 'url' parameter"
        });
    }

    try {
        const result = await ytmp3(url);

        return res.json({
            status: true,
            data: result
        });

    } catch (e) {
        return res.status(e.response?.status || 500).json({
            status: false,
            error: e.message
        });
    }
});

router.status = "ready";
router.type = "free";
module.exports = router;
