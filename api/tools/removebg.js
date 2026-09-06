const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');

const router = express.Router();

// Middleware Multer untuk membaca file yang di-upload dari body
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // Batas maksimum 10MB
});

const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
    'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'Accept-Language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6'
};

async function getWebToken() {
    const r = await axios.get('https://removal.ai/wp-admin/admin-ajax.php', {
        headers,
        params: {
            action: 'ajax_get_webtoken',
            security: '4acc8a2f93'
        },
        timeout: 10000
    });
    return r.data?.data?.webtoken;
}

async function removeBackground(fileBuffer, originalName, mimeType) {
    const webToken = await getWebToken();

    if (!webToken) {
        throw new Error('Gagal mendapatkan webtoken dari removal.ai');
    }

    const form = new FormData();
    form.append('image_file', fileBuffer, {
        filename: originalName || 'input.jpg',
        contentType: mimeType || 'image/jpeg'
    });

    const r = await axios.post('https://api.removal.ai/3.0/remove', form, {
        headers: {
            ...headers,
            ...form.getHeaders(),
            'Web-Token': webToken
        },
        timeout: 30000
    });

    return r.data;
}

// Endpoint utama
router.post('/', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                status: false,
                creator: 'ArulzXD',
                message: 'Silakan upload gambar menggunakan multipart/form-data dengan field name "image"'
            });
        }

        const result = await removeBackground(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        return res.json({
            status: true,
            creator: 'ArulzXD',
            result: {
                url: result.url,
                lowResolution: result.low_resolution,
                highResolution: result.high_resolution,
                originalUrl: result.original,
                dimensions: {
                    originalWidth: result.original_width,
                    originalHeight: result.original_height,
                    previewWidth: result.preview_width,
                    previewHeight: result.preview_height
                }
            }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            creator: 'ArulzXD',
            message: err.message || 'Terjadi kesalahan saat memproses gambar'
        });
    }
});

router.desc = "Menghapus background gambar menggunakan layanan Removal.ai (Upload via multipart/form-data field 'image').";
router.paramsConfig = {
    image: {
        type: "file",
        desc: "Berkas gambar yang akan dihapus latar belakangnya"
    }
};
router.status = "ready";
router.type = "free";

module.exports = router;
