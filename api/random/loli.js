const axios = require('axios');
const express = require('express');
const router = express.Router();

// Fungsi untuk mengambil gambar secara acak
async function loli() {
    try {
        const { data } = await axios.get(`https://raw.githubusercontent.com/rynxzyy/loli-r-img/refs/heads/main/links.json`);
        const response = await axios.get(data[Math.floor(data.length * Math.random())], { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    } catch (error) {
        throw error;
    }
}

// Endpoint utama Router
router.get('/', async (req, res) => {
    try {
        const pedo = await loli();
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': pedo.length,
        });
        res.end(pedo);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;