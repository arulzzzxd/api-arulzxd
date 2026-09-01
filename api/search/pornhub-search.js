const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();

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

        // Parsing berbasis selector DOM Pornhub
        $('ul.videos.search-video-thumbs li.videoBlock, ul.videos li.pcVideoListItem').each((_, el) => {
            const $el = $(el);
            
            // Ambil Judul & Link
            const titleEl = $el.find('.title a, span.title a').first();
            const title = titleEl.attr('title') || titleEl.text().trim();
            let link = titleEl.attr('href');

            if (!link || !link.includes('/view_video.php')) return;
            if (!link.startsWith('http')) link = `https://www.pornhub.com${link}`;

            // Ambil Durasi (Mendukung var.duration / .duration / attribute data-duration)
            let duration = $el.find('var.duration, .duration, span.time').text().trim();
            if (!duration) {
                duration = $el.find('[data-duration]').attr('data-duration') || '-';
            }

            // Ambil Views
            let views = $el.find('.views var, span.views, .videoDetailsBlock .views').text().trim();
            if (!views) {
                views = '-';
            }

            // Ambil Thumbnail (Opsional)
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

        // Fallback Regex jika Cheerio tidak menemukan elemen akibat struktur inline script
        if (!results.length) {
            const fallbackRegex = /<li[^>]*class="[^"]*videoBlock[^"]*"[\s\S]*?<a href="(\/view_video\.php\?viewkey=[^"]+)"[^>]*title="([^"]+)"[\s\S]*?(?:<var class="duration">([^<]+)<\/var>|<span class="duration">([^<]+)<\/span>)?[\s\S]*?(?:<span class="views"><var>([^<]+)<\/var>|<span class="views">([^<]+)<\/span>)?/g;
            let match;
            const added = new Set();

            while ((match = fallbackRegex.exec(html)) !== null) {
                const vUrl = `https://www.pornhub.com${match[1]}`;
                if (!added.has(vUrl)) {
                    added.add(vUrl);
                    results.push({
                        title: match[2].trim(),
                        url: vUrl,
                        duration: (match[3] || match[4] || '-').trim(),
                        views: (match[5] || match[6] || '-').trim()
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