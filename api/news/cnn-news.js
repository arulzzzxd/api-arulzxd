const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const BASE_URL = "https://www.cnnindonesia.com";

async function scrape(limit = 3) {
    const { data } = await axios.get(BASE_URL, {
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });

    const $ = cheerio.load(data);
    const newsList = [];

    $(".nhl-list article").each((i, el) => {
        const article = $(el);
        const link = article.find("a").first();

        const url = link.attr("href");

        if (url && url !== "#") {
            newsList.push({
                title: link.find("h2").text().trim(),
                url,
                image: article.find("img").attr("src") || "",
                category: article.find(".text-cnn_red").first().text().trim() || ""
            });
        }
    });

    const results = [];

    for (const item of newsList.slice(0, limit)) {
        try {
            const { data: html } = await axios.get(item.url, {
                headers: {
                    "User-Agent": "Mozilla/5.0"
                }
            });

            const $$ = cheerio.load(html);

            const content = [];

            $$(".detail-text p").each((i, el) => {
                const txt = $$(el).text().trim();

                if (
                    txt &&
                    !txt.includes("BACA JUGA:")
                ) {
                    content.push(txt);
                }
            });

            results.push({
                title: $$("h1").text().trim() || item.title,
                category: item.category,
                author: $$(".text-cnn_red").first().text().trim() || "",
                date: $$(".text-cnn_grey.text-sm").first().text().trim() || "",
                image: item.image,
                url: item.url,
                tags: $$(".flex.flex-wrap.gap-3 a")
                    .map((i, el) => $$(el).text().trim())
                    .get(),
                content
            });

        } catch (e) {}
    }

    return results;
}

router.get("/", async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 3;

        const result = await scrape(limit);

        res.json({
            status: true,
            creator: "ArulzXD",
            total: result.length,
            result
        });

    } catch (e) {
        res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message: e.message
        });
    }
});

router.status = "ready";
router.type = "free";
module.exports = router;