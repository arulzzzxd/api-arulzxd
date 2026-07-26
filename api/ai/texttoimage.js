const express = require("express");
const axios = require("axios");

const router = express.Router();

async function text2Image(prompt) {
    const { data } = await axios.get(
        "https://v2.api-varhad.my.id/ai/text2image",
        {
            params: { prompt },
            timeout: 60000,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        }
    );

    if (!data.status) {
        throw new Error(data.message || "Gagal membuat gambar.");
    }

    return data.result;
}

router.get("/", async (req, res) => {
    try {
        const prompt = req.query.prompt;

        if (!prompt) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Parameter prompt diperlukan.",
                example: "/api/ai/text2image?prompt=anime girl"
            });
        }

        const imageUrl = await text2Image(prompt);

        const response = await axios.get(imageUrl, {
            responseType: "stream",
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        res.setHeader(
            "Content-Type",
            response.headers["content-type"] || "image/png"
        );

        response.data.pipe(res);

    } catch (err) {
        res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message: err.response?.data?.message || err.message
        });
    }
});

router.status = "ready";
router.type = "free";

module.exports = router;