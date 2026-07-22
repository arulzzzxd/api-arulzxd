const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();

// ======================================================
// HELPER: FORMAT DURATION DYNAMICALLY ACCORDING TO VIDEO
// ======================================================
function formatDuration(durationStr) {
    if (!durationStr) return "00.00";

    if (/^[\d:.]+$/.test(durationStr.trim())) {
        return durationStr.trim().replace(/:/g, '.');
    }

    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    const hMatch = durationStr.match(/(\d+)\s*(h|hour|jam)/i);
    const mMatch = durationStr.match(/(\d+)\s*(m|min|menit)/i);
    const sMatch = durationStr.match(/(\d+)\s*(s|sec|detik)/i);

    if (hMatch) hours = parseInt(hMatch[1]);
    if (mMatch) minutes = parseInt(mMatch[1]);
    if (sMatch) seconds = parseInt(sMatch[1]);

    const pad = (num) => String(num).padStart(2, '0');

    if (hours > 0) {
        return `${pad(hours)}.${pad(minutes)}.${pad(seconds)}`;
    }
    
    return `${pad(minutes)}.${pad(seconds)}`;
}

// ======================================================
// CORE XVIDEOS SEARCH FUNCTION WITH RANDOM PAGE
// ======================================================
async function xvideosSearch(searchQuery) {
    const parts = searchQuery.trim().split(/\s+/);

    // Mengambil angka di akhir teks untuk limit, default adalah 5 jika tidak diisi
    const limit = /^\d+$/.test(parts[parts.length - 1])
        ? Math.min(20, Math.max(1, parseInt(parts.pop()))) 
        : 5;

    const query = parts.join(' ').trim();

    // FITUR: Generate halaman acak dari page 1 sampai 20 agar hasil selalu fresh
    const randomPage = Math.floor(Math.random() * 20) + 1;

    const headers = {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'referer': 'https://www.xvideos.com/',
        'accept-language': 'en-US,en;q=0.9'
    };

    // Menambahkan parameter &p= untuk menembak halaman acak
    const url = `https://www.xvideos.com/?k=${encodeURIComponent(query)}&p=${randomPage}`;

    const { data } = await axios.get(url, { headers });
    const $ = cheerio.load(data);
    const results = [];

    $('.mozaique .thumb-block').each((index, element) => {
        if (results.length >= limit) return false;

        const titleElement = $(element).find('.thumb-under a, p.title a').first();
        const title = titleElement.attr('title') || titleElement.text().trim() || $(element).find('a').attr('title');
        
        let link = titleElement.attr('href') || $(element).find('a').attr('href');
        
        if (link && !link.startsWith('http')) {
            link = `https://www.xvideos.com${link}`;
        }

        const thumbnail = $(element).find('img').attr('data-src') || $(element).find('img').attr('src');
        const rawDuration = $(element).find('.duration').first().text().trim();
        const duration = formatDuration(rawDuration);

        if (title && link) {
            results.push({
                title,
                duration,
                thumbnail,
                link
            });
        }
    });

    return {
        query,
        page: randomPage, // Menampilkan info halaman berapa yang sedang diacak
        limit,
        total_found: results.length,
        results
    };
}

// ======================================================
// ENDPOINT GET UTAMA (STRICT QUERY)
// ======================================================
router.get('/', async (req, res) => {
    const queryParam = req.query.query;

    if (!queryParam) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'query' wajib diisi! Contoh: ?query=Jepang 10"
        });
    }

    try {
        const result = await xvideosSearch(queryParam);

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            result,
            metadata: {
                source: 'XVideos',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: 'Gagal mengambil data XVideos',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

router.status = "ready"; 
router.type = "premium";
module.exports = router;