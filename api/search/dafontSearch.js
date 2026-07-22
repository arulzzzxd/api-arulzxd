const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const query = req.query.q?.trim();

        // Validasi parameter pencarian
        if (!query) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'q' (keyword pencarian) wajib diisi"
            });
        }

        // Request ke halaman pencarian Dafont
        const response = await axios.get("https://www.dafont.com/search.php", {
            params: { q: query },
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
            }
        });

        const $ = cheerio.load(response.data);
        const results = [];

        // Di Dafont, setiap baris/kotak font dibungkus oleh class .fontbox
        $(".fontbox").each((index, element) => {
            const fontBox = $(element);

            // 1. Mengambil Judul Font dan Author
            const titleZone = fontBox.find(".lv1left");
            const fontName = titleZone.find("a").first().text().trim() || "Unknown";
            
            // Format author biasanya mengandung teks "by [Nama]"
            const authorText = titleZone.text().replace(fontName, "").replace("by", "").trim();
            const author = authorText || "Unknown";

            // 2. Mengambil Informasi Lisensi & Jumlah Download
            const rightZone = fontBox.find(".lv1right");
            const downloadCount = rightZone.text().match(/[\d,.]+/)?.[0] || "0";
            
            const licenseZone = fontBox.find(".licence");
            const license = licenseZone.text().trim() || "Unknown";

            // 3. Mengambil Gambar Preview Teks Font
            // Dafont menaruh preview gambar di dalam elemen <a> yang membungkus <img> dengan class .dl atau sejenisnya
            const previewImg = fontBox.find(".dl2 img, img.dl").attr("src");
            const previewUrl = previewImg ? `https://www.dafont.com/${previewImg}` : null;

            // 4. Mengambil ID Font untuk Link Unduh (.zip)
            const downloadHref = fontBox.find(".dl").attr("href");
            let downloadLink = null;
            if (downloadHref) {
                const fontId = downloadHref.match(/id=(\d+)/)?.[1];
                if (fontId) {
                    downloadLink = `https://dl.dafont.com/dl/?f=${fontId}`;
                } else if (downloadHref.startsWith("//") || downloadHref.startsWith("http")) {
                    downloadLink = downloadHref.startsWith("//") ? `https:${downloadHref}` : downloadHref;
                } else {
                    downloadLink = `https://www.dafont.com/${downloadHref}`;
                }
            }

            // Hindari memasukkan data kosong
            if (fontName !== "Unknown") {
                results.push({
                    name: fontName,
                    author: author,
                    total_downloads: downloadCount,
                    license: license,
                    preview_image: previewUrl,
                    download_zip: downloadLink
                });
            }
        });

        // Kirim response JSON hasil penelusuran
        res.json({
            status: true,
            total_results: results.length,
            results: results
        });

    } catch (err) {
        res.status(500).json({
            status: false,
            message: err.message
        });
    }
});

router.status = "ready";
router.type = "free";
module.exports = router;
