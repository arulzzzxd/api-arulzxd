/**
 * NAMA SCRAPE  :: BGERASER REMOVE BACKGROUND
 * [•] BASIS        :: bgeraser.com
 */

const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const multer = require("multer");
const { fromBuffer } = require("file-type");

const router = express.Router();
const upload = multer();

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function removeBgBuffer(fileBuffer, mimetype, originalName) {
    const mimeInfo = await fromBuffer(fileBuffer);
    const contentType = mimeInfo ? mimeInfo.mime : (mimetype || "image/png");
    const filename = originalName || "image.png";

    const form = new FormData();
    form.append("file", fileBuffer, {
        filename: filename,
        contentType: contentType,
        knownLength: fileBuffer.length
    });
    form.append("type", "4");
    form.append("mattValue", "0");

    const { data: uploadRes } = await axios.post(
        "https://bgeraser.com/api/bgeraser/legacy/upload",
        form,
        {
            headers: {
                ...form.getHeaders(),
                origin: "https://bgeraser.com",
                referer: "https://bgeraser.com/",
                "user-agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        }
    );

    if (!uploadRes || !uploadRes.taskId) {
        throw new Error("Upload gagal.");
    }

    const taskId = uploadRes.taskId;

    for (let i = 0; i < 20; i++) {
        await sleep(2000);

        const { data: status } = await axios.post(
            "https://bgeraser.com/api/bgeraser/legacy/status",
            {
                type: 4,
                codes: [taskId]
            },
            {
                headers: {
                    origin: "https://bgeraser.com",
                    referer: "https://bgeraser.com/",
                    "user-agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            }
        );

        if (
            status &&
            status.status === "success" &&
            status.downloadUrls &&
            status.downloadUrls[taskId]
        ) {
            return status.downloadUrls[taskId];
        }
    }

    throw new Error("Timeout menunggu hasil.");
}

// --- ENDPOINT ROUTE (METHOD POST) ---
router.post("/", upload.single("fileupload"), async (req, res) => {
    try {
        const file = req.file;
        const apikey = req.body.apikey || req.query.apikey;

        if (!apikey) {
            return res.status(403).json({
                status: false,
                message: "Parameter 'apikey' diperlukan."
            });
        }

        if (apikey !== "arulzxd-keys") {
            return res.status(403).json({
                status: false,
                message: "Apikey tidak valid."
            });
        }

        if (!file) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Berkas 'fileupload' wajib diunggah!"
            });
        }

        // 1. Proses penghapusan latar belakang langsung dari Buffer
        const resultImageUrl = await removeBgBuffer(file.buffer, file.mimetype, file.originalname);

        // 2. Stream hasil gambar kembali ke klien
        const imageStream = await axios.get(resultImageUrl, {
            responseType: "stream",
            headers: {
                "User-Agent": "Mozilla/5.0",
                Referer: "https://bgeraser.com/",
                Origin: "https://bgeraser.com"
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
    },
    apikey: {
        type: "text",
        desc: "API Key akses endpoint"
    }
};

router.desc = "Menghapus background gambar otomatis via bgeraser. Menggunakan upload berkas.";
router.status = "ready";
router.type = "free";
module.exports = router;
