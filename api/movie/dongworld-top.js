/**
 * ✦ Nama Scrape : Dongworld Top / Popular
 * ✦ Base Site   : dongworld.top
 * ✦ Author      : ArulzXD
 */

const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const router = express.Router();

const BASE_URL = 'https://www.dongworld.top';
const HEADERS = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
};

function fetchUrl(url) {
    return new Promise((resolve) => {
        try {
            const parsedUrl = new URL(url);
            const client = parsedUrl.protocol === 'https:' ? https : http;
            
            const req = client.get(url, { headers: HEADERS, timeout: 15000 }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = new URL(res.headers.location, url).href;
                    return resolve(fetchUrl(redirectUrl));
                }
                
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(data));
            });
            
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
        } catch (e) {
            resolve(null);
        }
    });
}

function parseSeriesCards(html) {
    const results = [];
    if (!html) return results;

    const seriesMatches = [...html.matchAll(/{"id":(\d+),"name":"([^"]+)",(?:.*?"slug":"([^"]+)")?/g)];
    const seenSlugs = new Set();

    seriesMatches.forEach(m => {
        const id = m[1];
        const name = m[2];
        const slug = (m[3] || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/,/g, '').replace(/(^-|-$)/g, '');
        
        if (!seenSlugs.has(slug) && slug.length > 1 && slug !== 'series' && slug !== 'watch') {
            seenSlugs.add(slug);
            
            const imgMatch = html.match(new RegExp(`storage\\\\?/series\\\\?/([^"'\\s]+\\.webp)`));
            const thumbnail = imgMatch ? `${BASE_URL}/api/image?path=storage/series/${imgMatch[1]}` : null;

            results.push({
                id: parseInt(id, 10),
                title: name,
                slug: slug,
                url: `${BASE_URL}/series/${slug}`,
                thumbnail: thumbnail
            });
        }
    });

    return results;
}

router.get('/', async (req, res) => {
    try {
        const html = await fetchUrl(BASE_URL);
        const items = parseSeriesCards(html);

        return res.json({
            status: true,
            creator: 'ArulzXD',
            result: {
                category: "Top / Popular Donghua",
                total: items.length,
                items: items
            }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            creator: 'ArulzXD',
            message: err.message || 'Terjadi kesalahan pada server.'
        });
    }
});

router.desc = "Mengambil daftar donghua populer/top dari halaman utama Dongworld.";
router.paramsConfig = {};
router.status = "ready";
router.type = "free";

module.exports = router;