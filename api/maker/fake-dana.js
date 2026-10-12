const express = require("express");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const axios = require("axios");

const router = express.Router();

const BG_URL = "https://cdn.arulzzxd.my.id/files/F4pjW08L.png";
const EYE_URL = "https://cdn.arulzzxd.my.id/files/XqtOfI.jpg";
const FONT_URL = "https://cdn.jsdelivr.net/fontsource/fonts/plus-jakarta-sans@latest/latin-600-normal.ttf";

let fontLoaded = false;

async function loadFont() {
  if (fontLoaded) return;

  const { data } = await axios.get(FONT_URL, {
    responseType: "arraybuffer",
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  GlobalFonts.register(Buffer.from(data), "DANA");
  fontLoaded = true;
}

async function loadImageFromUrl(url) {
  const { data } = await axios.get(url, {
    responseType: "arraybuffer",
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  return loadImage(Buffer.from(data));
}

function formatAmount(input) {
  const digits = String(input).replace(/[^\d]/g, "") || "0";
  const normalized = digits.replace(/^0+(?=\d)/, "");

  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

router.get("/", async (req, res) => {
  try {
    const nominal = req.query.nominal || req.query.saldo;

    if (!nominal) {
      return res.status(400).json({
        status: false,
        creator: "ArulzXD",
        message: "Parameter 'nominal' atau 'saldo' diperlukan.",
        example: "/api/maker/fakedana?nominal=50000"
      });
    }

    await loadFont();

    const [bgImg, eyeImg] = await Promise.all([
      loadImageFromUrl(BG_URL),
      loadImageFromUrl(EYE_URL)
    ]);

    const canvas = createCanvas(bgImg.width, bgImg.height);
    const ctx = canvas.getContext("2d");

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

    const valX = 138;
    const valY = 52;
    const maxFontSize = 37;
    const eyeGap = 7;
    const eyeScale = 1.3;

    const inputSaldo = formatAmount(nominal);

    let currentFontSize = maxFontSize;
    const maxAllowedWidth = canvas.width - valX - 100;

    ctx.font = `600 ${currentFontSize}px "DANA"`;
    let textWidth = ctx.measureText(inputSaldo).width;

    while (textWidth > maxAllowedWidth && currentFontSize > 16) {
      currentFontSize -= 2;
      ctx.font = `600 ${currentFontSize}px "DANA"`;
      textWidth = ctx.measureText(inputSaldo).width;
    }

    // Tulis nominal saldo
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(inputSaldo, valX, valY);

    // Gambar icon mata di sebelah saldo
    const eyeHeight = currentFontSize * eyeScale;
    const eyeWidth = (eyeImg.width / eyeImg.height) * eyeHeight;
    const eyeX = valX + textWidth + eyeGap;
    const eyeY = valY + (currentFontSize - eyeHeight) / 2;

    ctx.drawImage(eyeImg, eyeX, eyeY, eyeWidth, eyeHeight);

    const buffer = await canvas.encode("png");

    res.setHeader("Content-Type", "image/png");
    return res.send(buffer);

  } catch (err) {
    return res.status(500).json({
      status: false,
      creator: "ArulzXD",
      error: err.message
    });
  }
});

router.desc = "Maker untuk membuat tampilan Fake Saldo DANA.";
router.paramsConfig = {
  nominal: "contoh: 500000"
};
router.status = "ready";
router.type = "free";

module.exports = router;
