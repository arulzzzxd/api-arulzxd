const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const fetch = require('node-fetch');

// ======================================================
// UTILITY / HELPER FUNCTIONS (MENGGUNAKAN FETCH)
// ======================================================

// Mengonversi string ukuran file ke angka biner
function parseFileSize(size) {
    if (!size) return 0;
    return parseFloat(size) * (/GB/i.test(size)
        ? 1000000
        : /MB/i.test(size)
            ? 1000
            : /KB/i.test(size)
                ? 1
                : /bytes?/i.test(size)
                    ? 0.001
                    : /B/i.test(size)
                        ? 0.1
                        : 0);
}

// Mengambil ukuran file langsung dari header link unduhan dengan FETCH
async function getFileSize(downloadLink) {
    if (!downloadLink) return '0';
    try {
        const response = await fetch(downloadLink, { method: 'HEAD' });
        const contentLength = response.headers.get('content-length');

        if (contentLength) {
            const fileSizeInBytes = parseInt(contentLength);

            if (fileSizeInBytes < 1024) {
                return `${fileSizeInBytes} bytes`;
            } else if (fileSizeInBytes < 1024 * 1024) {
                const fileSizeInKb = fileSizeInBytes / 1024;
                return `${fileSizeInKb.toFixed(2)} KB`;
            } else if (fileSizeInBytes < 1024 * 1024 * 1024) {
                const fileSizeInMb = fileSizeInBytes / (1024 * 1024);
                return `${fileSizeInMb.toFixed(2)} MB`;
            } else {
                const fileSizeInGb = fileSizeInBytes / (1024 * 1024 * 1024);
                return `${fileSizeInGb.toFixed(2)} GB`;
            }
        }
        return '0';
    } catch {
        return '0';
    }
}

// Mengonversi format ISO 8601 (PTXMYSR) ke total detik
function parseISO8601(durationString) {
    if (!durationString) return 0;
    const matches = durationString.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
    if (!matches) return 0;
    const hours = parseInt(matches[1] || 0);
    const minutes = parseInt(matches[2] || 0);
    const seconds = parseInt(matches[3] || 0);
    return (hours * 3600) + (minutes * 60) + seconds;
}

// Mengonversi detik ke format waktu digital (HH:mm:ss atau mm:ss)
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return "00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// ======================================================
// CORE XVIDEOS DOWNLOADER FUNCTION (FIXED TOTAL)
// ======================================================
async function xvideosdl(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });
        const html = await response.text();
        const $ = cheerio.load(html);

        // Scraping data metadata standar bawaanmu
        const title = $("meta[property='og:title']").attr("content");
        const views = $("div#video-tabs > div > div > div > div > strong.mobile-hide").text().trim() + " views";
        const vote = $("div.rate-infos > span.rating-total-txt").text().trim();
        const likes = $("span.rating-good-nbr").text().trim();
        const deslikes = $("span.rating-bad-nbr").text().trim();
        const thumb = $("meta[property='og:image']").attr("content");

        // 1. DURATION FIX: Melacak durasi dari berbagai celah (JSON-LD & Script Player)
        let durationSec = 0;
        
        try {
            const jsonLdText = $('script[type="application/ld+json"]').html();
            if (jsonLdText) {
                const jsonData = JSON.parse(jsonLdText);
                const isoDuration = jsonData?.duration || jsonData['@graph']?.find(x => x.duration)?.duration;
                if (isoDuration) durationSec = parseISO8601(isoDuration);
            }
        } catch (e) {}

        if (durationSec === 0) {
            const metaDuration = $('meta[property="video:duration"]').attr('content') || $('meta[itemprop="duration"]').attr('content');
            if (metaDuration) {
                durationSec = /^\d+$/.test(metaDuration) ? parseInt(metaDuration) : parseISO8601(metaDuration);
            }
        }

        if (durationSec === 0) {
            // Cek langsung ke dalam baris script raw HTML jika meta tag diblokir
            const scriptMatch = html.match(/html5player\.setDuration\((\d+)\)/) || html.match(/"duration"\s*:\s*(\d+)/);
            if (scriptMatch) durationSec = parseInt(scriptMatch[1]);
        }

        const duration = formatDuration(durationSec);

        // 2. URL DOWNLOAD FIX: Ambil semua varian resolusi dari script internal player
        const url_low = (html.match(/html5player\.setVideoUrlLow\('([^']+)'\)/) || [])[1] || '';
        const url_high = (html.match(/html5player\.setVideoUrlHigh\('([^']+)'\)/) || [])[1] || '';
        const url_hls = (html.match(/html5player\.setVideoHLS\('([^']+)'\)/) || [])[1] || '';

        // Ambil ukuran file Low & High secara bersamaan (paralel)
        const [size_low, size_high] = await Promise.all([
            getFileSize(url_low),
            getFileSize(url_high)
        ]);

        return {
            title,
            duration, 
            views,
            vote,
            likes,
            deslikes,
            thumb,
            downloads: {
                low: {
                    url: url_low,
                    size: size_low,
                    sizeB: parseFileSize(size_low)
                },
                high: {
                    url: url_high,
                    size: size_high,
                    sizeB: parseFileSize(size_high)
                },
                hls: {
                    url: url_hls,
                    size: "Variable (Streaming)",
                    sizeB: 0
                }
            }
        };
    } catch (error) {
        throw error;
    }
}

// ======================================================
// ENDPOINT GET UTAMA
// ======================================================
router.get('/', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'url' wajib diisi! Contoh: ?url=https://www.xvideos.com/video-xxxxxx/..."
        });
    }

    try {
        const result = await xvideosdl(url);

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            result,
            metadata: {
                source: 'XVideos Downloader Multi-Resolution',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: 'Gagal mengambil data video XVideos',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

router.status = "ready"; 
router.type = "premium";
module.exports = router;