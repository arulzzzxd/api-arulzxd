const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();

// Helper untuk membersihkan teks views yang berulang (misal: "74.1K74.1K" -> "74.1K")
function cleanViews(rawViews) {
    if (!rawViews) return '-';
    const trimmed = rawViews.trim();
    
    // Jika teks terduplikasi persis setengahnya (misal "74.1K74.1K" atau "10M10M")
    const halfLen = trimmed.length / 2;
    if (trimmed.length % 2 === 0 && trimmed.slice(0, halfLen) === trimmed.slice(halfLen)) {
        return trimmed.slice(0, halfLen);
    }
    
    // Ambil pola angka + suffix (misal "74.1K", "1.2M", "500")
    const match = trimmed.match(/\d+(?:\.\d+)?[KMGT]?/i);
    return match ? match[0] : trimmed;
}

async function searchPornhub(query) {
    try {
        const searchUrl = `https://www.pornhub.com/video/search?search=${encodeURIComponent(query)}`;
        const { data: html } = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cookie': 'age_verified=1'
            },
            timeout: 15000
        });

        const $ = cheerio.load(html);
        const results = [];

        $('ul.videos.search-video-thumbs li.videoBlock, ul.videos li.pcVideoListItem').each((_, el) => {
            const $el = $(el);
            
            // Ambil Judul & Link
            const titleEl = $el.find('.title a, span.title a').first();
            const title = titleEl.attr('title') || titleEl.text().trim();
            let link = titleEl.attr('href');

            if (!link || !link.includes('/view_video.php')) return;
            if (!link.startsWith('http')) link = `https://www.pornhub.com${link}`;

            // Ambil Durasi
            let duration = $el.find('var.duration').text().trim() || $el.find('.duration').text().trim() || '-';
            duration = duration.replace(/\s+/g, ' ');

            // Ambil Views (spesifik ambil teks var pertama agar tidak duplikat)
            let rawViews = $el.find('.views var').first().text().trim() 
                        || $el.find('span.views').contents().filter((_, node) => node.type === 'text').text().trim()
                        || $el.find('.views').text().trim();

            const views = cleanViews(rawViews);
            const thumbnail = $el.find('img').attr('data-mediumhint') || $el.find('img').attr('src') || '';

            if (title && link) {
                results.push({
                    title,
                    url: link,
                    duration,
                    views,
                    thumbnail
                });
            }
        });

        // Fallback Regex
        if (!results.length) {
            const fallbackRegex = /<li[^>]*class="[^"]*videoBlock[^"]*"[\s\S]*?<a href="(\/view_video\.php\?viewkey=[^"]+)"[^>]*title="([^"]+)"[\s\S]*?<var class="duration">([^<]+)<\/var>[\s\S]*?<span class="views">(?:<var>)?([^<]+)(?:<\/var>)?<\/span>/g;
            let match;
            const added = new Set();

            while ((match = fallbackRegex.exec(html)) !== null) {
                const vUrl = `https://www.pornhub.com${match[1]}`;
                if (!added.has(vUrl)) {
                    added.add(vUrl);
                    results.push({
                        title: match[2].trim(),
                        url: vUrl,
                        duration: match[3].trim(),
                        views: cleanViews(match[4]),
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
router.type = "premium";
module.exports = router;