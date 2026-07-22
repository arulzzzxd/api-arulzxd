const axios = require('axios');
const express = require('express');
const router = express.Router();

// ======================================================
// CORE BMKG GEMPA FUNCTION
// ======================================================
async function getGempaBMKG() {
    const endpoint = "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json";
    const baseUrl = "https://data.bmkg.go.id/DataMKG/TEWS/";

    const { data } = await axios.get(endpoint, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36",
            "Accept": "application/json"
        },
        timeout: 15000
    });

    const gempa = data?.Infogempa?.gempa;

    if (!gempa) {
        throw new Error("Data gempa tidak ditemukan");
    }

    return {
        tanggal: gempa.Tanggal,
        jam: gempa.Jam,
        coordinates: gempa.Coordinates,
        lintang: gempa.Lintang,
        bujur: gempa.Bujur,
        magnitude: parseFloat(gempa.Magnitude),
        kedalaman: gempa.Kedalaman,
        wilayah: gempa.Wilayah,
        potensi: gempa.Potensi,
        dirasakan: gempa.Dirasakan,
        shakemap: gempa.Shakemap ? baseUrl + gempa.Shakemap : null
    };
}

// ======================================================
// ENDPOINT GET UTAMA
// ======================================================
router.get('/', async (req, res) => {
    try {
        const result = await getGempaBMKG();

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            result,
            metadata: {
                source: 'BMKG',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: 'Gagal mengambil data gempa BMKG',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;
