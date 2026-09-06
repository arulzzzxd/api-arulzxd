const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const multer = require("multer");

const router = express.Router();

const const upload = multer();

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
};

async function getWebToken() {
    const r = await axios.get("https://removal.ai/wp-admin/admin-ajax.php", {
        headers,
        params: {
            action: "ajax_get_webtoken",
            security: "4acc8a2f93"
        },
        timeout: 10000
    });
    return r.data?.data?.webtoken;
}

async function removeBackground(fileBuffer, originalName, mimeType) {
    const webToken = await getWebToken();

    if (!webToken) {
        throw new Error("Gagal mendapatkan webtoken dari removal.ai");
    }

    const form = new FormData();
    form.append("image_file", fileBuffer, {
        filename: originalName || "input.jpg",
        contentType: mimeType || "image/jpeg",
        knownLength: fileBuffer.length
    });

    const { data: removeRes } = await axios.post(
        "https://api.removal.ai/3.0/remove",
        form,
        {
            headers: {
                ...headers,
                ...form.getHeaders(),
                "Web-Token": webToken
            },
            timeout: 30000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        }
    );

    const resultUrl = removeRes?.url || removeRes?.high_resolution || removeRes?.low_resolution;

    if (!resultUrl) {
        throw new Error("Gagal mendapatkan URL hasil pemrosesan gambar.");
    }

    return resultUrl;
}

// --- ENDPOINT ROUTE (METHOD POST) ---
router.post("/", upload.single("fileupload"), async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Berkas 'fileupload' wajib diunggah!"
            });
        }

        // 1. Proses penghapusan latar belakang langsung dari Buffer & ambil URL hasilnya
        const resultImageUrl = await removeBackground(
            file.buffer,
            file.originalname,
            file.mimetype
        );

        // 2. Stream hasil gambar kembali ke klien
        const imageStream = await axios.get(resultImageUrl, {
            responseType: "stream",
            headers: {
                "User-Agent": headers["User-Agent"],
                Referer: "https://removal.ai/",
                Origin: "https://removal.ai"
            }
        });

        res.setHeader(
            "Content-Type",
            imageStream.headers["content-type"] || "image/png"
        );

        return imageStream.data.pipe(res);

    } catch (err) {
        console.error("====== SCRAPER ERROR LOG ======");
        console.error(err.response?.data || err.message);
        console.error("===============================");

        return res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message: err.message,
            detail: err.response?.data || null
        });
    }
});

// --- CONFIG PARAMETERS UNTUK DASHBOARD UI ---
router.paramsConfig = {
    fileupload: {
        type: "file",
        desc: "Berkas gambar yang akan dihapus latar belakangnya"
    }
};

router.desc = "Menghapus background gambar otomatis via removal.ai. Menggunakan upload berkas.";
router.status = "ready";
router.type = "free";

module.exports = router;
