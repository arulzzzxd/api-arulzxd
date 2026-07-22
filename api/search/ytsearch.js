const express = require("express");
const yts = require("yt-search");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const query = req.query.query?.trim();

        if (!query) {
            return res.status(400).json({
                status: false,
                message: "Masukkan parameter query"
            });
        }

        const search = await yts(query);

        // Pastikan search.videos ada dan berbentuk array sebelum di-map
        const videos = search?.videos || [];

        const result = videos.map(v => {
            // Ambil views aman, handle jika berupa angka atau string teks ribuan
            let formattedViews = 0;
            if (v?.views) {
                formattedViews = typeof v.views === "number" 
                    ? v.views.toLocaleString('id-ID') 
                    : v.views.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            }

            return {
                type: v?.type || "video",
                videoId: v?.videoId || "",
                title: v?.title || "No Title",
                url: v?.url || "",
                timestamp: v?.timestamp || "00:00",
                duration: {
                    seconds: v?.seconds || 0,
                    timestamp: v?.timestamp || "00:00"
                },
                views: formattedViews,
                ago: v?.ago || "Unknown Date",
                author: {
                    name: v?.author?.name || "Unknown Channel",
                    url: v?.author?.url || ""
                },
                thumbnail: v?.thumbnail || v?.image || `https://i.ytimg.com/vi/${v?.videoId}/hqdefault.jpg`
            };
        });

        return res.status(200).json({
            status: true,
            creator: "ArulzXD",
            total: result.length,
            result
        });

    } catch (err) {
        console.error("YT Search Error:", err.message);
        return res.status(500).json({
            status: false,
            message: "Gagal mengambil data dari YouTube, coba lagi nanti.",
            error: err.message
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;