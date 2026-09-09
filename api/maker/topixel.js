const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');

const router = express.Router();
const upload = multer();

// Fungsi pixel art yang sudah ada
function getBlock(level) {
  const value = Math.min(Math.max(Number(level) || 12, 1), 40);
  return 41 - value;
}

async function pixelArt(fileBuffer, pixelLevel = 30) {
  try {
    const image = sharp(fileBuffer, { limitInputPixels: false }).rotate().ensureAlpha();
    const meta = await image.metadata();

    const width = meta.width;
    const height = meta.height;
    const block = getBlock(pixelLevel);

    const input = await image.raw().toBuffer();
    const output = Buffer.alloc(input.length);

    for (let y = 0; y < height; y += block) {
      for (let x = 0; x < width; x += block) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;

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

    const resultBuffer = await sharp(output, {
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

    return {
      Status: true,
      Code: 200,
      buffer: resultBuffer,
      width,
      height,
      pixelLevel
    };
  } catch (e) {
    return {
      Status: false,
      Code: 500,
      Error: e.message
    };
  }
}

// --- ENDPOINT ROUTE (METHOD POST) ---

router.post('/', upload.single('fileupload'), async (req, res) => {
  try {
    const file = req.file;
    const pixelLevel = parseInt(req.body.pixelLevel) || 30;

    if (!file) {
      return res.status(400).json({
        status: false,
        creator: "Arulzxd",
        message: "Berkas 'fileupload' wajib diunggah!"
      });
    }

    // Validasi pixel level (1-40)
    if (pixelLevel < 1 || pixelLevel > 40) {
      return res.status(400).json({
        status: false,
        creator: "Arulzxd",
        message: "Pixel level harus antara 1-40!"
      });
    }

    // Proses pixel art
    const result = await pixelArt(file.buffer, pixelLevel);

    if (!result.Status) {
      return res.status(500).json({
        status: false,
        creator: "Arulzxd",
        message: "Gagal memproses pixel art",
        error: result.Error
      });
    }

    // Kirimkan respons langsung berupa file gambar
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="pixel-art-${Date.now()}.png"`);
    return res.send(result.buffer);

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      creator: "Arulzxd",
      message: "Internal Server Error saat memproses pixel art",
      error: err.message
    });
  }
});

// --- CONFIG PARAMETERS UNTUK DASHBOARD UI ---
router.paramsConfig = {
  fileupload: {
    type: "file",
    desc: "Berkas gambar yang akan diubah menjadi pixel art"
  },
  pixelLevel: {
    type: "select",
    desc: "Tingkat pixelasi (1-40, semakin kecil semakin detail)",
    options: Array.from({ length: 40 }, (_, i) => String(i + 1)),
    default: 30
  }
};

router.desc = "Tingkat pixelasi (1-40, semakin kecil semakin detail)";
router.status = "ready";
router.type = "free";
module.exports = router;