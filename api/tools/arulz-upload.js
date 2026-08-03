const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');
const multer = require('multer');
const { fromBuffer } = require('file-type');

const router = express.Router();
const config = ['2', '4'];

// ❌ Hapus `limits` agar Multer tidak membatasi ukuran file yang diunggah
const upload = multer();

// --- SCRAPER FUNCTIONS ---

async function gettoken() {
    const html = await axios.get('https://www.iloveimg.com/upscale-image').then(r => r.data);
    const token = html.match(/"token":"(eyJ[^"]+)"/)?.[1];
    const task = html.match(/ilovepdfConfig\.taskId\s*=\s*'([^']+)'/)?.[1];
    return { token, task };
}

async function upimage(fileBuffer, mimetype, originalName, token, task) {
    const mimeInfo = await fromBuffer(fileBuffer);
    const contentType = mimeInfo ? mimeInfo.mime : (mimetype || 'image/jpeg');

    const filename = originalName || `${crypto.randomBytes(6).toString('hex')}.jpg`;

    const form = new FormData();
    form.append('name', filename);
    form.append('chunk', '0');
    form.append('chunks', '1');
    form.append('task', task);
    form.append('preview', '1');
    form.append('v', 'web.0');

    form.append('file', fileBuffer, {
        filename: filename,
        contentType: contentType,
        knownLength: fileBuffer.length
    });

    const r = await axios.post('https://api29g.iloveimg.com/v1/upload', form, {
        headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${token}`,
            Origin: 'https://www.iloveimg.com',
            Referer: 'https://www.iloveimg.com/'
        },
        maxContentLength: Infinity, // Tanpa batas respon axios
        maxBodyLength: Infinity     // Tanpa batas body request axios
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
        responseType: 'arraybuffer',
        maxContentLength: Infinity,
        maxBodyLength: Infinity
    });

    return r.data;
}

// --- ENDPOINT ROUTE (METHOD POST) ---

router.post('/', upload.single('fileToUpload'), async (req, res) => {
    try {
        const file = req.file;
        const scaleParam = req.body.scale?.toString().trim() || '2';

        if (!file) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Berkas 'fileToUpload' wajib diunggah!"
            });
        }

        if (!config.includes(String(scaleParam))) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: `Scale tidak valid! Gunakan salah satu opsi: ${config.join(', ')}`
            });
        }

        // Alur Eksekusi Scraper
        const { token, task } = await gettoken();
        const serverfilename = await upimage(file.buffer, file.mimetype, file.originalname, token, task);
        const imageBuffer = await doUpscale(serverfilename, token, task, scaleParam);

        // Kirimkan respons langsung berupa file gambar
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

// --- CONFIG PARAMETERS UNTUK DASHBOARD UI ---
router.paramsConfig = {
    fileToUpload: {
        type: "file",
        desc: "Berkas gambar yang akan di-upscale"
    },
    scale: {
        type: "select",
        options: ["2", "4"]
    }
};

router.status = "ready"; 
router.type = "free";

module.exports = router;