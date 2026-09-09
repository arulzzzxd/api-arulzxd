const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const upload = multer({ 
    limits: { 
        fileSize: 50 * 1024 * 1024 // Maksimal 50MB
    } 
});

// Konfigurasi default
const DEFAULT_PIXEL_LEVEL = 30;
const MAX_PIXEL_LEVEL = 40;
const MIN_PIXEL_LEVEL = 1;

// Fungsi untuk mendapatkan ukuran blok
function getBlock(level) {
    const value = Math.min(Math.max(Number(level) || 12, MIN_PIXEL_LEVEL), MAX_PIXEL_LEVEL);
    return 41 - value;
}

// Fungsi utama pixel art
async function processPixelArt(imageBuffer, pixelLevel) {
    try {
        const image = sharp(imageBuffer, { limitInputPixels: false }).rotate().ensureAlpha();
        const meta = await image.metadata();

        const width = meta.width;
        const height = meta.height;
        const block = getBlock(pixelLevel);

        const input = await image.raw().toBuffer();
        const output = Buffer.alloc(input.length);

        for (let y = 0; y < height; y += block) {
            for (let x = 0; x < width; x += block) {
                let r = 0, g = 0, b = 0, a = 0;
                let count = 0;

                const maxY = Math.min(y + block, height);
                const maxX = Math.min(x + block, width);

                for (let yy = y; yy < maxY; yy++) {
                    for (let xx = x; xx < maxX; xx++) {
                        const i = (yy * width + xx) * 4;
                        r += input[i];
                        g += input[i + 1];
                        b += input[i + 2];
                        a += input[i + 3];
                        count++;
                    }
                }

                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);
                a = Math.round(a / count);

                for (let yy = y; yy < maxY; yy++) {
                    for (let xx = x; xx < maxX; xx++) {
                        const i = (yy * width + xx) * 4;
                        output[i] = r;
                        output[i + 1] = g;
                        output[i + 2] = b;
                        output[i + 3] = a;
                    }
                }
            }
        }

        return await sharp(output, {
            raw: {
                width,
                height,
                channels: 4
            }
        })
        .png({
            compressionLevel: 9,
            adaptiveFiltering: false
        })
        .toBuffer();

    } catch (error) {
        throw new Error(`Gagal memproses gambar: ${error.message}`);
    }
}

// Endpoint utama untuk pixel art
router.post('/', upload.single('image'), async (req, res) => {
    try {
        // Validasi file
        if (!req.file) {
            return res.status(400).json({
                status: false,
                message: "File gambar wajib diunggah!",
                code: 400
            });
        }

        // Validasi tipe file
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedMimes.includes(req.file.mimetype)) {
            return res.status(400).json({
                status: false,
                message: "Format file tidak didukung! Gunakan: JPEG, PNG, WEBP, atau GIF",
                code: 400
            });
        }

        // Ambil parameter pixel level (default: 30)
        const pixelLevel = parseInt(req.body.pixel_level) || DEFAULT_PIXEL_LEVEL;
        
        // Validasi pixel level
        if (pixelLevel < MIN_PIXEL_LEVEL || pixelLevel > MAX_PIXEL_LEVEL) {
            return res.status(400).json({
                status: false,
                message: `Pixel level harus antara ${MIN_PIXEL_LEVEL} dan ${MAX_PIXEL_LEVEL}`,
                code: 400
            });
        }

        // Proses pixel art
        const resultBuffer = await processPixelArt(req.file.buffer, pixelLevel);

        // Kirim response berupa gambar
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="pixel-art-${Date.now()}.png"`);
        return res.send(resultBuffer);

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            status: false,
            message: "Terjadi kesalahan internal server",
            error: error.message,
            code: 500
        });
    }
});

// Endpoint untuk mendapatkan informasi
router.get('/info', (req, res) => {
    res.json({
        status: true,
        message: "Pixel Art API",
        description: "Ubah gambar menjadi pixel art",
        parameters: {
            pixel_level: {
                type: "number",
                min: 1,
                max: 40,
                default: 30,
                description: "Semakin kecil nilai, semakin detail pixel art-nya"
            },
            image: {
                type: "file",
                required: true,
                description: "File gambar yang akan diproses"
            }
        },
        example: {
            url: "/pixelart",
            method: "POST",
            body: {
                pixel_level: 25
            },
            formData: {
                image: "file.jpg"
            }
        }
    });
});

// Konfigurasi untuk dashboard UI
router.paramsConfig = {
    image: {
        type: "file",
        desc: "File gambar yang akan diubah menjadi pixel art"
    },
    pixel_level: {
        type: "number",
        min: 1,
        max: 40,
        default: 30,
        desc: "Level pixelasi (1-40, semakin kecil semakin detail)"
    }
};

router.status = "ready";
router.type = "free";

module.exports = router;