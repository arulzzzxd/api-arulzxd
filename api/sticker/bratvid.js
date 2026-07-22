const express = require("express");
const axios = require("axios");

const router = express.Router();

router.get("/", async (req, res) => {
try {
const text = req.query.text;

    if (!text) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'text' diperlukan.",
            example: "/api/sticker/bratvidhd?apikey=arulzxd-keys&text=halo+dunia"
        });
    }

    const targetUrl =
        `https://api.theresav.biz.id/maker/bratvid?text=${encodeURIComponent(text)}&format=gif`;

    const response = await axios.get(targetUrl, {
        responseType: "arraybuffer",
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });

    res.setHeader(
        "Content-Type",
        response.headers["content-type"] || "image/gif"
    );

    return res.send(Buffer.from(response.data));

} catch (error) {
    return res.status(500).json({
        status: false,
        creator: "ArulzXD",
        error: error.message
    });
}

});

router.status = "ready";
router.type = "free";
module.exports = router;