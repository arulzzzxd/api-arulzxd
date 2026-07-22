
const express = require('express');
const axios = require('axios');

const router = express.Router();

// --- CONFIGURATION ---
const API_URL = 'https://api.cuki.biz.id/api/editing/removebg';
const API_KEY = 'cuki-x'; // Apikey bawaan dari endpoint target
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// --- SCRAPER FUNCTION ---
async function scrapeCukiRemoveBg(targetImgUrl) {
    try {
        // Menembak langsung ke API cuki.biz.id dengan responseType arraybuffer
        // agar kita mendapatkan hasil biner gambarnya langsung
        const response = await axios.get(API_URL, {
            params: {
                apikey: API_KEY,
                image: targetImgUrl
            },
            headers: {
                'User-Agent': UA,
                'Accept': 'image/png,image/*;q=0.8,*/*;q=0.5'
            },
            responseType: 'arraybuffer',
            timeout: 25000 // Timeout 25 detik jika server target lambat
        });

        // Validasi apakah respon berupa gambar, jika berupa JSON (berarti error/apikey habis)
        const contentType = response.headers['content-type'];
        if (contentType && contentType.includes('application/json')) {
            // Konversi buffer kembali ke teks untuk membaca pesan errornya
            const errorJson = JSON.parse(Buffer.from(response.data).toString('utf-8'));
            throw new Error(errorJson.message || 'API Cuki mengembalikan error JSON.');
        }

        return response.data;
    } catch (err) {
        if (err.response && err.response.data instanceof Buffer) {
            const errMsg = Buffer.from(err.response.data).toString('utf-8');
            throw new Error(`Cuki API Error: ${errMsg}`);
        }
        throw new Error(err.message);
    }
}

// --- ENDPOINT ROUTE (GET) ---
router.get('/', async (req, res) => {
    try {
        const imgUrl = req.query.url?.trim();

        if (!imgUrl) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Parameter ?url= wajib diisi!",
                example: "/api/removebg?url=https://example.com/foto.jpg"
            });
        }

        // Eksekusi fungsi scraper
        const imageBuffer = await scrapeCukiRemoveBg(imgUrl);

        // Mengirimkan respons berupa gambar PNG transparan langsung ke client
        res.setHeader('Content-Type', 'image/png');
        return res.send(Buffer.from(imageBuffer));

    } catch (err) {
        console.error("====== SCRAPER ERROR LOG ======");
        console.error(err.message);
        console.error("===============================");

        return res.status(500).json({
            status: false,
            creator: "Arulzxd",
            message: "Internal Server Error saat memproses penghapusan background via API Cuki",
            error: err.message
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;