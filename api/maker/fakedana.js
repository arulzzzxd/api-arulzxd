const express = require("express");
const axios = require("axios");
const {
    createCanvas,
    loadImage,
    GlobalFonts
} = require("@napi-rs/canvas");

const router = express.Router();

const FONT_URL = "https://cdn.jsdelivr.net/fontsource/fonts/plus-jakarta-sans@latest/latin-700-normal.ttf";
const BG_URL = "https://cdn.arulzzxd.my.id/files/F4pjW08L.png";
const EYE_URL = "https://cdn.arulzzxd.my.id/files/XqtOfI.png";

let fontLoaded = false;
let bgCache = null;
let eyeCache = null;

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

function formatSaldo(input) {
    let text = input.trim();
    if (!/^rp/i.test(text)) {
        if (/^\d+$/.test(text)) {
            text = parseInt(text, 10).toLocaleString("id-ID");
        }
        text = `Rp ${text}`;
    }
    return text;
}

router.get("/", async (req, res) => {
    try {
        const rawSaldo = req.query.saldo?.trim() || req.query.nominal?.trim() || req.query.text?.trim();

        if (!rawSaldo) {
            return res.status(400).json({
                status: false,
                message: "Parameter saldo/nominal/text wajib diisi (contoh: ?saldo=50.000)"
            });
        }

        const saldo = formatSaldo(rawSaldo);

        await loadFont();

        if (!bgCache) bgCache = await getBuffer(BG_URL);
        if (!eyeCache) eyeCache = await getBuffer(EYE_URL);

        const bgImg = await loadImage(bgCache);
        const eyeImg = await loadImage(eyeCache);

        // Canvas ukuran asli tanpa scaling
        const canvas = createCanvas(bgImg.width, bgImg.height);
        const ctx = canvas.getContext("2d");

        // Render Background
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

        // Koordinat & Pengaturan Presisi
        const valX = 112;
        const centerY = 44;
        const maxFontSize = 30;
        const eyeScale = 0.68;
        const eyeGap = 8;

        let currentFontSize = maxFontSize;
        const maxAllowedWidth = canvas.width - valX - 120;

        ctx.font = `700 ${currentFontSize}px "DANA"`;
        let textWidth = ctx.measureText(saldo).width;

        while (textWidth > maxAllowedWidth && currentFontSize > 14) {
            currentFontSize -= 1;
            ctx.font = `700 ${currentFontSize}px "DANA"`;
            textWidth = ctx.measureText(saldo).width;
        }

        // Tulis Nominal Saldo
        ctx.fillStyle = "#000000";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(saldo, valX, centerY);

        // Render Ikon Mata (Presisi Sejajar Tengah)
        const eyeHeight = currentFontSize * eyeScale;
        const eyeWidth = (eyeImg.width / eyeImg.height) * eyeHeight;
        const eyeX = valX + textWidth + eyeGap;
        const eyeY = centerY - (eyeHeight / 2);

        ctx.drawImage(eyeImg, eyeX, eyeY, eyeWidth, eyeHeight);

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
