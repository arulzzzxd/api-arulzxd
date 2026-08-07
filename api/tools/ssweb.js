const express = require('express');
const router = express.Router();
const axios = require('axios');

// Pemetaan nama device ke format ScreenshotMachine
const deviceMap = {
    desktop: 'desktop',
    phone: 'phone', // Mobile / Phone
    tablet: 'tablet' // Tablet
};

// Fungsi scraper yang otomatis mengaktifkan full-page
const sswebBuffer = (url, device = 'desktop') => {
    return new Promise((resolve, reject) => {
        const base = 'https://www.screenshotmachine.com';
        const selectedDevice = deviceMap[device.toLowerCase()] || 'desktop';

        const param = {
            url: url,
            device: selectedDevice,
            cacheLimit: 0,
            dimension : '1366xfull'
        };

        axios({
            url: base + '/capture.php',
            method: 'POST',
            data: new URLSearchParams(Object.entries(param)),
            headers: {
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
            }
        }).then((data) => {
            const cookies = data.headers['set-cookie'];
            if (data.data.status === 'success') {
                axios.get(base + '/' + data.data.link, {
                    headers: {
                        'cookie': cookies ? cookies.join('') : ''
                    },
                    responseType: 'arraybuffer'
                }).then(({ data: imageBuffer }) => {
                    resolve({ status: 200, result: imageBuffer });
                }).catch(reject);
            } else {
                reject({ status: 404, message: data.data });
            }
        }).catch(reject);
    });
};

// Endpoint API GET
router.get('/', async (req, res) => {
    const url = req.query.url;
    const device = req.query.device || 'desktop';

    if (!url) {
        return res.status(400).json({
            status: 400,
            creator: "Arulz-XD",
            message: "Parameter 'url' wajib diisi. Contoh: ?url=https://google.com&device=desktop"
        });
    }

    // Validasi opsi device
    if (!['desktop', 'phone', 'tablet'].includes(device.toLowerCase())) {
        return res.status(400).json({
            status: 400,
            creator: "Arulz-XD",
            message: "Parameter 'device' tidak valid. Pilih antara: desktop, phone, atau tablet."
        });
    }

    try {
        const screenshot = await sswebBuffer(url, device);
        const buffernya = Buffer.from(screenshot.result);

        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': buffernya.length
        });

        res.end(buffernya);

    } catch (error) {
        res.status(500).json({
            status: 500,
            creator: "Arulz-XD",
            message: "Gagal mengambil gambar screenshot.",
            error: error.message || error
        });
    }
});

// Konfigurasi Parameter UI Dashboard
router.paramsConfig = {
    url: {
        type: "text",
        desc: "URL website yang ingin di-screenshot"
    },
    device: {
        type: "select",
        options: ["desktop", "phone", "tablet"]
    }
};

router.status = "ready";
router.type = "free";
module.exports = router;
