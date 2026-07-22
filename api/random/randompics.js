const axios = require('axios');
const express = require('express');
const router = express.Router();

// Fungsi untuk mengambil gambar acak berdasarkan kategori pilihan
async function getRandomPic(category) {
    try {
        const url = `https://raw.githubusercontent.com/arulzzzxd/database/main/randompics/${category}.json`;
        const { data } = await axios.get(url);
        
        let parsedData = data;
        if (typeof data === 'string') {
            parsedData = JSON.parse(data);
        }

        let urls = [];
        if (Array.isArray(parsedData)) {
            urls = parsedData;
        } else if (parsedData && typeof parsedData === 'object') {
            const dynamicKey = Object.keys(parsedData).find(key => Array.isArray(parsedData[key]));
            if (dynamicKey) {
                urls = parsedData[dynamicKey];
            } else {
                urls = Object.values(parsedData);
            }
        }

        if (urls.length === 0) {
            throw new Error(`Kategori ${category}.json kosong atau tidak valid.`);
        }

        // Ambil item acak dari array
        const randomItem = urls[Math.floor(Math.random() * urls.length)];
        
        // --- FIX KRITIKAL: Cek apakah item berupa objek { result: '...' } atau string biasa ---
        let randomUrl = '';
        if (typeof randomItem === 'string') {
            randomUrl = randomItem;
        } else if (randomItem && typeof randomItem === 'object') {
            randomUrl = randomItem.result || randomItem.url || Object.values(randomItem).find(v => typeof v === 'string' && v.startsWith('http'));
        }

        // Validasi final teks URL gambar
        if (!randomUrl || !randomUrl.trim().startsWith('http')) {
            throw new Error(`Gagal mengekstrak URL string yang valid dari item data.`);
        }

        // Download gambar asli
        const response = await axios.get(randomUrl.trim(), { 
            responseType: 'arraybuffer',
            timeout: 10000 
        });
        
        return {
            buffer: Buffer.from(response.data),
            contentType: response.headers['content-type'] || 'image/png'
        };
    } catch (error) {
        throw error;
    }
}

// Endpoint utama Router
router.get('/', async (req, res) => {
    try {
        const category = req.query.category || 'aesthetic';
        const imageResult = await getRandomPic(category);
        
        res.writeHead(200, {
            'Content-Type': imageResult.contentType,
            'Content-Length': imageResult.buffer.length,
        });
        res.end(imageResult.buffer);
    } catch (error) {
        return res.status(500).json({ 
            status: false, 
            message: "Gagal mengambil gambar",
            error: error.message 
        });
    }
});

// Konfigurasi metadata kustom untuk dropdown select dokumentasi
router.paramsConfig = {
    category: {
        type: "select",
        options: [
            "aesthetic", "antiwork", "bike", "blackpink", "boneka", 
            "car", "cat", "cosplay", "doggo", "justina", 
            "kayes", "kpop", "notnot", "ppcouple", "profile", 
            "pubg", "rose", "ryujin", "ulzzangboy"
        ]
    }
};

router.status = "ready"; 
router.type = "free";
module.exports = router;
