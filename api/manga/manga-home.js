/**
 * NAMA SCRAPE  :: ROSY SCANS HOME
 * [•] BASIS        :: rosyscans.id
 */

const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();

async function scrapeRosyScans() {
    const url = 'https://cors.caliph.my.id/https://rosyscans.id';

    try {
        const { data: htmlContent } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(htmlContent);

        const scrapedData = {
            popularToday: [],
            projectUpdate: [],
            latestUpdates: []
        };

        $('.popularslider .bsx').each((_, el) => {
            scrapedData.popularToday.push({
                title: $(el).find('.tt').text().trim(),
                chapter: $(el).find('.epxs').text().trim(),
                url: $(el).find('a').attr('href'),
                image: $(el).find('img').attr('src'),
                type: $(el).find('.limit .type').attr('class')?.replace('type ', '').trim() || ''
            });
        });

        $('.bixbox').each((_, box) => {
            const sectionTitle = $(box).find('.releases h2').text().trim();

            if (sectionTitle === 'Project Update') {
                $(box).find('.bsx').each((_, el) => {
                    const chapters = [];
                    $(el).find('.chfiv li').each((_, ch) => {
                        chapters.push({
                            chapter: $(ch).find('.fivchap').text().trim(),
                            timeUploaded: $(ch).find('.fivtime').text().trim(),
                            url: $(ch).find('a').attr('href')
                        });
                    });

                    scrapedData.projectUpdate.push({
                        title: $(el).find('.tt a').text().trim(),
                        url: $(el).find('.tt a').attr('href'),
                        image: $(el).find('img').attr('src'),
                        type: $(el).find('.limit .type').attr('class')?.replace('type ', '').trim() || '',
                        chapters: chapters
                    });
                });
            }

            if (sectionTitle === 'Latest Update') {
                $(box).find('.uta').each((_, el) => {
                    const chapters = [];
                    $(el).find('.luf ul li').each((_, ch) => {
                        chapters.push({
                            chapter: $(ch).find('a').text().trim(),
                            timeUploaded: $(ch).find('span').text().trim(),
                            url: $(ch).find('a').attr('href')
                        });
                    });

                    scrapedData.latestUpdates.push({
                        title: $(el).find('.luf h4').text().trim(),
                        url: $(el).find('.luf a.series').attr('href'),
                        image: $(el).find('.imgu img').attr('src'),
                        chapters: chapters
                    });
                });
            }
        });

        return scrapedData;

    } catch (error) {
        throw error;
    }
}

// Endpoint GET /
router.get('/', async (req, res) => {
    try {
        const data = await scrapeRosyScans();
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
