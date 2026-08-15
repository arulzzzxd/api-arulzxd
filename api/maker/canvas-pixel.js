const express = require("express");
const axios = require("axios");
const {
    createCanvas,
    loadImage,
    GlobalFonts
} = require("@napi-rs/canvas");

const router = express.Router();

const DEFAULT_IMAGE = "https://files.catbox.moe/otf3hb.jpg";
const FONT_URL = "https://raw.githubusercontent.com/arulzzzxd/database/main/font/PixelOperator.ttf";

let fontLoaded = false;

async function loadFont() {
    if (fontLoaded) return;

    const { data } = await axios.get(FONT_URL, {
        responseType: "arraybuffer"
    });

    GlobalFonts.register(
        Buffer.from(data),
        "PixelOperator"
    );

    fontLoaded = true;
}

async function getBuffer(url) {
    const { data } = await axios.get(url, {
        responseType: "arraybuffer"
    });
    return Buffer.from(data);
}

// PERBAIKAN KOORDINAT & KEMIRINGAN BINGKAI:
// x: 195 (Geser lebih masuk ke dalam kotak hitam)
// y: 50 (Turunkan sedikit agar sejajar margin atas)
// rotate: -0.024 (Kemiringan miring ke kiri mengikuti bentuk box dialog)
const POS = {
    x: 255,
    y: 60,
    rotate: 0.035
};

const COLOR = {
    name: "#45d8d8",
    nameStroke: "#08131d",
    text: "#ffffff",
    textStroke: "#000000"
};

// DITAMBAHKAN UKURAN FONT NAMA (nameSize) DAN TEKS (textSize) AGAR LEBIH BESAR & JELAS
function getLayout(text) {
    const len = text.length;
    if (len <= 70) {
        return { nameSize: 36, textSize: 38, width: 680, lineHeight: 46, textY: 50 };
    }
    if (len <= 120) {
        return { nameSize: 34, textSize: 35, width: 690, lineHeight: 42, textY: 46 };
    }
    if (len <= 170) {
        return { nameSize: 32, textSize: 33, width: 700, lineHeight: 39, textY: 43 };
    }
    return { nameSize: 30, textSize: 30, width: 710, lineHeight: 36, textY: 40 };
}

function wrapLines(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let line = "";

    for (const word of words) {
        const test = line + word + " ";
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line.trim());
            line = word + " ";
        } else {
            line = test;
        }
    }
    if (line) lines.push(line.trim());
    return lines;
}

router.get("/", async (req, res) => {
    try {
        const name = req.query.name?.trim();
        const text = req.query.text?.trim();

        if (!name) {
            return res.status(400).json({
                status: false,
                message: "Parameter name wajib"
            });
        }

        if (!text) {
            return res.status(400).json({
                status: false,
                message: "Parameter text wajib"
            });
        }

        await loadFont();

        const bg = await loadImage(await getBuffer(DEFAULT_IMAGE));
        const canvas = createCanvas(bg.width, bg.height);
        const ctx = canvas.getContext("2d");

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bg, 0, 0);
        ctx.textBaseline = "top";

        const layout = getLayout(text);
        let textSize = layout.textSize;
        let lineHeight = layout.lineHeight;
        let width = layout.width;
        let textY = layout.textY;

        ctx.font = `${textSize}px "PixelOperator"`;
        let lines = wrapLines(ctx, text, width);

        while (lines.length > 4 && textSize > 22) {
            textSize--;
            lineHeight--;
            width += 10;
            textY -= 1;

            ctx.font = `${textSize}px "PixelOperator"`;
            lines = wrapLines(ctx, text, width);
        }

        ctx.save();
        ctx.translate(POS.x, POS.y);
        ctx.rotate(POS.rotate);

        // Menggambar Nama
        ctx.font = `${layout.nameSize}px "PixelOperator"`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = COLOR.nameStroke;
        ctx.fillStyle = COLOR.name;
        ctx.strokeText(name, 0, 0);
        ctx.fillText(name, 0, 0);

        // Menggambar Teks/Dialog
        ctx.font = `${textSize}px "PixelOperator"`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = COLOR.textStroke;
        ctx.fillStyle = COLOR.text;

        let y = textY;
        for (const line of lines) {
            ctx.strokeText(line, 0, y);
            ctx.fillText(line, 0, y);
            y += lineHeight;
        }

        ctx.restore();

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

router.status = "ready";
router.type = "free";
module.exports = router;
