const axios = require('axios');
const express = require('express');
const router = express.Router();

// ======================================================
// CORE PINTEREST SEARCH FUNCTION
// ======================================================
async function pinterestSearch(text) {
    const parts = text.trim().split(/\s+/);

    const limit = /^\d+$/.test(parts[parts.length - 1])
        ? Math.min(10, Math.max(1, parseInt(parts.pop())))
        : 5;

    const query = parts.join(' ').trim();

    const headers = {
        'screen-dpr': '4',
        'x-pinterest-pws-handler': 'www/search/[scope].js',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9',
        'referer': 'https://www.pinterest.com/'
    };

    const url = `https://www.pinterest.com/resource/BaseSearchResource/get/?data=${encodeURIComponent(
        JSON.stringify({
            options: {
                query
            }
        })
    )}`;

    const response = await axios.head(url, {
        headers,
        validateStatus: () => true
    });

    const link = response.headers.link || '';

    const results = [
        ...new Set(
            [...link.matchAll(
                /<\s*(https:\/\/i\.pinimg\.com\/[^>]+)\s*>\s*;\s*rel=preload;\s*as=image/gi
            )].map(v => v[1])
        )
    ].slice(0, limit);

    return {
        query,
        limit,
        total_found: results.length,
        results
    };
}

// ======================================================
// ENDPOINT GET UTAMA
// ======================================================
router.get('/', async (req, res) => {
    const text = req.query.text;

    if (!text) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'text' wajib diisi! Contoh: ?text=anime"
        });
    }

    try {
        const result = await pinterestSearch(text);

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            result,
            metadata: {
                source: 'Pinterest',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: 'Gagal mengambil data Pinterest',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;