const express = require("express");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const IMAGE_URL = "https://arulz-uploader.vercel.app/files/hGS1g9.jpeg";

const WIDTH = 841;
const HEIGHT = 1870;

const FONT_URL =
  "https://raw.githubusercontent.com/arulzzzxd/database/main/font/PlusJakartaSans-SemiBold.ttf";

let fontLoaded = false;

async function loadFont() {
  if (fontLoaded) return;

  const { data } = await axios.get(FONT_URL, {
    responseType: "arraybuffer"
  });

  GlobalFonts.register(Buffer.from(data), "Plus Jakarta Sans");
  fontLoaded = true;
}

async function loadImageFromUrl(url) {
  const { data } = await axios.get(url, {
    responseType: "arraybuffer"
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
    const apikey = req.query.apikey;
    const nominal = req.query.nominal;

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

    if (!nominal) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'nominal' diperlukan.",
        example:
          "/api/maker/fakedana?apikey=arulzxd-keys&nominal=500000"
      });
    }

    await loadFont();

    const image = await loadImageFromUrl(IMAGE_URL);

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    ctx.font = '800 20px "Plus Jakarta Sans"';
    ctx.fillText("Rp", 61, 368);

    ctx.font = '800 28px "Plus Jakarta Sans"';
    ctx.fillText(formatAmount(nominal), 94, 371);

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

router.status = "ready";
router.type = "free";

module.exports = router;