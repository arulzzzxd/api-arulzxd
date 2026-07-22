const axios = require('axios');
const express = require('express');
const router = express.Router();

// ======================================================
// CORE AL-QURAN API FUNCTION
// ======================================================
async function listSurah() {
    const { data } = await axios.get("https://api.alquran.cloud/v1/surah");

    // Validasi response sesuai API alquran.cloud
    if (!data || data.code !== 200) {
        throw new Error("Gagal mengambil daftar surah dari server");
    }

    const result = data.data.map(surah => ({
        number: surah.number,
        name: surah.englishName,
        arabic_name: surah.name,
        translation: surah.englishNameTranslation,
        total_ayah: surah.numberOfAyahs,
        revelation: surah.revelationType
    }));

    return result;
}

// ======================================================
// ENDPOINT GET UTAMA
// ======================================================
router.get('/', async (req, res) => {
    try {
        const result = await listSurah();

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            total_surah: result.length,
            result
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            creator: 'Arulzxd',
            message: error.message
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;