const axios = require('axios');
const express = require('express');
const router = express.Router();

// ======================================================
// CORE AL-QURAN API FUNCTION
// ======================================================
async function getSurah(number) {
    const url = `https://api.alquran.cloud/v1/surah/${number}/editions/quran-uthmani,id.indonesian`;
    const { data } = await axios.get(url);

    if (!data?.data || data.data.length < 2) {
        throw new Error("Data surah tidak valid atau tidak ditemukan");
    }

    const arab = data.data[0];
    const indo = data.data[1];

    const ayahs = arab.ayahs.map((a, i) => ({
        number: a.numberInSurah,
        arabic: a.text,
        translation: indo.ayahs[i]?.text || "-"
    }));

    return {
        number: arab.number,
        name: arab.englishName,
        arabic_name: arab.name,
        total_ayah: arab.numberOfAyahs,
        ayahs
    };
}

// ======================================================
// ENDPOINT GET UTAMA
// ======================================================
router.get('/', async (req, res) => {
    const number = req.query.number;

    if (!number || isNaN(number)) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'number' wajib diisi dan harus berupa angka! Contoh: ?number=1"
        });
    }

    try {
        const result = await getSurah(number);

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            result,
            metadata: {
                source: "alquran.cloud",
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: "Gagal mengambil data surah",
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;