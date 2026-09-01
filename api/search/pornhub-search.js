const axios = require('axios');
const express = require('express');
const router = express.Router();

async function searchPornhub(query) {
    try {
        const searchUrl = `https://www.pornhub.com/video/search?search=${encodeURIComponent(query)}`;
        const { data: html } = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cookie': 'age_verified=1'
            },
            timeout: 15000
        });

        const results = [];
        const videoRegex = /<li class="[^"]*videoBlock[^"]*"[\s\S]*?<a href="(\/view_video\.php\?viewkey=[^"]+)" title="([^"]+)"[\s\S]*?<var class="duration">([^<]+)<\/var>[\s\S]*?<span class="views"><var>([^<]+)<\/var>/g;
        let match;
        while ((match = videoRegex.exec(html)) !== null) {
            results.push({
                title: match[2].trim(),
                url: `https://www.pornhub.com${match[1]}`,
                duration: match[3].trim(),
                views: match[4].trim()
            });
        }

        if (!results.length) {
            const simpleRegex = /href="(\/view_video\.php\?viewkey=[a-zA-Z0-9]+)" title="([^"]+)"/g;
            let m;
            const added = new Set();
            while ((m = simpleRegex.exec(html)) !== null) {
                const vUrl = `https://www.pornhub.com${m[1]}`;
                if (!added.has(vUrl)) {
                    added.add(vUrl);
                    results.push({
                        title: m[2].trim(),
                        url: vUrl,
                        duration: '-',
                        views: '-'
                    });
                }
            }
        }

        return results;
    } catch (err) {
        console.error('[Pornhub Direct Scraper Search Error]', err.message);
        throw err;
    }
}

// Endpoint utama Router
router.get('/', async (req, res) => {
    try {
        const query = req.query.query;

        if (!query) {
            return res.status(400).json({
                status: false,
                error: 'Parameter "q" atau "query" wajib diisi.'
            });
        }

        const results = await searchPornhub(query);
        
        return res.status(200).json({
            status: true,
            total: results.length,
            result: results
        });
    } catch (error) {
        return res.status(500).json({
            status: false,
            error: error.message
        });
    }
});

router.status = "ready";
router.type = "free";
module.exports = router;