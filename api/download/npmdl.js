const express = require('express');
const router = express.Router();
const axios = require('axios');

// ======================================================
// HELPER: PARSE & GET PACKAGE INFO FROM REGISTRY
// ======================================================
async function getPackageNpm(packageName) {
    try {
        // Membersihkan nama package (menghapus spasi jika ada)
        const cleanName = packageName.trim();
        
        // Request ke registry resmi NPM
        const url = `https://registry.npmjs.org/${encodeURIComponent(cleanName)}`;
        const { data } = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        // Mengambil versi terbaru (latest version)
        const latestVersion = data['dist-tags']?.latest;
        if (!latestVersion) {
            throw new Error("Package tidak ditemukan atau versi tidak valid.");
        }

        const packageData = data.versions[latestVersion];

        // Menyusun output data sesuai struktur yang bersih
        return {
            name: data.name,
            description: data.description || "-",
            latest_version: latestVersion,
            license: data.license || "None",
            author: data.author?.name || (typeof data.author === 'string' ? data.author : "-"),
            homepage: data.homepage || "-",
            download: {
                status: true,
                filename: `${data.name}-${latestVersion}.tgz`,
                url: packageData.dist?.tarball // Link unduhan langsung file .tgz package
            }
        };

    } catch (error) {
        if (error.response && error.response.status === 404) {
            throw new Error("Package NPM tidak ditemukan, cek kembali namanya cik.");
        }
        throw new Error(error.message || "Gagal mengambil data dari registry NPM.");
    }
}

// ======================================================
// ENDPOINT ROUTER GET UTAMA
// ======================================================
router.get('/', async (req, res) => {
    // Membaca nama package dari parameter query (?package=nama-package)
    const packageName = req.query.package;

    if (!packageName) {
        return res.status(400).json({
            status: false,
            error: "Missing 'package' parameter. Contoh: ?package=express"
        });
    }

    try {
        const result = await getPackageNpm(packageName);

        return res.status(200).json({
            status: true,
            creator: 'Arulzxd',
            result
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            error: error.message || "Terjadi kesalahan pada server internal."
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;
