const express = require("express");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const path = require("path");
const os = require("os");
const { writeFileSync, existsSync, unlinkSync } = require("fs");

const router = express.Router();

const TTF_URL = "https://cdn.jsdelivr.net/fontsource/fonts/plus-jakarta-sans@latest/latin-600-normal.ttf";
const BG_URL = "https://raw.githubusercontent.com/ryyntwx/Image-rinn/refs/heads/main/fkedana.png";
const EYE_URL = "https://raw.githubusercontent.com/ryyntwx/Image-rinn/refs/heads/main/IMG-20260726-WA1031.jpg";

async function downloadBuffer(url) {
    const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!res.ok) {
        throw new Error(`Download gagal: ${res.status} ${res.statusText}`);
    }
    return Buffer.from(await res.arrayBuffer());
}

let loadedResources = null;

async function getResources() {
    if (loadedResources) return loadedResources;

    const [fontBuffer, bgBuffer, eyeBuffer] = await Promise.all([
        downloadBuffer(TTF_URL),
        downloadBuffer(BG_URL),
        downloadBuffer(EYE_URL)
    ]);

    GlobalFonts.register(fontBuffer, "DANA");

    const [bgImg, eyeImg] = await Promise.all([
        loadImage(bgBuffer),
        loadImage(eyeBuffer)
    ]);

    loadedResources = { bgImg, eyeImg };
    return loadedResources;
}

async function createFakeDanaImage(inputSaldo) {
    const { bgImg, eyeImg } = await getResources();

    const canvas = createCanvas(bgImg.width, bgImg.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

    const valX = 138;
    const valY = 52;
    const maxFontSize = 37;
    const eyeGap = 7;
    const eyeScale = 1.3;

    let currentFontSize = maxFontSize;
    const maxAllowedWidth = canvas.width - valX - 100;

    ctx.font = `600 ${currentFontSize}px DANA`;
    let textWidth = ctx.measureText(inputSaldo).width;

    while (textWidth > maxAllowedWidth && currentFontSize > 16) {
        currentFontSize -= 2;
        ctx.font = `600 ${currentFontSize}px DANA`;
        textWidth = ctx.measureText(inputSaldo).width;
    }

    // Gambar Saldo
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(inputSaldo, valX, valY);

    // Icon Mata
    const eyeHeight = currentFontSize * eyeScale;
    const eyeWidth = (eyeImg.width / eyeImg.height) * eyeHeight;
    const eyeX = valX + textWidth + eyeGap;
    const eyeY = valY + (currentFontSize - eyeHeight) / 2;

    ctx.drawImage(eyeImg, eyeX, eyeY, eyeWidth, eyeHeight);

    return await canvas.encode("png");
}

router.get("/", async (req, res) => {
    try {
        const text = req.query.text?.trim();

        if (!text) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Masukkan parameter text (contoh: ?text=50.000)"
            });
        }

        const imageBuffer = await createFakeDanaImage(text);

        const tempPath = path.join(os.tmpdir(), `fakedana-${Date.now()}.png`);
        writeFileSync(tempPath, imageBuffer);

        res.setHeader("Content-Type", "image/png");

        res.sendFile(tempPath, (err) => {
            if (existsSync(tempPath)) unlinkSync(tempPath);
            if (err && !res.headersSent) {
                console.error("Gagal mengirim file:", err);
            }
        });
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message: err.message
        });
    }
});

router.paramsConfig = {
    text: "text"
};

router.status = "ready";
router.type = "free";

module.exports = router;