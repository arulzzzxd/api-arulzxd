const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');

const router = express.Router();
const config = ['2', '4'];

// --- SCRAPER FUNCTIONS ---

async function gettoken() {
    const html = await axios.get('https://www.iloveimg.com/upscale-image').then(r => r.data);
    const token = html.match(/"token":"(eyJ[^"]+)"/)?.[1];
    const task = html.match(/ilovepdfConfig\.taskId\s*=\s*'([^']+)'/)?.[1];
    return { token, task };
}

async function upimage(imgUrl, token, task) {
    // 1. Download gambar dari URL ke Buffer
    const imageRes = await axios.get(imgUrl, { responseType: 'arraybuffer' }).catch(() => {
        throw new Error("Gagal mengunduh gambar dari URL. Pastikan URL valid dan dapat diakses!");
    });
    const buffer = Buffer.from(imageRes.data, 'binary');

    // Buat nama file acak untuk form-data
    const filename = imgUrl.split('/').pop().split('?')[0] || `${crypto.randomBytes(6).toString('hex')}.jpg`;

    // 2. Siapkan Form Data untuk Upload ke iloveimg
    const form = new FormData();
    form.append('name', filename);
    form.append('chunk', '0');
    form.append('chunks', '1');
    form.append('task', task);
    form.append('preview', '1');
    form.append('v', 'web.0');
    form.append('file', buffer, {
        filename: filename,
        contentType: 'image/jpeg'
    });

    const r = await axios.post('https://api29g.iloveimg.com/v1/upload', form, {
        headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${token}`,
            Origin: 'https://www.iloveimg.com',
            Referer: 'https://www.iloveimg.com/'
        }
    });

    return r.data.server_filename;
}

async function doUpscale(serverfilename, token, task, scale) {
    if (!config.includes(String(scale))) throw new Error('Scale tidak valid! Gunakan kualitas: 2 atau 4');

    const form = new FormData();
    form.append('task', task);
    form.append('server_filename', serverfilename);
    form.append('scale', scale);

    const r = await axios.post('https://api29g.iloveimg.com/v1/upscale', form, {
        headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${token}`,
            Origin: 'https://www.iloveimg.com',
            Referer: 'https://www.iloveimg.com/'
        },
        responseType: 'arraybuffer' // Mengambil hasil akhir dalam bentuk biner gambar
    });

    return r.data;
}

// --- ENDPOINT ROUTE ---

router.get('/', async (req, res) => {
    try {
        const imgUrl = req.query.url?.trim();
        // Otomatis diset ke skala '2' jika tidak diisi
        const scaleParam = req.query.scale?.trim() || '2';

        if (!imgUrl) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Parameter ?url= wajib diisi!",
                example: "/api/iloveimg?url=https://example.com/foto.jpg&scale=4"
            });
        }

        if (!config.includes(String(scaleParam))) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: `Scale tidak valid! Gunakan salah satu dari opsi berikut: ${config.join(', ')}`
            });
        }

        // Alur Eksekusi Scraper
        const { token, task } = await gettoken();
        const serverfilename = await upimage(imgUrl, token, task);
        const imageBuffer = await doUpscale(serverfilename, token, task, scaleParam);

        // Mengirimkan respons langsung berupa file gambar PNG
        res.setHeader('Content-Type', 'image/png');
        return res.send(Buffer.from(imageBuffer));

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            creator: "Arulzxd",
            message: "Internal Server Error saat memproses perbesaran gambar",
            error: err.message
        });
    }
});

// --- CONFIG DROPDOWN SELECT ---
// Properti ini dibaca otomatis oleh index.js Anda untuk merender element <select> di frontend
router.paramsConfig = {
    scale: {
        type: "select",
        options: ["2", "4"]
    }
};

router.status = "ready"; 
router.type = "free";
module.exports = router;
