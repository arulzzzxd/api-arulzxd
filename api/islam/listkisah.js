const axios = require('axios');
const express = require('express');
const router = express.Router();

// ======================================================
// CORE LIST KISAH NABI FUNCTION
// ======================================================
async function getListKisahNabi() {
    const url = 'https://api.github.com/repos/arulzzzxd/KisahNabi/contents';

    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Arulzxd-API'
        }
    });

    return data
        .filter(file => file.name.endsWith('.json'))
        .map(file => ({
            name: file.name.replace('.json', ''),
            download_url: file.download_url
        }));
}

// ======================================================
// ENDPOINT GET
// ======================================================
router.get('/', async (req, res) => {
    try {
        const result = await getListKisahNabi();

        res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            total: result.length,
            result,
            metadata: {
                source: 'GitHub Repository',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Gagal mengambil daftar kisah nabi',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;