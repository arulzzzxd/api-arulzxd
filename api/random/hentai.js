const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();

// ======================================================
// FUNGSI UNTUK MENGAMBIL & MENDOWNLOAD MEDIA SECARA ACAK
// ======================================================
async function randomHentai() {
    try {
        // Menentukan halaman secara acak (1 - 1153)
        const page = Math.floor(Math.random() * 1153) + 1;
        
        // Request ke website target dengan headers dan timeout aman
        const { data } = await axios.get(`https://sfmcompile.club/page/${page}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
            },
            timeout: 10000
        });

        const $ = cheerio.load(data);
        const hasil = [];

        // Mengumpulkan semua URL media dari daftar artikel di halaman tersebut
        $('#primary > div > div > ul > li > article').each(function (a, b) {
            const mediaUrl = $(b).find('source').attr('src') || $(b).find('img').attr('data-src');
            const mediaType = $(b).find('source').attr('type') || 'image/jpeg';
            
            if (mediaUrl) {
                hasil.push({
                    url: mediaUrl,
                    type: mediaType
                });
            }
        });

        // Validasi jika halaman kosong atau gagal di-scrape
        if (hasil.length === 0) {
            throw new Error("Gagal mengambil daftar media, silakan coba lagi");
        }

        // Memilih satu item secara acak dari hasil list halaman tersebut
        const randomMedia = hasil[Math.floor(Math.random() * hasil.length)];

        // Download file media (bisa berupa video mp4 atau gambar jpg/png) memakai arraybuffer
        const mediaResponse = await axios.get(randomMedia.url, {
            responseType: "arraybuffer",
            timeout: 20000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
        });

        const contentType = mediaResponse.headers["content-type"] || randomMedia.type;

        // Mengembalikan Buffer dan Content-Type dinamis
        return {
            buffer: Buffer.from(mediaResponse.data),
            contentType: contentType
        };

    } catch (error) {
        throw error;
    }
}

// ======================================================
// ENDPOINT UTAMA ROUTER (LANGSUNG MENAMPILKAN MEDIA)
// ======================================================
router.get('/', async (req, res) => {
    try {
        const hentai = await randomHentai();
        
        // Mengirimkan header file asli agar langsung dirender/dimainkan di browser
        res.writeHead(200, {
            'Content-Type': hentai.contentType,
            'Content-Length': hentai.buffer.length,
        });
        
        res.end(hentai.buffer);
    } catch (error) {
        console.log(error);
        
        // Response error berformat JSON bawaan Arulzxd jika proses gagal
        return res.status(500).json({
            status: false,
            creator: "Arulzxd",
            message: error.response?.data?.detail || error.message || "Terjadi kesalahan server saat memproses media"
        });
    }
});

router.status = "ready"; 
router.type = "vip";
module.exports = router;