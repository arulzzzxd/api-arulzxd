const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');

const router = express.Router();

class DracinStream {
    constructor() {
        this.baseUrl = 'https://dracinema.com';
        this.htmlClient = axios.create({
            timeout: 15000,
            validateStatus: status => status < 500, // Menghindari crash otomatis axios saat 404
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

    _cleanPath(playPathOrUrl) {
        let raw = playPathOrUrl.trim().replace(/^\/+/, '');
        if (raw.startsWith('play/')) {
            return `/${raw}`;
        }
        return `/play/${raw}`;
    }

    async getStream(playPathOrUrl) {
        const cleanPath = this._cleanPath(playPathOrUrl);
        
        const response = await this.htmlClient.get(`${this.baseUrl}${cleanPath}`);
        
        if (response.status === 404) {
            throw { status: 404, message: "Halaman/Episode tidak ditemukan di Dracinema." };
        }

        const html = response.data;
        if (typeof html !== 'string') {
            throw { status: 500, message: "Gagal memuat struktur HTML dari target." };
        }
        
        // 1. Ekstraksi chunk data Next.js App Router
        const regex = /self\.__next_f\.push\(\[\d+,\s*"(.*)"\]\)/g;
        let match;
        let mergedText = html; // Gabungkan HTML asli untuk jaga-jaga
        
        while ((match = regex.exec(html)) !== null) {
            let chunk = match[1]
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')
                .replace(/\\\//g, '/');
            mergedText += chunk;
        }
        
        let videoUrls = [];

        // 2. Ekstraksi JSON "videoUrls"
        const videoRegex = /"videoUrls"\s*:\s*(\[[\s\S]*?\])/;
        const videoMatch = mergedText.match(videoRegex);
        
        if (videoMatch) {
            try {
                // Bersihkan escape unicode jika ada
                const unescapedJson = videoMatch[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, m) => String.fromCharCode(parseInt(m, 16)));
                const parsed = JSON.parse(unescapedJson);
                
                videoUrls = parsed.map(v => {
                    if (typeof v === 'string') {
                        return { quality: 720, url: v, cdn: 'Server Utama' };
                    }
                    return {
                        quality: v.quality || 720,
                        url: v.url || '',
                        cdn: v.cdn || 'Server Utama'
                    };
                }).filter(v => v.url && v.url.startsWith('http'));
            } catch (_) {
                // Manual regex parsing jika JSON.parse gagal karena string terpotong
                const urlRegex = /"(?:url|src)"\s*:\s*"([^"]+\.(?:m3u8|mp4)[^"]*)"/gi;
                let urlMatch;
                while ((urlMatch = urlRegex.exec(videoMatch[1])) !== null) {
                    let streamUrl = urlMatch[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, m) => String.fromCharCode(parseInt(m, 16)));
                    videoUrls.push({ quality: 720, url: streamUrl, cdn: 'Server Utama' });
                }
            }
        }

        // 3. Pencarian langsung tautan m3u8/mp4 jika poin #2 tidak menemukan tautan
        if (videoUrls.length === 0) {
            const directRegex = /https?:\/\/[^\s"']+\.(?:m3u8|mp4)[^\s"']*/gi;
            const directMatches = html.match(directRegex) || [];
            videoUrls = [...new Set(directMatches)].map(u => ({ quality: 720, url: u, cdn: 'Direct Stream' }));
        }

        // Jika tidak ada sumber video sama sekali
        if (videoUrls.length === 0) {
            throw { status: 404, message: "Link streaming video tidak ditemukan pada halaman ini." };
        }

        // 4. Ekstraksi episode navigasi
        const $ = cheerio.load(html);
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
        const path = req.query.path;

        if (!path) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Masukkan parameter path streaming (contoh: ?path=play/mahkota-cahaya-untuk-istri-apollo-ns-2064962492755087362/1)"
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
    path: "Path episode streaming (contoh: play/mahkota-cahaya-untuk-istri-apollo-ns-2064962492755087362/1)"
};
router.status = "ready";
router.type = "free";

module.exports = router;
