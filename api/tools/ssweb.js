const express = require('express');
const router = express.Router();
const axios = require('axios');

// Fungsi scraper yang mengembalikan data berupa arraybuffer (gambar mentah)
const sswebDesktopBuffer = (url) => {
     return new Promise((resolve, reject) => {
          const base = 'https://www.screenshotmachine.com';
          const param = {
            url: url,
            device: 'desktop', // Otomatis desktop
            cacheLimit: 0
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
               if (data.data.status == 'success') {
                    // Mengambil gambar dalam bentuk arraybuffer
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

    if (!url) {
        return res.status(400).json({
            status: 400,
            creator: "Arulz-XD",
            message: "Parameter 'url' salah atau tidak diisi. Contoh: ?url=https://google.com"
        });
    }

    try {
        const screenshot = await sswebDesktopBuffer(url);
        
        // Mengubah hasil scraper menjadi Buffer Node.js
        const buffernya = Buffer.from(screenshot.result);
        
        // Memasang header sesuai yang kamu inginkan
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': buffernya.length
        });
        
        // Kirimkan buffernya sebagai response utama
        res.end(buffernya);
        
    } catch (error) {
        // Jika gagal, tetap keluarkan response JSON berupa error info
        res.status(500).json({
            status: 500,
            creator: "Arulz-XD",
            message: "Gagal mengambil gambar screenshot.",
            error: error.message || error
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;