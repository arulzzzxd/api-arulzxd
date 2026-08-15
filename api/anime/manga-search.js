/**
 * NAMA SCRAPE  :: ROSY SCANS SEARCH
 * [•] BASIS        :: rosyscans.id
 */

const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();

async function searchManga(keyword) {
    const query = encodeURIComponent(keyword);
    const url = `https://cors.caliph.my.id/https://rosyscans.id/?s=${query}`;

    try {
        const { data: htmlContent } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(htmlContent);
        const searchResults = [];

        $('.postbody .listupd .bsx').each((_, el) => {
            const typeClass = $(el).find('.limit .type').attr('class') || '';
            const type = typeClass.replace('type ', '').trim();

            searchResults.push({
                title: $(el).find('.tt').text().trim(),
                chapter: $(el).find('.epxs').text().trim(),
                url: $(el).find('a').attr('href'),
                image: $(el).find('img').attr('src'),
                type: type
            });
        });

        return searchResults;

    } catch (error) {
        throw error;
    }
}

// Endpoint GET /
router.get('/', async (req, res) => {
    const query = req.query.query;

    if (!query) {
        return res.status(400).json({
            status: false,
            error: "Missing 'q' or 'query' parameter"
        });
    }

    try {
        const data = await searchManga(query);
        return res.json({
            status: true,
            total: data.length,
            data
        });
    } catch (err) {
        return res.status(500).json({
            status: false,
            error: err.message
        });
    }
});

router.status = "ready";
router.type = "free";
module.exports = router;
