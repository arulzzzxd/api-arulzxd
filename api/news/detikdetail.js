const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const headers = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://www.detik.com/",
    "Origin": "https://www.detik.com/",
    "Accept": "*/*"
};

async function detail(url) {
    const { data } = await axios.get(url, {
        headers
    });

    const $ = cheerio.load(data);

    const paragraphs = [];

    $(".detail__body p").each((i, el) => {
        const text = $(el).text().trim();

        if (
            text &&
            !text.toLowerCase().includes("baca juga") &&
            !text.toLowerCase().includes("simak video")
        ) {
            paragraphs.push(text);
        }
    });

    const tags = [];

    $("a[href*='/tag/']").each((i, el) => {
        const tag = $(el).text().trim();

        if (tag && !tags.includes(tag)) {
            tags.push(tag);
        }
    });

    return {
        title: $("h1").first().text().trim(),
        author:
            $("meta[name='author']").attr("content") ||
            $(".detail__author").text().trim() ||
            "",
        date:
            $(".detail__date").text().trim() ||
            $("meta[property='article:published_time']").attr("content") ||
            "",
        image:
            $("meta[property='og:image']").attr("content") ||
            "",
        tags,
        content: paragraphs.join("\n\n")
    };
}

router.get("/", async (req, res) => {
    try {
        const url = req.query.url;

        if (!url) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Parameter url diperlukan.",
                example:
                    "/api/search/detikdetail?url=https://news.detik.com/..."
            });
        }

        if (!url.includes("detik.com")) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "URL harus berasal dari Detik.com."
            });
        }

        const result = await detail(url);

        res.json({
            status: true,
            creator: "ArulzXD",
            result
        });

    } catch (err) {
        res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message: err.message
        });
    }
});

router.status = "ready";
router.type = "free";
module.exports = router;
