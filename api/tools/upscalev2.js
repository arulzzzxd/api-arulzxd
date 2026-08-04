const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const multer = require("multer");

const router = express.Router();

// Middleware Multer untuk menangani pengunggahan berkas
const upload = multer();

async function upscaleImg(fileBuffer, originalName, mimeType) {
    const form = new FormData();

    form.append("upfile", fileBuffer, {
        filename: originalName || "image.jpg",
        contentType: mimeType || "image/jpeg"
    });

    // Upscale via photiu.ai
    const result = await axios.post(
        "https://www.photiu.ai/api/tools/img_improve",
        form,
        {
            headers: {
                ...form.getHeaders(),
                origin: "https://www.photiu.ai",
                referer: "https://www.photiu.ai/image-upscaler",
                "user-agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
                "x-paramsjs": JSON.stringify({
                    mode: "upscale",
                    level: "default"
                })
            },
            responseType: "stream"
        }
    );

    return result;
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

        const image = await upscaleImg(file.buffer, file.originalname, file.mimetype);

        res.setHeader(
            "Content-Type",
            image.headers["content-type"] || "image/jpeg"
        );

        image.data.pipe(res);

    } catch (err) {
        console.error(err.response?.data || err.message);

        res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message: err.message
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