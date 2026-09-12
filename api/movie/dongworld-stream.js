/**
 * ✦ Nama Scrape : Dongworld Stream / Video Player
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

function getProviderName(url) {
    if (url.includes('ok.ru') || url.includes('okcdn.ru')) return 'OK.ru';
    if (url.includes('vkvideo.ru') || url.includes('vk.com')) return 'VK Video';
    if (url.includes('drive.google.com') || url.includes('google.usercontent.com')) return 'Google Drive';
    if (url.includes('blogger.com') || url.includes('blogspot.com')) return 'Blogger';
    if (url.includes('dood')) return 'DoodStream';
    if (url.includes('streamtape')) return 'Streamtape';
    if (url.includes('filemoon')) return 'Filemoon';
    return 'Direct Video Stream';
}

function extractAllStreamUrls(html) {
    const streams = [];
    const seen = new Set();

    if (!html) return { direct_bot_link: null, streams: [] };

    const gdriveMatches = [...html.matchAll(/https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/gi)];
    gdriveMatches.forEach(m => {
        const fileId = m[1];
        const directBotUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
        const embedUrl = `https://drive.google.com/file/d/${fileId}/view`;

        if (!seen.has(directBotUrl)) {
            seen.add(directBotUrl);
            streams.push({
                provider: "Google Drive (Direct Bot Link)",
                type: "direct_bot_stream",
                url: directBotUrl
            });
        }

        if (!seen.has(embedUrl)) {
            seen.add(embedUrl);
            streams.push({
                provider: "Google Drive (Embed)",
                type: "embed_player",
                url: embedUrl
            });
        }
    });

    const okRuEmbeds = [...html.matchAll(/https?:\/\/(?:www\.)?ok\.ru\/videoembed\/[0-9]+/gi)];
    okRuEmbeds.forEach(m => {
        const url = m[0];
        if (!seen.has(url)) {
            seen.add(url);
            streams.push({
                provider: "OK.ru",
                type: "embed_player",
                url: url
            });
        }
    });

    const okM3u8Matches = [...html.matchAll(/https?:\\\/\\\/[^\s"'\\]+\.m3u8[^\s"'\\]*/gi)];
    okM3u8Matches.forEach(m => {
        const url = m[0].replace(/\\/g, '');
        if (!seen.has(url)) {
            seen.add(url);
            streams.push({
                provider: "OK.ru (Direct HLS Stream)",
                type: "direct_hls",
                url: url
            });
        }
    });

    const vkMatches = [...html.matchAll(/https?:\/\/(?:www\.)?vkvideo\.ru\/video_ext\.php[^\s"'\\]*/gi)];
    vkMatches.forEach(m => {
        let url = m[0].replace(/\\u0026/g, '&').replace(/\\/g, '');
        if (!seen.has(url)) {
            seen.add(url);
            streams.push({
                provider: "VK Video",
                type: "embed_player",
                url: url
            });
        }
    });

    const genericMatches = [...html.matchAll(/https?:\/\/[^"'\s\\]+\.(?:m3u8|mp4|webm)[^\s"'\\]*/gi)];
    genericMatches.forEach(m => {
        const url = m[0].replace(/\\/g, '');
        if (!seen.has(url) && !url.includes('okcdn.ru')) {
            seen.add(url);
            streams.push({
                provider: getProviderName(url),
                type: "direct_video",
                url: url
            });
        }
    });

    const directBotLink = streams.find(s => s.type === "direct_bot_stream" || s.type === "direct_hls" || s.type === "direct_video")?.url || streams[0]?.url || null;

    return {
        direct_bot_link: directBotLink,
        streams: streams
    };
}

router.get('/', async (req, res) => {
    try {
        const slugInput = req.query.slug || req.query.url;

        if (!slugInput) {
            return res.status(400).json({
                status: false,
                creator: 'ArulzXD',
                message: "Masukkan parameter episode slug/url (contoh: ?slug=battle-through-the-heavens-season-5-episode-1)"
            });
        }

        const slug = slugInput.replace(/,/g, '').replace(`${BASE_URL}/watch/`, '').trim();
        const watchUrl = `${BASE_URL}/watch/${slug}`;
        const html = await fetchUrl(watchUrl);

        if (!html) {
            return res.status(404).json({
                status: false,
                creator: 'ArulzXD',
                message: "Halaman episode tidak ditemukan."
            });
        }

        const streamResult = extractAllStreamUrls(html);

        return res.json({
            status: true,
            creator: 'ArulzXD',
            result: {
                episode_slug: slug,
                direct_bot_link: streamResult.direct_bot_link,
                streams: streamResult.streams
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

router.desc = "Mengambil link streaming/embed video episode donghua dari Dongworld.";
router.paramsConfig = {
    slug: "contoh: battle-through-the-heavens-season-5-episode-1"
};
router.status = "ready";
router.type = "free";

module.exports = router;