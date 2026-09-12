/**
 * ✦ Nama Scrape : Dongworld Detail
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

function formatTitle(slug) {
    if (!slug) return "";
    return slug
        .replace(/,/g, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

router.get('/', async (req, res) => {
    try {
        const slugInput = req.query.slug || req.query.url;

        if (!slugInput) {
            return res.status(400).json({
                status: false,
                creator: 'ArulzXD',
                message: "Masukkan parameter slug atau url (contoh: ?slug=battle-through-the-heavens)"
            });
        }

        const slug = slugInput.replace(/,/g, '').replace(`${BASE_URL}/series/`, '').trim();
        const seriesUrl = `${BASE_URL}/series/${slug}`;
        const html = await fetchUrl(seriesUrl);

        if (!html) {
            return res.status(404).json({
                status: false,
                creator: 'ArulzXD',
                message: "Series donghua tidak ditemukan."
            });
        }

        const item = {
            title: formatTitle(slug),
            slug: slug,
            url: seriesUrl,
            thumbnail: null,
            description: null,
            status: html.toLowerCase().includes('completed') ? "Completed" : "Ongoing",
            total_episodes: 0,
            episodes: []
        };

        const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
        if (descMatch) item.description = descMatch[1];

        const imgMatch = html.match(/\/api\/image\?path=([^\s\"\'&]+)/);
        if (imgMatch) item.thumbnail = `${BASE_URL}/api/image?path=${imgMatch[1]}`;

        const seenEpSlugs = new Set();

        const epMatches = [...html.matchAll(/{"id":\d+,"series_id":\d+,"episode_number":(\d+),"slug":"([^"]+)"/g)];
        epMatches.forEach(m => {
            const epNum = parseInt(m[1], 10);
            const epSlug = m[2];
            if (!seenEpSlugs.has(epSlug)) {
                seenEpSlugs.add(epSlug);
                item.episodes.push({
                    episode_number: epNum,
                    title: `Episode ${epNum}`,
                    slug: epSlug,
                    url: `${BASE_URL}/watch/${epSlug}`
                });
            }
        });

        item.total_episodes = item.episodes.length;

        return res.json({
            status: true,
            creator: 'ArulzXD',
            result: item
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

router.desc = "Mengambil detail donghua beserta daftar episode lengkap dari Dongworld.";
router.paramsConfig = {
    slug: "contoh: battle-through-the-heavens"
};
router.status = "ready";
router.type = "free";

module.exports = router;