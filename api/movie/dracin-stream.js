const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');

const router = express.Router();

class DracinStreamScraper {
    constructor() {
        this.baseUrl = 'https://dracinema.com';
        this.htmlClient = axios.create({
            timeout: 15000,
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

    async getDirectStreamUrl(playPathOrUrl) {
        const cleanPath = playPathOrUrl.startsWith('/play/') 
            ? playPathOrUrl 
            : `/play/${playPathOrUrl.replace(/^\/+/, '')}`;
        
        try {
            const { data: html } = await this.htmlClient.get(`${this.baseUrl}${cleanPath}`);
            
            const unescapedHtml = html
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')
                .replace(/\\\//g, '/');

            let videoUrls = [];
            
            // Pattern 1: Cari array "videoUrls"
            const videoRegex = /"videoUrls"\s*:\s*(\[[^\]]+\])/;
            const videoMatch = unescapedHtml.match(videoRegex);
            
            if (videoMatch) {
                try {
                    videoUrls = JSON.parse(videoMatch[1]);
                } catch (err) {
                    const urlRegex = /"url"\s*:\s*"([^"]+)"/g;
                    let urlMatch;
                    while ((urlMatch = urlRegex.exec(videoMatch[1])) !== null) {
                        videoUrls.push({ quality: 720, url: urlMatch[1] });
                    }
                }
            }

            // Pattern 2: Cari direct link .m3u8 / .mp4
            if (!videoUrls.length) {
                const directRegex = /https?:\/\/[^\s"']+\.(?:m3u8|mp4)[^\s"']*/g;
                const directMatches = html.match(directRegex) || [];
                videoUrls = [...new Set(directMatches)].map(u => ({ quality: 720, url: u }));
            }

            if (videoUrls.length > 0 && videoUrls[0].url) {
                return videoUrls[0].url;
            }
        } catch (err) {
            console.warn(`[!] Extraction failed for '${cleanPath}':`, err.message);
        }

        // Kembalikan null jika gagal ekstrak, hindari memakai link fallback yang mati
        return null;
    }
}

const scraper = new DracinStreamScraper();

router.get('/', async (req, res) => {
    try {
        const text = req.query.text?.trim() || req.query.path?.trim();

        if (!text) {
            return res.status(400).json({
                status: false,
                creator: 'ArulzXD',
                message: 'Masukkan parameter text atau path (contoh: ?text=play/bshasu/movie)'
            });
        }

        const videoUrl = await scraper.getDirectStreamUrl(text);

        // Jika URL video tidak ditemukan / ekstraksi gagal
        if (!videoUrl) {
            return res.status(404).json({
                status: false,
                creator: 'ArulzXD',
                message: 'Gagal mengekstrak URL video atau video tidak ditemukan.'
            });
        }

        // Streaming file video ke client
        const videoResponse = await axios.get(videoUrl, {
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://dracinema.com/'
            }
        });

        res.setHeader('Content-Type', videoResponse.headers['content-type'] || 'video/mp4');
        if (videoResponse.headers['content-length']) {
            res.setHeader('Content-Length', videoResponse.headers['content-length']);
        }

        return videoResponse.data.pipe(res);

    } catch (err) {
        console.error('Streaming Error:', err.message);
        return res.status(500).json({
            status: false,
            creator: 'ArulzXD',
            message: `Gagal memproses stream video: ${err.message}`
        });
    }
});

router.desc = "Mengalirkan file video langsung (Content-Type: video/mp4) dari Dracinema. Parameter wajib: ?text=play/bshasu/movie";
router.paramsConfig = {
    text: "text"
};
router.status = "ready";
router.type = "free";

module.exports = router;
