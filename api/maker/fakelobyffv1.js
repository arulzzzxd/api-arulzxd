const express = require("express");
const axios = require("axios");
const sharp = require("sharp");
const {
  createCanvas,
  loadImage,
  GlobalFonts
} = require("@napi-rs/canvas");

const router = express.Router();

const TEMPLATE =
  "https://files.soonex.biz.id/upload/f4065fc2ed8e.jpg";

const TEUTON_URL =
  "https://raw.githubusercontent.com/arulzzzxd/database/main/font/TeutonNormal.otf";

let fontLoaded = false;

async function loadFonts() {
  if (fontLoaded) return;

  const { data } = await axios.get(TEUTON_URL, {
    responseType: "arraybuffer"
  });

  GlobalFonts.register(
    Buffer.from(data),
    "Teuton"
  );

  fontLoaded = true;
}

router.get("/", async (req, res) => {
  try {
    const username =
      (req.query.username || "Arulz")
        .trim()
        .slice(0, 12);

    await loadFonts();

    const { data } = await axios.get(TEMPLATE, {
      responseType: "arraybuffer"
    });

    const bg = await loadImage(
      Buffer.from(data)
    );

    const canvas = createCanvas(
      bg.width,
      bg.height
    );

    const ctx = canvas.getContext("2d");

    ctx.drawImage(
      bg,
      0,
      0,
      bg.width,
      bg.height
    );

    // ==========================
    // NICKNAME FREE FIRE
    // ==========================

    ctx.save();

ctx.font = "29px Teuton";
ctx.textAlign = "left";
ctx.textBaseline = "middle";

const textX = 286;
const textY = 1042;

ctx.lineWidth = 2;
ctx.strokeStyle = "#000";
ctx.strokeText(username, textX, textY);

ctx.fillStyle = "#fff";
ctx.fillText(username, textX, textY);

    ctx.restore();

    const output = await sharp(
      canvas.toBuffer("image/png")
    )
      .png()
      .toBuffer();

    res.setHeader(
      "Content-Type",
      "image/png"
    );

    res.send(output);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      status: false,
      error: err.message
    });
  }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;