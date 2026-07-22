const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const BASE_URL = "https://www.liputan6.com";

const HEADERS = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "referer": "https://www.google.com/",
    "user-agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/147.0.0.0 Mobile Safari/537.36"
};

async function scrape() {
    const { data } = await axios.get(BASE_URL, {
        headers: HEADERS,
        timeout: 15000
    });

    const $ = cheerio.load(data);

    const result = {
        headlineMain: null,
        headline: [],
        terpopuler: [],
        rekomendasi: [],
        video: [],
        special_content: []
    };

    // Headline utama
    const main = $(".promotion--headline");

    if (main.length) {
        const url =
            main.data("url") ||
            main.find("a").attr("href");

        result.headlineMain = {
            title:
                main.data("title") ||
                main.find(".promotion__item__title").text().trim(),
            description:
                main.find(".promotion__item__desc").text().trim(),
            channel:
                main.data("channel") ||
                "",
            image:
                main.find("img").attr("src") ||
                main.find("img").attr("data-original") ||
                "",
            time:
                main.find("time").attr("datetime") ||
                main.find("time").text().trim(),
            url: url?.startsWith("http")
                ? url
                : BASE_URL + url
        };
    }

    // Headline
    $(".headline-grid--list__item__wrapper").each((i, el) => {

        const url =
            $(el).data("url") ||
            $(el).find("a").attr("href");

        result.headline.push({
            no: i + 1,
            title:
                $(el).data("title") ||
                $(el).find(".headline-grid--list__item__title").text().trim(),
            channel:
                $(el).data("channel") ||
                "",
            image:
                $(el).find("img").attr("src") ||
                $(el).find("img").attr("data-original") ||
                "",
            time:
                $(el).find("time").attr("datetime") ||
                $(el).find("time").text().trim(),
            url: url?.startsWith("http")
                ? url
                : BASE_URL + url
        });
    });

    // Terpopuler
    $(".popular-list__item").each((i, el) => {

        const url =
            $(el).data("url") ||
            $(el).find("a").attr("href");

        result.terpopuler.push({
            no: i + 1,
            title:
                $(el).data("title") ||
                $(el).find(".item__title").text().trim(),
            channel:
                $(el).find(".item__published").text().trim(),
            image:
                $(el).find("img").attr("src") ||
                $(el).find("img").attr("data-original") ||
                "",
            url: url?.startsWith("http")
                ? url
                : BASE_URL + url
        });
    });

    // Rekomendasi
    $(".promotion--list__item,.promotion-article--list__item").each((i, el) => {

        const url =
            $(el).data("url") ||
            $(el).find("a").attr("href");

        result.rekomendasi.push({
            no: i + 1,
            title:
                $(el).data("title") ||
                $(el).find(".promotion__item__title,.promotion-article--list__title").text().trim(),
            channel:
                $(el).find(".promotion-article--list__tag").text().trim() ||
                $(el).data("channel") ||
                "",
            image:
                $(el).find("img").attr("src") ||
                $(el).find("img").attr("data-original") ||
                "",
            time:
                $(el).find("time").attr("datetime") ||
                $(el).find("time").text().trim(),
            duration:
                $(el).find(".promotion-article--list__time").text().trim() ||
                "",
            url: url?.startsWith("http")
                ? url
                : BASE_URL + url
        });
    });

    // Video
    $(".video-vertical .swiper-slide").each((i, el) => {

        const url =
            $(el).data("url") ||
            $(el).find("a").attr("href");

        result.video.push({
            no: i + 1,
            title:
                $(el).data("title") ||
                $(el).find("img").attr("alt") ||
                "",
            duration:
                $(el).find(".item__time span").last().text().trim(),
            image:
                $(el).find("img").attr("src") ||
                $(el).find("img").attr("data-original") ||
                "",
            url: url?.startsWith("http")
                ? url
                : BASE_URL + url
        });
    });

    // Special Content
    $(".special-content").each((i, el) => {

        const items = [];

        $(el).find(".special-content-inner-box-list-item").each((j, e) => {

            const u =
                $(e).find("a").attr("href");

            items.push({
                no: j + 1,
                title:
                    $(e).find(".special-content-inner-box-list-item-title").text().trim(),
                time:
                    $(e).find("time").attr("datetime") ||
                    "",
                image:
                    $(e).find("img").attr("src") ||
                    $(e).find("img").attr("data-original") ||
                    "",
                url: u?.startsWith("http")
                    ? u
                    : BASE_URL + u
            });

        });

        const su =
            $(el).find(".special-content-inner-box-link,.special-content-pict").first().attr("href");

        result.special_content.push({
            title:
                $(el).find(".special-content-inner-box-title").text().trim(),
            image:
                $(el).find(".special-content-pict-figure-img").attr("src") ||
                $(el).find(".special-content-pict-figure-img").attr("data-original") ||
                "",
            url: su?.startsWith("http")
                ? su
                : BASE_URL + su,
            total_items: items.length,
            items
        });

    });

    return result;
}

router.get("/", async (req, res) => {
    try {

        const result = await scrape();

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