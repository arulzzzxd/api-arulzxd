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

async function populer() {
    const { data } = await axios.get(
        `${BASE_URL}/terpopuler`,
        {
            headers
        }
    );

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
            time: item
                .find(".media__date")
                .text()
                .trim(),
            url: item
                .find("a")
                .attr("href"),
            image:
                item.find("img").attr("src") ||
                item.find("img").attr("data-src") ||
                ""
        });
    });

    return result;
}

router.get("/", async (req, res) => {
    try {
        const result = await populer();

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