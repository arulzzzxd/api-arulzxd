const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const BASE_URL = "https://www.detik.com";

const headers = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://www.detik.com/",
    "Origin": "https://www.detik.com/",
    "Accept": "*/*"
};

async function search(query) {
    const url =
        `${BASE_URL}/search/searchall?query=${encodeURIComponent(query)}&result_type=relevansi`;

    const { data } = await axios.get(url, {
        headers
    });

    const $ = cheerio.load(data);

    const result = [];

    $(".list-content__item").each((i, el) => {
        const item = $(el);

        const title = item
            .find(".media__title")
            .text()
            .trim();

        if (!title) return;

        result.push({
            no: i + 1,
            title,
            time:
                item.find(".media__date span").attr("title") ||
                item.find(".media__date").text().trim(),
            url:
                item.find(".media__title a").attr("href"),
            image:
                item.find(".media__image img").attr("src") ||
                item.find(".media__image img").attr("data-src") ||
                "",
            category:
                item.find(".media__subtitle").text().trim() ||
                ""
        });
    });

    return result;
}

router.get("/", async (req, res) => {
    try {
        const q = req.query.q;

        if (!q) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Parameter q diperlukan.",
                example: "/api/search/detiksearch?q=timnas"
            });
        }

        const result = await search(q);

        res.json({
            status: true,
            creator: "ArulzXD",
            total: result.length,
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