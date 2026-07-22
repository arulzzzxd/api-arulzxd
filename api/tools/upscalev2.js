const express = require("express");
const axios = require("axios");
const FormData = require("form-data");

const router = express.Router();

async function upscaleImg(imageUrl) {
    // Download gambar
    const { data } = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });

    const form = new FormData();

    form.append("upfile", Buffer.from(data), {
        filename: "image.jpg",
        contentType: "image/jpeg"
    });

    // Upscale
    const result = await axios.post(
        "https://www.photiu.ai/api/tools/img_improve",
        form,
        {
            headers: {
                ...form.getHeaders(),
                origin: "https://www.photiu.ai",
                referer: "https://www.photiu.ai/image-upscaler",
                "user-agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
                "x-paramsjs": JSON.stringify({
                    mode: "upscale",
                    level: "default"
                })
            },
            responseType: "stream"
        }
    );

    return result;
}

router.get("/", async (req, res) => {
    try {
        const apikey = req.query.apikey;
        const url = req.query.url;

        if (!apikey) {
            return res.status(403).json({
                status: false,
                message: "Parameter apikey diperlukan."
            });
        }

        if (apikey !== "arulzxd-keys") {
            return res.status(403).json({
                status: false,
                message: "Apikey tidak valid."
            });
        }

        if (!url) {
            return res.status(400).json({
                status: false,
                message: "Parameter url diperlukan.",
                example: "/api/tools/upscale?apikey=arulzxd-keys&url=https://example.com/image.jpg"
            });
        }

        const image = await upscaleImg(url);

        res.setHeader(
            "Content-Type",
            image.headers["content-type"] || "image/jpeg"
        );

        image.data.pipe(res);

    } catch (err) {
        console.error(err.response?.data || err.message);

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