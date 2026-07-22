const axios = require('axios');
const express = require('express');
const router = express.Router();

// ======================================================
// CORE KISAH NABI API FUNCTION
// ======================================================
async function getKisahNabi(query) {
    const filename = query
        .toLowerCase()
        .replace(/\s+/g, '-');

    const url = `https://raw.githubusercontent.com/arulzzzxd/KisahNabi/heads/main/${filename}.json`;

    const { data } = await axios.get(url);

    if (!data) {
        throw new Error('Kisah nabi tidak ditemukan');
    }

    return data;
}

// ======================================================
// ENDPOINT GET UTAMA
// ======================================================
router.get('/', async (req, res) => {
    const query = req.query.query;

    if (!query) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'query' wajib diisi! Contoh: ?query=nabi-adam"
        });
    }

    try {
        const result = await getKisahNabi(query);

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            result,
            metadata: {
                source: 'github.com/arulzzzxd/KisahNabi',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: 'Gagal mengambil kisah nabi',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;