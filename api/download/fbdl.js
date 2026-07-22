const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();

// ======================================================
// CORE DOWNLOADER FUNCTION
// ======================================================
async function fbdown(url) {
    // Ambil token dari halaman utama
    const homeRes = await axios.get('https://fbdown.to/en', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36'
        }
    });

    const $home = cheerio.load(homeRes.data);
    const k_exp = $home('#token_exp').val();
    const k_token = $home('#token_key').val();

    if (!k_exp || !k_token) {
        throw new Error('Failed to get verification token from server');
    }

    // Payload request
    const payload = new URLSearchParams({
        k_exp,
        k_token,
        p: 'home',
        q: url,
        lang: 'en',
        v: 'v2',
        w: ''
    });

    // Request pencarian video
    const searchRes = await axios.post(
        'https://fbdown.to/api/ajaxSearch',
        payload.toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://fbdown.to/'
            },
            timeout: 15000
        }
    );

    // Validasi response
    if (searchRes.data.status !== 'ok') {
        throw new Error('Video not found or link is private/invalid');
    }

    const $ = cheerio.load(searchRes.data.data);

    const result = {
        title: $('.content h3').text().trim() || null,
        duration: $('.content p').text().trim() || null,
        thumbnail: $('.image-fb img').attr('src') || null,
        video: [],
        audio: []
    };

    // Ambil video
    $('table.table tbody tr').each((i, el) => {
        const quality = $(el).find('.video-quality').text().trim();
        const link = $(el).find('a.download-link-fb').attr('href');
        const btn = $(el).find('button');

        if (link) {
            result.video.push({
                quality,
                type: 'mp4',
                render: false,
                url: link
            });
        } else if (btn.length > 0) {
            result.video.push({
                quality,
                type: 'mp4',
                render: true,
                videoUrl: btn.attr('data-videourl') || null
            });
        }
    });

    // Ambil audio
    const audioUrl = $('#audioUrl').val();
    if (audioUrl) {
        result.audio.push({
            quality: '128kbps',
            type: 'mp4_audio',
            url: audioUrl
        });
    }

    return result;
}

// ======================================================
// ENDPOINT GET UTAMA
// ======================================================
router.get('/', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({
            status: false,
            error: "Missing 'url' parameter"
        });
    }

    try {
        const result = await fbdown(url);

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            result
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            error: error.message
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;