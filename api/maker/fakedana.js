const express = require("express");
const axios = require("axios");
const {
    createCanvas,
    loadImage,
    GlobalFonts
} = require("@napi-rs/canvas");

const router = express.Router();

const FONT_URL = "https://cdn.jsdelivr.net/fontsource/fonts/plus-jakarta-sans@latest/latin-600-normal.ttf";
const BG_URL = "https://cdn.arulzzxd.my.id/files/F4pjW08L.png";
const EYE_URL = "https://cdn.arulzzxd.my.id/files/XqtOfI.png";

let fontLoaded = false;

async function loadFont() {
    if (fontLoaded) return;

    const { data } = await axios.get(FONT_URL, {
        responseType: "arraybuffer",
        headers: { "User-Agent": "Mozilla/5.0" }
    });

    GlobalFonts.register(
        Buffer.from(data),
        "DANA"
    );

    fontLoaded = true;
}

async function getBuffer(url) {
    const { data } = await axios.get(url, {
        responseType: "arraybuffer",
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    return Buffer.from(data);
}

router.get("/", async (req, res) => {
    try {
        let saldo = req.query.saldo?.trim() || req.query.text?.trim();

        if (!saldo) {
            return res.status(400).json({
                status: false,
                message: "Parameter saldo atau text wajib diisi (Contoh: ?saldo=50.000)"
            });
        }

        await loadFont();

        // Mengambil gambar background & icon mata secara paralel
        const [bgBuffer, eyeBuffer] = await Promise.all([
            getBuffer(BG_URL),
            getBuffer(EYE_URL)
        ]);

        const bgImg = await loadImage(bgBuffer);
        const eyeImg = await loadImage(eyeBuffer);

        const canvas = createCanvas(bgImg.width, bgImg.height);
        const ctx = canvas.getContext("2d");

        // Render Background
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

        // Pengaturan Koordinat & Ukuran
        const valX = 138;       // Posisi tepat di samping "Rp"
        const valY = 50;        // Margin atas sejajar teks "Rp"
        const maxFontSize = 35; // Ukuran font proporsional dengan "Rp"
        const eyeGap = 8;       // Jarak antara teks saldo dan ikon mata
        const eyeScale = 0.72;  // Skala ukuran ikon mata

        let currentFontSize = maxFontSize;
        const maxAllowedWidth = canvas.width - valX - 120;

        ctx.font = `600 ${currentFontSize}px "DANA"`;
        let textWidth = ctx.measureText(saldo).width;

        // Atur ukuran font jika teks saldo terlalu panjang
        while (textWidth > maxAllowedWidth && currentFontSize > 16) {
            currentFontSize -= 2;
            ctx.font = `600 ${currentFontSize}px "DANA"`;
            textWidth = ctx.measureText(saldo).width;
        }

        // Render Teks Saldo (Warna hitam/gelap sesuai header DANA)
        ctx.fillStyle = "#212121";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(saldo, valX, valY);

        // Render Icon Mata Presisi di Samping Saldo
        const eyeHeight = currentFontSize * eyeScale;
        const eyeWidth = (eyeImg.width / eyeImg.height) * eyeHeight;
        const eyeX = valX + textWidth + eyeGap;
        const eyeY = valY + (currentFontSize - eyeHeight) / 2 + 1;

        ctx.drawImage(eyeImg, eyeX, eyeY, eyeWidth, eyeHeight);

        // Response Buffer Gambar PNG
        const buffer = await canvas.encode("png");
        res.setHeader("Content-Type", "image/png");
        res.end(buffer);

    } catch (err) {
        res.status(500).json({
            status: false,
            message: err.message
        });
    }
});

router.desc = "Maker untuk membuat tampilan Fake Saldo DANA.";
router.paramsConfig = {
  saldo: "contoh: 50000"
};
router.status = "ready";
router.type = "free";

module.exports = router;
