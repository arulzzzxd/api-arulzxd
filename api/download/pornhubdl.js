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
                message: "Parameter 'url' diperlukan.",
                example: "/api/download/pornhub?url=https://www.pornhub.com/view_video.php?viewkey=xxxxx"
            });
        }

        const apiUrl = `https://vidquickly.com/api/v1/pornhub-get-link?url=${encodeURIComponent(url)}`;
        const { data } = await axios.get(apiUrl);

        // Validasi data m3u8_links dari API tujuan
        if (!data?.m3u8_links || data.m3u8_links.length === 0) {
            throw new Error("Gagal mendapatkan link download.");
        }

        // Format response disamakan dengan contoh kedua
        res.json({
            status: true,
            creator: "ArulzXD",
            result: {
                title: data.videoDetails?.title,
                thumbnail: data.videoDetails?.thumbnails?.[0]?.url,
                downloads: data.m3u8_links.map(link => ({
                    quality: link.title,
                    download_url: link.url
                }))
            }
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            error: error.message,
            details: error.response?.data || null
        });
    }
});

router.status = "ready"; 
router.type = "premium";
module.exports = router;