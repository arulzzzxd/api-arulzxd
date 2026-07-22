const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();

// Helper to format duration
function formatDuration(durationStr) {
    if (!durationStr) return "00.00";
    return durationStr.trim().replace(/:/g, '.');
}

// ======================================================
// CORE XNXX SEARCH FUNCTION WITH DYNAMIC RANDOM PAGE
// ======================================================
async function xnxxSearch(searchQuery) {
    const parts = searchQuery.trim().split(/\s+/);
    const limit = /^\d+$/.test(parts[parts.length - 1])
        ? Math.min(20, Math.max(1, parseInt(parts.pop())))
        : 5;
    const query = parts.join(' ').trim();

    const headers = {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'referer': 'https://www.xnxx.com/',
        'accept-language': 'en-US,en;q=0.9'
    };

    // 1. Fetch the first page to determine how many pages exist
    const initialUrl = `https://www.xnxx.com/search/${encodeURIComponent(query)}/1`;
    const { data } = await axios.get(initialUrl, { headers });
    const $ = cheerio.load(data);

    // 2. Determine Max Pages: Extract the last page number from pagination
    // This assumes standard pagination structure usually found in '.pagination'
    let maxPages = 1;
    const paginationLinks = $('.pagination li a');
    if (paginationLinks.length > 0) {
        // Look for the "Last" or highest number link
        const lastPage = parseInt(paginationLinks.last().attr('href')?.split('/').pop()) || 1;
        maxPages = lastPage;
    }

    // 3. Generate Random Page within valid range (Max 50 to avoid scraping deep)
    const safeMax = Math.min(maxPages, 50); 
    const randomPage = Math.floor(Math.random() * safeMax) + 1;

    // 4. Fetch the randomized page
    const finalUrl = `https://www.xnxx.com/search/${encodeURIComponent(query)}/${randomPage}`;
    const { data: pageData } = await axios.get(finalUrl, { headers });
    const $p = cheerio.load(pageData);
    const results = [];

    $p('.mozaique .thumb-block').each((index, element) => {
        if (results.length >= limit) return false;
        
        const title = $p(element).find('.thumb-under a').first().text().trim() || $p(element).find('a').attr('title');
        let link = $p(element).find('.thumb-under a').attr('href') || $p(element).find('a').attr('href');
        if (link && !link.startsWith('http')) link = `https://www.xnxx.com${link}`;
        const thumbnail = $p(element).find('img').attr('data-src') || $p(element).find('img').attr('src');
        const duration = formatDuration($p(element).find('.duration').first().text().trim());

        if (title && link) results.push({ title, duration, thumbnail, link });
    });

    return {
        query,
        page: randomPage,
        limit,
        total_found: results.length,
        results
    };
}

// Router remains largely the same
router.get('/', async (req, res) => {
const apikey = req.query.apikey;
    const queryParam = req.query.query;

if (!apikey) {
        return res.status(403).json({
            status: false,
            creator: "Arulzxd",
            message: "API Key mana? masukkan parameter ?apikey=MasukkanApiKey"
        });
    }

    // 2. Validasi kecocokan nilai API Key
    if (apikey !== 'arulzxd-keys') {
        return res.status(403).json({
            status: false,
            creator: "Arulzxd",
            message: "API Key salah / tidak valid!"
        });
    }
    if (!queryParam) {
        return res.status(400).json({ status: false, message: "Parameter 'query' is required." });
    }

    try {
        const result = await xnxxSearch(queryParam);
        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            result,
            metadata: { source: 'XNXX', timestamp: new Date().toISOString() }
        });
    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
});

router.status = "ready"; 
router.type = "premium";
module.exports = router;