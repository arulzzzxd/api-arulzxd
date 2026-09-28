const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');

const router = express.Router();

class DracinStream {
    constructor() {
        this.baseUrl = 'https://dracinema.com';
        this.htmlClient = axios.create({
            timeout: 15000,
            validateStatus: status => status < 500,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
    }

    _sanitizeText(text) {
        if (!text) return '';
        return text
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    _normalizeTitle(title) {
        if (!title) return '';
        let cleaned = this._sanitizeText(title);
        return cleaned
            .replace(/\s+Full\s+Episode\s+Subtitle\s+Indonesia\s+-\s+Dracinema/gi, '')
            .replace(/\s+Sub\s+Indo\s+-\s+Dracinema/gi, '')
            .replace(/\s+-\s+Dracinema/gi, '')
            .trim();
    }

    _cleanPath(input) {
        if (!input) return '';
        let cleaned = input.trim();
        
        // Jika parameter berupa URL lengkap, ambil pathname-nya saja
        if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
            try {
                const parsed = new URL(cleaned);
                cleaned = parsed.pathname;
            } catch (_) {}
        }
        
        cleaned = cleaned.replace(/^\/+/, '');
        if (!cleaned.startsWith('play/')) {
            cleaned = `play/${cleaned}`;
        }
        return `/${cleaned}`;
    }

    async getStream(playPathOrUrl) {
        const cleanPath = this._cleanPath(playPathOrUrl);
        const targetUrl = `${this.baseUrl}${cleanPath}`;
        
        const response = await this.htmlClient.get(targetUrl);
        
        if (response.status === 404) {
            throw { status: 404, message: `Halaman episode tidak ditemukan di Dracinema (${cleanPath}).` };
        }

        const html = response.data;
        if (typeof html !== 'string') {
            throw { status: 500, message: "Gagal memuat HTML dari server target." };
        }

        let videoUrls = [];

        // 1. Ekstraksi Next.js App Router Chunks
        const regex = /self\.__next_f\.push\(\[\d+,\s*"(.*)"\]\)/g;
        let match;
        let mergedText = html;
        
        while ((match = regex.exec(html)) !== null) {
            let chunk = match[1]
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')
                .replace(/\\\//g, '/');
            mergedText += chunk;
        }

        // 2. Cari dari JSON "videoUrls"
        const videoRegex = /"videoUrls"\s*:\s*(\[[\s\S]*?\])/;
        const videoMatch = mergedText.match(videoRegex);
        
        if (videoMatch) {
            try {
                const unescapedJson = videoMatch[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, m) => String.fromCharCode(parseInt(m, 16)));
                const parsed = JSON.parse(unescapedJson);
                
                videoUrls = parsed.map(v => {
                    if (typeof v === 'string') return { quality: 720, url: v, cdn: 'Server Utama' };
                    return { quality: v.quality || 720, url: v.url || '', cdn: v.cdn || 'Server Utama' };
                }).filter(v => v.url && v.url.startsWith('http'));
            } catch (_) {}
        }

        // 3. Cari Tag HTML <video>, <source>, atau <iframe> jika JSON kosong
        const $ = cheerio.load(html);
        if (videoUrls.length === 0) {
            $('video source, video, iframe').each((_, el) => {
                const src = $(el).attr('src');
                if (src && (src.includes('.m3u8') || src.includes('.mp4') || src.includes('embed'))) {
                    videoUrls.push({ quality: 720, url: src, cdn: 'Player Embed' });
                }
            });
        }

        // 4. Fallback Regex M3U8/MP4 langsung
        if (videoUrls.length === 0) {
            const directRegex = /https?:\/\/[^\s"']+\.(?:m3u8|mp4)[^\s"']*/gi;
            const directMatches = html.match(directRegex) || [];
            videoUrls = [...new Set(directMatches)].map(u => ({ quality: 720, url: u, cdn: 'Direct Stream' }));
        }

        if (videoUrls.length === 0) {
            throw { status: 404, message: "Link streaming video tidak ditemukan pada halaman episode ini." };
        }

        // Ekstraksi episode navigasi
        const navEpisodes = [];
        $('a[href*="/play/"]').each((i, el) => {
            const href = $(el).attr('href') || '';
            const parts = href.replace(/\/$/, '').split('/');
            const epsNum = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(epsNum) && !navEpisodes.some(ep => ep.number === epsNum)) {
                navEpisodes.push({ 
                    title: `Episode ${epsNum}`, 
                    url: href.startsWith('/') ? href : `/${href}`, 
                    number: epsNum 
                });
            }
        });
        navEpisodes.sort((a, b) => a.number - b.number);

        const title = this._normalizeTitle($('title').text().trim());

        return { 
            title: title || 'Dracinema Streaming', 
            videoSources: videoUrls, 
            availableEpisodes: navEpisodes 
        };
    }
}

const scraper = new DracinStream();

router.get('/', async (req, res) => {
    try {
        const path = req.query.path || req.query.url;

        if (!path) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Masukkan parameter path streaming. Contoh: ?path=play/mahkota-cahaya-untuk-istri-apollo-ns-2064962492755087362/1"
            });
        }

        const data = await scraper.getStream(path);
        return res.json({
            status: true,
            creator: "ArulzXD",
            result: data
        });
    } catch (err) {
        const statusCode = err.status || 500;
        return res.status(statusCode).json({
            status: false,
            creator: "ArulzXD",
            message: err.message || "Gagal memproses permintaan streaming."
        });
    }
});

router.desc = "Mengambil link streaming video murni tanpa fallback dari Dracinema.";
router.paramsConfig = {
    path: "Path atau URL episode streaming"
};
router.status = "ready";
router.type = "free";

module.exports = router;
