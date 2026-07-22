const express = require("express");
const axios = require("axios");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const url = req.query.url;

        // Validasi parameter URL
        if (!url) {
            return res.status(400).json({
                status: false,
                message: "Parameter url diperlukan",
                example:
                    "/api/download/xhamster?url=https://xhamster.com/videos/xxxxx"
            });
        }

        const apiUrl = `https://vidquickly.com/api/v1/xhamster-get-link?url=${encodeURIComponent(url)}`;
        const { data } = await axios.get(apiUrl);

        // Validasi data links dari API tujuan
        if (!data?.links) {
            throw new Error("Gagal mendapatkan link download");
        }

        // Format response disamakan dengan template target
        res.json({
            status: true,
            creator: "ArulzXD",
            result: {
                title: data.videoDetails?.title,
                thumbnail: data.videoDetails?.thumbnails?.[0]?.url,
                downloads: data.links
                    .filter(link => link.url)
                    .map(link => ({
                        title: link.title,
                        download_url: link.url
                    }))
            }
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            error: error.message,
            details:
                error.response?.data ||
                null
        });
    }
});

router.status = "ready"; 
router.type = "premium";
module.exports = router;