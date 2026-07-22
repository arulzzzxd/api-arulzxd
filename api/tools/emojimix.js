const express = require('express');
const router = express.Router();
const axios = require('axios');

// Fungsi scraper emojimix yang mengembalikan data berupa arraybuffer
const emojimixBuffer = async (emoji1, emoji2) => {
    // Menggunakan parameter emoji1 dan emoji2 untuk query ke Tenor API
    const urlTenor = `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`;

    const response = await axios.get(urlTenor);

    // Memeriksa apakah kombinasi emoji ditemukan[cite: 3]
    if (response.data.results && response.data.results.length > 0) {
        const imgUrl = response.data.results[0].url;

        // Mengambil gambar dalam bentuk arraybuffer[cite: 3]
        const imageResponse = await axios.get(imgUrl, {
            responseType: 'arraybuffer'
        });

        return imageResponse.data;
    } else {
        throw new Error("Kombinasi emojimix tidak ditemukan atau tidak didukung.");
    }
};

// Endpoint API GET
router.get('/', async (req, res) => {
    // Memperbaiki pengambilan parameter agar menggunakan emoji1 dan emoji2[cite: 3]
    const emoji1 = req.query.emoji1;
    const emoji2 = req.query.emoji2;

    // Validasi parameter query[cite: 3]
    if (!emoji1 || !emoji2) {
        return res.status(400).json({
            status: 400,
            creator: "Arulz-XD",
            message: "Parameter 'emoji1' dan 'emoji2' salah atau tidak diisi. Contoh: ?emoji1=😎&emoji2=🔥"
        });
    }

    try {
        // Memanggil fungsi scraper emojimix[cite: 3]
        const emojimixData = await emojimixBuffer(emoji1, emoji2);

        // Mengubah hasil scraper menjadi Buffer Node.js[cite: 3]
        const buffernya = Buffer.from(emojimixData);

        // Memasang header image/png murni[cite: 3]
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': buffernya.length
        });

        // Kirimkan buffernya sebagai response utama[cite: 3]
        res.end(buffernya);

    } catch (error) {
        // Jika gagal, keluarkan response JSON berupa error info[cite: 3]
        res.status(500).json({
            status: 500,
            creator: "Arulz-XD",
            message: "Gagal mengambil gambar emojimix.",
            error: error.message || String(error)
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;