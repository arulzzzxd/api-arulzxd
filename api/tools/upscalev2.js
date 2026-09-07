/**
 * ✦ Nama Scrape : Live3D Image Upscaler API
 * ✦ Creator     : t.me/IkyyExecutive & ArulzXD
 * ✦ Deskripsi   : Meningkatkan resolusi/kualitas gambar murni via upload file menggunakan Live3D AI Engine.
 */

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const multer = require('multer');

const router = express.Router();
const upload = multer();

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCwlO+boC6cwRo3UfXVBadaYwcX
0zKS2fuVNY2qZ0dgwb1NJ+/Q9FeAosL4ONiosD71on3PVYqRUlL5045mvH2K9i8b
AFVMEip7E6RMK6tKAAif7xzZrXnP1GZ5Rijtqdgwh+YmzTo39cuBCsZqK9oEoeQ3
r/myG9S+9cR5huTuFQIDAQAB
-----END PUBLIC KEY-----`;

const APP_ID = "aifaceswap";
const U_ID = "1H5tRtzsBkqXcaJ";
const FN_NAME = "demo-image-upscaler";
const BRAND_KEY = "8f3f0c7387123ae0";

function generateRandomString(len) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let res = "";
    for (let i = 0; i < len; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res;
}

function aesenc(data, key) {
    const k = CryptoJS.enc.Utf8.parse(key);
    const encrypted = CryptoJS.AES.encrypt(data, k, {
        iv: k,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.toString();
}

function rsaenc(data) {
    const buffer = Buffer.from(data, 'utf8');
    const encrypted = crypto.publicEncrypt({
        key: PUBLIC_KEY,
        padding: crypto.constants.RSA_PKCS1_PADDING,
    }, buffer);
    return encrypted.toString('base64');
}

function gencryptoheaders(type, fp = null) {
    const e = new Date();
    const n = Math.floor(new Date(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), e.getUTCHours(), e.getUTCMinutes(), e.getUTCSeconds()).getTime() / 1000);
    const r = crypto.randomUUID();
    const i = generateRandomString(16);
    const fingerPrint = fp || crypto.randomBytes(16).toString('hex');
    const s = rsaenc(i);
    let signStr = (type === 'upload') ? `${APP_ID}:${r}:${s}` : `${APP_ID}:${U_ID}:${n}:${r}:${s}`;
    return {
        'fp': fingerPrint,
        'fp1': aesenc(`${APP_ID}:${fingerPrint}`, i),
        'x-guide': s,
        'x-sign': aesenc(signStr, i),
        'x-code': Date.now().toString()
    };
}

async function uploadImageBuffer(buffer, mimeType = 'image/jpeg') {
    const cryptoHeaders = gencryptoheaders('upload');
    
    const form = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    form.append('file', blob, 'input.jpg');
    form.append('fn_name', FN_NAME);
    form.append('request_from', '9');
    form.append('origin_from', BRAND_KEY);

    const res = await fetch('https://app-v1.live3d.io/aitools/upload-img', {
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
            'origin': 'https://live3d.io',
            'referer': 'https://live3d.io/',
            'theme-version': '83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q',
            ...cryptoHeaders
        },
        body: form
    });
    const data = await res.json();
    if (!data.data || !data.data.path) {
        throw new Error("Gagal mengunggah gambar ke server Live3D.");
    }
    return { path: data.data.path, fp: cryptoHeaders.fp };
}

async function createJob(imgRemote, scale = 4, fp) {
    const cryptoHeaders = gencryptoheaders('create', fp);
    const payload = {
        fn_name: FN_NAME,
        call_type: 3,
        input: {
            source_image: imgRemote,
            scale: scale,
            request_from: 9
        },
        request_from: 9,
        origin_from: BRAND_KEY
    };
    const res = await axios.post('https://app-v1.live3d.io/aitools/of/create', payload, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
            'theme-version': '83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q',
            ...cryptoHeaders
        }
    });
    if (!res.data.data || !res.data.data.task_id) {
        throw new Error("Gagal membuat tugas pemrosesan di Live3D.");
    }
    return res.data.data.task_id;
}

async function cekjob(taskId, fp) {
    const cryptoHeaders = gencryptoheaders('check', fp);
    const payload = {
        task_id: taskId,
        fn_name: FN_NAME,
        call_type: 3,
        request_from: 9,
        origin_from: BRAND_KEY
    };
    const res = await axios.post('https://app-v1.live3d.io/aitools/of/check-status', payload, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
            'theme-version': '83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q',
            ...cryptoHeaders
        }
    });
    return res.data.data;
}

router.post('/', upload.single('fileupload'), async (req, res) => {
    const start = Date.now();
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                status: false,
                creator: 'ArulzXD',
                message: "Berkas 'fileupload' wajib diunggah!"
            });
        }

        const scaleFactor = parseInt(req.body.scale || req.body.multiplier, 10) || 4;
        const uploadInfo = await uploadImageBuffer(file.buffer, file.mimetype || 'image/jpeg');
        const taskId = await createJob(uploadInfo.path, scaleFactor, uploadInfo.fp);

        let result;
        let attempts = 0;
        const maxAttempts = 20;

        while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 3000));
            result = await cekjob(taskId, uploadInfo.fp);
            
            if (result.status === 2) break;
            if (result.status === 3) throw new Error("Proses peningkatan kualitas gambar gagal dari server Live3D.");
            attempts++;
        }

        if (!result || result.status !== 2) throw new Error("Waktu proses habis (timeout).");

        return res.json({
            status: true,
            creator: "ArulzXD",
            runtime: `${Date.now() - start} ms`,
            result: {
                task_id: taskId,
                scale: `${scaleFactor}x`,
                result_url: 'https://temp.live3d.io/' + result.result_image
            }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            creator: 'ArulzXD',
            message: err.message || 'Terjadi kesalahan saat meningkatkan resolusi gambar.'
        });
    }
});

router.desc = "Meningkatkan resolusi dan kualitas gambar secara otomatis menggunakan AI Live3D murni via unggah berkas gambar.";
router.paramsConfig = {
    fileupload: {
        type: "file",
        desc: "Berkas gambar yang akan ditingkatkan resolusinya"
    },
    scale: {
        type: "select",
        options: ["2", "4"],
        default: "4",
        desc: "Tingkat pembesaran gambar"
    }
};
router.status = "ready";
router.type = "free";

module.exports = router;
