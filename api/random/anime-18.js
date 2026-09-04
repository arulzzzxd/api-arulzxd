const axios = require('axios');
const express = require('express');
const router = express.Router();

// Fungsi untuk mengambil gambar waifu.im dengan opsi query dinamis
async function fetchWaifuImage(queryParams = {}) {
    try {
        const params = new URLSearchParams();

        // Menyusun parameter query berdasarkan dokumentasi API waifu.im
        Object.entries(queryParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                if (Array.isArray(value)) {
                    value.forEach(val => params.append(key, val));
                } else {
                    params.append(key, value);
                }
            }
        });

        // Set default IsNsfw jika tidak dipassing dari req.query
        if (!params.has('IsNsfw') && !params.has('isnsfw')) {
            params.append('IsNsfw', 'true');
        }

        const apiUrl = `https://api.waifu.im/images?${params.toString()}`;

        // Request API waifu.im dengan timeout & headers
        const api = await axios.get(apiUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json"
            },
            timeout: 10000
        });

        const data = api.data;

        // Validasi response data
        if (!data || !data.items || !Array.isArray(data.items) || data.items.length === 0) {
            throw new Error("Gagal mengambil gambar, data kosong atau parameter tidak sesuai.");
        }

        // Ambil elemen pertama
        const targetImage = data.items[0];
        const imageUrl = targetImage.url;

        // Download gambar dengan responseType arraybuffer
        const image = await axios.get(imageUrl, {
            responseType: "arraybuffer",
            timeout: 15000,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const contentType = image.headers["content-type"] || "image/png";

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
        const imageResult = await fetchWaifuImage(req.query);
        
        res.writeHead(200, {
            'Content-Type': imageResult.contentType,
            'Content-Length': imageResult.buffer.length,
        });
        
        res.end(imageResult.buffer);
    } catch (error) {
        console.error(error);
        
        return res.status(500).json({
            status: false,
            creator: "Arulzxd",
            message: error.response?.data?.detail || error.message || "Terjadi kesalahan server"
        });
    }
});

router.desc = "Mengambil gambar anime acak dari waifu.im dengan berbagai parameter filter (NSFW, Tags, Orientation, dll).";
router.paramsConfig = {
    IsNsfw: "boolean (default: true)",
    IncludedTags: "array/string (contoh: waifu, maid)",
    ExcludedTags: "array/string",
    Orientation: "Landscape | Portrait | Square | All",
    OrderBy: "Random | UploadedAt | Favorites | AddedToAlbum",
    IsAnimated: "False | True | All"
};
router.status = "ready"; 
router.type = "premium";

module.exports = router;
