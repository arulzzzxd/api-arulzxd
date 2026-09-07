const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const multer = require("multer");

const router = express.Router();

// Middleware Multer dengan batas ukuran memori (misal: 10MB)
const upload = multer({
    limits: { fileSize: 10 * 1024 * 1024 }
});

async function upscaleImg(fileBuffer, originalName, mimeType) {
    const form = new FormData();

    form.append("upfile", fileBuffer, {
        filename: originalName || "image.jpg",
        contentType: mimeType || "image/jpeg"
    });

    const headers = {
        ...form.getHeaders(),
        origin: "https://www.photiu.ai",
        referer: "https://www.photiu.ai/image-upscaler",
        "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "x-paramsjs": JSON.stringify({
            mode: "upscale",
            level: "default"
        })
    };

    // Menggunakan arraybuffer agar aman untuk Vercel / Express Serverless
    const response = await axios.post(
        "https://www.photiu.ai/api/tools/img_improve",
        form,
        {
            headers,
            responseType: "arraybuffer",
            timeout: 60000,
            validateStatus: () => true
        }
    );

    if (response.status !== 200 || !response.data) {
        let errMessage = `HTTP Error ${response.status}`;
        try {
            const errJson = JSON.parse(Buffer.from(response.data).toString("utf-8"));
            errMessage = errJson.message || errJson.msg || errMessage;
        } catch (_) {}
        throw new Error(errMessage);
    }

    return {
        buffer: Buffer.from(response.data),
        contentType: response.headers["content-type"] || mimeType || "image/jpeg"
    };
}

// Endpoint POST dengan pengunggah file
router.post("/", upload.single("fileupload"), async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Berkas 'fileupload' wajib diunggah!"
            });
        }

        const result = await upscaleImg(file.buffer, file.originalname, file.mimetype);

        res.setHeader("Content-Type", result.contentType);
        return res.send(result.buffer);

    } catch (err) {
        console.error("Upscale V2 Error:", err.message);

        return res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message: err.message || "Terjadi kesalahan saat memproses upscale gambar."
        });
    }
});

// Konfigurasi Parameter UI Dashboard
router.paramsConfig = {
    fileupload: {
        type: "file",
        desc: "Berkas gambar yang akan di-upscale"
    }
};

router.status = "ready";
router.type = "free";

module.exports = router;
