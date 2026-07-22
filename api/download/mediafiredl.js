const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

function getMimeTypeFromUrl(url) {
    if (!url) return "unknown";

    const fileName = url
        .split("/")
        .pop()
        .split("?")[0];

    const extension = fileName
        .split(".")
        .pop()
        .toLowerCase();

    const mimeTypes = {
        "7z": "application/x-7z-compressed",
        zip: "application/zip",
        rar: "application/x-rar-compressed",
        apk: "application/vnd.android.package-archive",
        exe: "application/x-msdownload",
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ppt: "application/vnd.ms-powerpoint",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        mp3: "audio/mpeg",
        mp4: "video/mp4",
        txt: "text/plain",
        json: "application/json",
        js: "application/javascript",
        html: "text/html",
        css: "text/css"
    };

    return mimeTypes[extension] || "application/octet-stream";
}

async function mediafire(url) {
    const { data: html } = await axios.get(url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0"
        }
    });

    const $ = cheerio.load(html);

    const title =
        $('meta[property="og:title"]')
            .attr("content") ||
        "Unknown";

    const image =
        $('meta[property="og:image"]')
            .attr("content");

    const description =
        $('meta[property="og:description"]')
            .attr("content") ||
        "No description";

    const link_download =
        $("#downloadButton").attr("href");

    if (!link_download) {
        throw new Error(
            "Download link tidak ditemukan"
        );
    }

    const sizeText =
        $("#downloadButton")
            .text()
            .trim();

    const size = sizeText
        .replace("Download (", "")
        .replace(")", "")
        .trim();

    const mimetype =
        getMimeTypeFromUrl(
            link_download
        );

    return {
        meta: {
            title,
            image,
            description
        },
        download: {
            url: link_download,
            size,
            mimetype
        }
    };
}

router.get("/", async (req, res) => {
    try {
        const url =
            req.query.url?.trim();

        if (!url) {
            return res.status(400).json({
                status: false,
                message:
                    "Parameter url wajib"
            });
        }

        const result =
            await mediafire(url);

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