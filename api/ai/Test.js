/**
 * ✦ Nama Scrape : Remaker AI Photo Editor (Prompt Edit / Inpainting)
 * ✦ Author      : ArulzXD
 * ✦ Deskripsi   : Mengubah/mengedit bagian foto berdasarkan instruksi teks (prompt) menggunakan AI Remaker.
 */

const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const multer = require('multer');

const router = express.Router();
const upload = multer({
  limits: { fileSize: 15 * 1024 * 1024 }
});

const PROXY_API = 'https://api.ikyyxd.my.id/v2l/proxy-free/ikyy-xsample';
const BASE_URL = 'https://api.remaker.ai';
const PRODUCT_CODE = '067003';
const PRODUCT_SERIAL = 'd0556055c62201b80a956de9c4ad7d37';
const REFERER_URL = 'https://remaker.ai/ai-photo-editor/';

let proxies = [];

async function fetchProxies() {
    try {
        const res = await axios.get(PROXY_API, { timeout: 10000 });
        if (!Array.isArray(res.data)) throw new Error('Format proxy tidak valid');
        proxies = res.data.filter(p => p.split(':').length === 4);
    } catch (err) {
        console.error(`[PROXY ERROR] ${err.message}`);
    }
}

function getRandomProxy() {
    if (!proxies.length) return null;
    const p = proxies[Math.floor(Math.random() * proxies.length)];
    const [host, port, user, pass] = p.split(':');
    return {
        str: p,
        config: { host, port: parseInt(port), auth: { username: user, password: pass }, protocol: 'http' }
    };
}

async function createJob(file, prompt, proxyConfig) {
    const form = new FormData();
    const ext = file.mimetype.includes('png') ? 'png' : (file.mimetype.includes('webp') ? 'webp' : 'jpg');

    form.append('image', Readable.from(file.buffer), { filename: `input.${ext}`, contentType: file.mimetype });
    form.append('prompt', prompt);
    form.append('version', '2');

    const clientAxiosConfig = {
        baseURL: BASE_URL,
        timeout: 60000,
        headers: { 
            ...form.getHeaders(), 
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36', 
            'Origin': 'https://remaker.ai', 
            'Referer': REFERER_URL, 
            'Product-Code': PRODUCT_CODE, 
            'Product-Serial': PRODUCT_SERIAL 
        }
    };

    if (proxyConfig?.config) {
        clientAxiosConfig.proxy = proxyConfig.config;
    }

    const client = axios.create(clientAxiosConfig);

    const res = await client.post('/api/pai/v3/ai-photo-editor/appapi/create-job', form);
    if (res.data.code !== 100000) throw new Error(`Create job failed: ${res.data.message?.en || 'Unknown error'}`);
    return res.data.result.job_id;
}

async function getResult(jobId, proxyConfig) {
    const clientAxiosConfig = {
        baseURL: BASE_URL,
        timeout: 60000,
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36', 
            'Origin': 'https://remaker.ai', 
            'Referer': REFERER_URL, 
            'Product-Code': PRODUCT_CODE, 
            'Product-Serial': PRODUCT_SERIAL 
        }
    };

    if (proxyConfig?.config) {
        clientAxiosConfig.proxy = proxyConfig.config;
    }

    const client = axios.create(clientAxiosConfig);

    for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 6000));
        const res = await client.get(`/api/pai/v3/ai-photo-editor/appapi/get-job/${jobId}`);
        
        if (res.data.code === 100000 && res.data.result.output_image_url?.length > 0) {
            return res.data.result.output_image_url[0];
        }
        if (res.data.code !== 100002) throw new Error(`Polling failed: ${res.data.message?.en || 'Unknown error'}`);
    }
    throw new Error('Timeout saat menunggu hasil editing gambar.');
}

router.post('/', upload.single('fileupload'), async (req, res) => {
    const start = Date.now();
    try {
        const file = req.file;
        const prompt = req.body.prompt?.trim() || req.body.text?.trim();

        if (!file) {
            return res.status(400).json({
                status: false,
                creator: 'ArulzXD',
                message: "Wajib mengunggah berkas 'fileupload'!"
            });
        }

        if (!prompt) {
            return res.status(400).json({
                status: false,
                creator: 'ArulzXD',
                message: "Parameter 'prompt' tidak boleh kosong!"
            });
        }

        if (proxies.length === 0) {
            await fetchProxies();
        }

        let success = false;
        let lastError = '';
        let resultUrl = '';
        let usedProxyIp = '';

        const maxAttempts = proxies.length > 0 ? 5 : 1;

        for (let i = 0; i < maxAttempts; i++) {
            const proxyConfig = getRandomProxy();
            usedProxyIp = proxyConfig ? proxyConfig.str.split(':')[0] : 'direct';

            try {
                const jobId = await createJob(file, prompt, proxyConfig);
                resultUrl = await getResult(jobId, proxyConfig);
                success = true;
                break;
            } catch (err) {
                lastError = err.message;
            }
        }

        if (!success || !resultUrl) {
            return res.status(500).json({
                status: false,
                creator: 'ArulzXD',
                message: lastError || 'Gagal memproses gambar setelah beberapa kali percobaan.'
            });
        }

        return res.json({
            status: true,
            creator: 'ArulzXD',
            runtime: `${Date.now() - start} ms`,
            result: {
                prompt: prompt,
                result_url: resultUrl,
                proxy_ip: usedProxyIp,
                processed_at: new Date().toISOString()
            }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            creator: 'ArulzXD',
            message: err.message || 'Terjadi kesalahan pada server saat memproses Remaker AI Photo Editor.'
        });
    }
});

router.desc = "Mengedit foto berdasarkan instruksi teks (prompt) menggunakan Remaker AI Photo Editor.";
router.paramsConfig = {
    fileupload: {
        type: "file",
        desc: "Berkas foto yang ingin diedit"
    },
    prompt: "text (wajib, contoh: Add sunglasses to the face)"
};
router.status = "ready";
router.type = "free";

module.exports = router;
