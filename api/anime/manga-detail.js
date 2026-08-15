/**
 * NAMA SCRAPE  :: ROSY SCANS MANGA DETAIL
 * [•] BASIS        :: rosyscans.id
 */

const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();

async function getMangaDetail(mangaUrl) {
    const proxyUrl = mangaUrl.startsWith('http') 
        ? `https://cors.caliph.my.id/${mangaUrl}` 
        : `https://cors.caliph.my.id/https://rosyscans.id/manga/${mangaUrl}/`;

    try {
        const { data: htmlContent } = await axios.get(proxyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(htmlContent);
        const detailData = {};

        detailData.title = $('.entry-title[itemprop="name"]').text().trim();
        detailData.alternativeTitle = $('.alternative').text().trim();
        detailData.coverImage = $('.info-left .thumb img').attr('src');
        detailData.synopsis = $('.entry-content[itemprop="description"] p').text().trim();

        detailData.genres = [];
        $('.wd-full .mgen a').each((_, el) => {
            detailData.genres.push($(el).text().trim());
        });

        detailData.status = $('.imptdt:contains("Status") i').text().trim();
        detailData.type = $('.imptdt:contains("Type") a').text().trim();
        detailData.author = $('.imptdt:contains("Posted By") i[itemprop="name"]').text().trim();
        detailData.postedOn = $('.imptdt:contains("Posted On") time').text().trim();
        detailData.updatedOn = $('.imptdt:contains("Updated On") time').text().trim();

        detailData.chapters = [];
        $('#chapterlist ul li').each((_, el) => {
            const chapterNumber = $(el).find('.chapternum').text().trim();
            const chapterDate = $(el).find('.chapterdate').text().trim();
            const chapterUrl = $(el).find('a').attr('href');

            detailData.chapters.push({
                chapter: chapterNumber,
                date: chapterDate,
                url: chapterUrl
            });
        });

        return detailData;

    } catch (error) {
        throw error;
    }
}

// Endpoint GET /
router.get('/', async (req, res) => {
    const url = req.query.slug;

    if (!url) {
        return res.status(400).json({
            status: false,
            error: "Missing 'url' or 'slug' parameter"
        });
    }

    try {
        const data = await getMangaDetail(url);
        return res.json({
            status: true,
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
