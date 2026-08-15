/**
 * NAMA SCRAPE  :: REMOVE BACKGROUND (CUKI API)
 * [•] BASIS        :: api.cuki.biz.id
 */

const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const { fromBuffer } = require('file-type');

const router = express.Router();
const upload = multer();

// --- CONFIGURATION ---
const API_URL = 'https://api.cuki.biz.id/api/editing/removebg';
const API_KEY = 'cuki-x'; // Apikey bawaan dari endpoint target
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// --- HELPER FUNCTION: UPLOAD TEMPORARY IMAGE ---
// Karena API target butuh parameter URL gambar, file upload kita ubah dulu ke URL publik (Catbox)
async function uploadToCatbox(fileBuffer, mimetype, originalName) {
    const mimeInfo = await fromBuffer(fileBuffer);
    const contentType = mimeInfo ? mimeInfo.mime : (mimetype || 'image/jpeg');
    const filename = originalName || 'upload.jpg';

    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', fileBuffer, {
        filename: filename,
        contentType: contentType,
        knownLength: fileBuffer.length
    });

    const res = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: {
            ...form.getHeaders(),
            'User-Agent': UA
        },
        timeout: 30000
    });

    if (typeof res.data === 'string' && res.data.startsWith('https://')) {
        return res.data.trim();
    }
    throw new Error('Gagal mengunggah gambar sementara ke host publik.');
}

// --- SCRAPER FUNCTION ---
async function scrapeCukiRemoveBg(targetImgUrl) {
    try {
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
            timeout: 30000
        });

        const contentType = response.headers['content-type'];
        if (contentType && contentType.includes('application/json')) {
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

// --- ENDPOINT ROUTE (METHOD POST) ---
router.post('/', upload.single('fileupload'), async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Berkas 'fileupload' wajib diunggah!"
            });
        }

        // 1. Upload file buffer ke host publik sementara
        const tempImageUrl = await uploadToCatbox(file.buffer, file.mimetype, file.originalname);

        // 2. Eksekusi scraper Remove Background
        const imageBuffer = await scrapeCukiRemoveBg(tempImageUrl);

        // 3. Mengirimkan respons berupa gambar PNG transparan langsung ke client
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

// --- CONFIG PARAMETERS UNTUK DASHBOARD UI ---
router.paramsConfig = {
    fileupload: {
        type: "file",
        desc: "Berkas gambar yang akan dihapus latar belakangnya"
    }
};

router.desc = "Menghapus background gambar secara otomatis. Menggunakan upload berkas.";
router.status = "ready"; 
router.type = "free";
module.exports = router;
