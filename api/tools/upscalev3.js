const express = require('express');
const router = express.Router();
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');

const upload = multer();
const validScales = ['2', '4'];

function generateRandomIP() {
    const r = () => Math.floor(Math.random() * 254) + 1;
    return `${r()}.${r()}.${r()}.${r()}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function upscaleImageBuffer(fileBuffer, mimetype, originalName, scale = '4') {
    const randomIp = generateRandomIP();
    const commonHeaders = {
        'Origin': 'https://imgupscaler.com',
        'Referer': 'https://imgupscaler.com/',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
        'X-Client-Ipv4': randomIp,
        'X-Forwarded-For': randomIp
    };

    const form = new FormData();
    form.append('tool', 'upscaler');
    form.append('mode', 'batch');
    form.append('scaleRadio', scale);
    form.append('file', fileBuffer, {
        filename: originalName || 'image.jpg',
        contentType: mimetype || 'image/jpeg'
    });

    const uploadRes = await axios.post('https://imgupscaler.com/api/legacy/upload', form, {
        headers: {
            ...form.getHeaders(),
            ...commonHeaders
        }
    });

    const taskId = uploadRes.data?.taskId;
    if (!taskId) {
        throw new Error('Gagal mendapatkan taskId dari server.');
    }

    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
        attempts++;
        await sleep(2000);

        const statusRes = await axios.post('https://imgupscaler.com/api/legacy/status', 
            {
                tool: 'upscaler',
                taskId: taskId,
                scaleRadio: scale
            }, 
            {
                headers: {
                    'Content-Type': 'application/json',
                    ...commonHeaders
                }
            }
        );

        const resData = statusRes.data;

        if (resData.status === 'success' && resData.downloadUrls && resData.downloadUrls.length > 0) {
            return {
                downloadUrl: resData.downloadUrls[0],
                taskId: taskId
            };
        }

        if (resData.status !== 'waiting') {
            throw new Error('Proses pemrosesan gambar gagal di server target.');
        }
    }

    throw new Error('Timeout: Pemrosesan upscale memakan waktu terlalu lama.');
}

// Endpoint POST untuk pengunggahan file
router.post('/', upload.single('fileupload'), async (req, res) => {
    try {
        const file = req.file;
        const scaleParam = req.body.scale?.toString().trim() || '4';

        if (!file) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Berkas 'fileupload' wajib diunggah!"
            });
        }

        if (!validScales.includes(scaleParam)) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: `Scale tidak valid! Gunakan salah satu opsi: ${validScales.join(', ')}`
            });
        }

        // Jalankan proses upscale
        const upscaleResult = await upscaleImageBuffer(
            file.buffer,
            file.mimetype,
            file.originalname,
            scaleParam
        );

        // Ambil buffer gambar dari hasil URL unduhan
        const imageResponse = await axios.get(upscaleResult.downloadUrl, {
            responseType: 'arraybuffer'
        });

        res.setHeader(
            'Content-Type',
            imageResponse.headers['content-type'] || 'image/png'
        );

        return res.send(Buffer.from(imageResponse.data));

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

// Konfigurasi Parameter UI Dashboard
router.paramsConfig = {
    fileupload: {
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
