const axios = require('axios');
const express = require('express');
const router = express.Router();

// Fungsi untuk mengambil gambar anime nsfw secara acak
async function randomNsfw() {
    try {
        // Request API waifu.im dengan tanda asli (timeout & headers)
        const api = await axios.get("https://api.waifu.im/images?isnsfw=true", {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json"
            },
            timeout: 10000
        });

        const data = api.data;

        // Validasi data asli tetap dipertahankan
        if (!data || !data.items || !Array.isArray(data.items) || !data.items[0]) {
            throw new Error("Gagal mengambil gambar nsfw");
        }

        const imageUrl = data.items[0].url;

        // Download image dengan responseType arraybuffer asli
        const image = await axios.get(imageUrl, {
            responseType: "arraybuffer",
            timeout: 15000,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const contentType = image.headers["content-type"] || "image/png";

        // Mengembalikan Buffer dan Content-Type secara dinamis agar tanda tidak hilang
        return {
            buffer: Buffer.from(image.data),
            contentType: contentType
        };
    } catch (error) {
        throw error;
    }
}

// Endpoint utama Router
router.get('/', async (req, res) => {
    try {
        const nsfw = await randomNsfw();
        
        res.writeHead(200, {
            'Content-Type': nsfw.contentType,
            'Content-Length': nsfw.buffer.length,
        });
        
        res.end(nsfw.buffer);
    } catch (error) {
        console.log(error);
        
        // Response error dengan format JSON & data creator bawaanmu
        return res.status(500).json({
            status: false,
            creator: "Arulzxd",
            message: error.response?.data?.detail || error.message || "Terjadi kesalahan server"
        });
    }
});

router.status = "ready"; 
router.type = "premium";
module.exports = router;