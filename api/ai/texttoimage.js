const axios = require('axios');
const express = require('express');
const router = express.Router();

// Fungsi untuk generate gambar dari prompt
async function text2image(prompt) {
    try {
        const targetUrl = `https://v2.api-varhad.my.id/ai/text2image?prompt=${encodeURIComponent(prompt)}`;
        
        // 1. Ambil JSON dari API target
        const { data } = await axios.get(targetUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 30000
        });

        if (!data || !data.status || !data.result || !data.result.image) {
            throw new Error("Gagal mengambil gambar dari API target");
        }

        // 2. Download gambar menjadi buffer
        const response = await axios.get(data.result.image, { 
            responseType: 'arraybuffer',
            timeout: 15000 
        });

        return Buffer.from(response.data);
    } catch (error) {
        throw error;
    }
}

// Endpoint utama Router
router.get('/', async (req, res) => {
    try {
        const prompt = req.query.prompt;

        if (!prompt) {
            return res.status(400).json({ error: "Masukkan parameter 'prompt'. Contoh: ?prompt=cat" });
        }

        const imageBuffer = await text2image(prompt);
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': imageBuffer.length,
        });
        res.end(imageBuffer);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;
