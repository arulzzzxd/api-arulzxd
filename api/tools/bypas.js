const express = require('express');
const router = express.Router();

// Fungsi bawaan untuk menghasilkan IP acak guna rotasi headers spoofing
function generateRandomIP() {
    const ranges = [
        [1, 1], [2, 2], [5, 5], [23, 23], [27, 27], [31, 31], [36, 36], [37, 37], [39, 39], [42, 42],
        [46, 46], [49, 49], [50, 50], [60, 60], [114, 114], [117, 117], [118, 118], [119, 119], [120, 120],
        [121, 121], [122, 122], [123, 123], [124, 124], [125, 125], [126, 126], [180, 180], [182, 182], [183, 183]
    ];
    const range = ranges[Math.floor(Math.random() * ranges.length)];
    const ip = [
        range[0],
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256)
    ].join('.');
    return ip;
}

// Fungsi internal untuk scraping API key aktif secara berkala/on-demand
async function fetchApiKey() {
    const spoofedIp = generateRandomIP();
    const response = await fetch('https://bypassunlock.com', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'X-Forwarded-For': spoofedIp,
            'X-Real-IP': spoofedIp
        }
    });
    if (!response.ok) throw new Error(`Failed to fetch bypassunlock.com: ${response.status}`);
    const html = await response.text();
    const match = html.match(/apikey=([^&"'\s>]+)/);
    if (!match) throw new Error('Could not find API key on bypassunlock.com');
    return match[1];
}

// GET Route Utama Endpoint
router.get('/', async (req, res) => {
    const url = req.query.url;

    // Validasi parameter query input
    if (!url) {
        return res.status(400).json({
            status: false,
            message: "Error: 'url' parameter is required.",
            example: "/api/bypass?url=HREF_SHORTLINK_DISINI"
        });
    }

    try {
        const apiKey = await fetchApiKey();
        const spoofedIp = generateRandomIP();
        
        const bypassApiUrl = `https://trw.lat/api/bypass?apikey=${apiKey}&url=${encodeURIComponent(url)}`;
        
        const response = await fetch(bypassApiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'X-Forwarded-For': spoofedIp,
                'X-Real-IP': spoofedIp,
                'Client-IP': spoofedIp,
                'True-Client-IP': spoofedIp,
                'X-Originating-IP': spoofedIp,
                'X-Cluster-Client-IP': spoofedIp,
                'Forwarded': `for=${spoofedIp}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            let parsedError;
            try {
                parsedError = JSON.parse(errorText);
            } catch (_) {
                parsedError = errorText;
            }
            return res.status(response.status).json({
                status: false,
                code: response.status,
                error: parsedError
            });
        }

        const data = await response.json();
        
        // Mengembalikan response JSON langsung ke client
        return res.status(200).json(data);

    } catch (error) {
        console.error('[Bypass API Error]:', error.message);
        return res.status(500).json({
            status: false,
            code: 500,
            error: error.message
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;