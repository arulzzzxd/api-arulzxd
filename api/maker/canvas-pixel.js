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

// SKALA RE-RENDER UNTUK KUALITAS ULTRA HD / 4K
const SCALE_FACTOR = 4; 

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

const POS = {
    x: 255,
    y: 50, // Dinaikkan sedikit ke atas agar menampung font yang lebih besar
    rotate: 0.035
};

const COLOR = {
    name: "#45d8d8",
    nameStroke: "#08131d",
    text: "#ffffff",
    textStroke: "#000000"
};

// PERBESARAN UKURAN FONT LEBIH BESAR
function getLayout(text) {
    const len = text.length;
    if (len <= 70) {
        return { nameSize: 52, textSize: 54, width: 710, lineHeight: 62, textY: 66 };
    }
    if (len <= 120) {
        return { nameSize: 48, textSize: 48, width: 720, lineHeight: 56, textY: 60 };
    }
    if (len <= 170) {
        return { nameSize: 45, textSize: 44, width: 730, lineHeight: 52, textY: 56 };
    }
    return { nameSize: 40, textSize: 38, width: 740, lineHeight: 46, textY: 50 };
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
        
        const canvasWidth = bg.width * SCALE_FACTOR;
        const canvasHeight = bg.height * SCALE_FACTOR;
        
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext("2d");

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        
        ctx.drawImage(bg, 0, 0, canvasWidth, canvasHeight);
        ctx.textBaseline = "top";

        const layout = getLayout(text);
        
        let textSize = layout.textSize * SCALE_FACTOR;
        let lineHeight = layout.lineHeight * SCALE_FACTOR;
        let width = layout.width * SCALE_FACTOR;
        let textY = layout.textY * SCALE_FACTOR;
        let nameSize = layout.nameSize * SCALE_FACTOR;

        ctx.font = `${textSize}px "PixelOperator"`;
        let lines = wrapLines(ctx, text, width);

        // Auto-scale jika kalimat terlalu panjang
        while (lines.length > 4 && textSize > (28 * SCALE_FACTOR)) {
            textSize -= (1 * SCALE_FACTOR);
            lineHeight -= (1 * SCALE_FACTOR);
            width += (10 * SCALE_FACTOR);
            textY -= (1 * SCALE_FACTOR);

            ctx.font = `${textSize}px "PixelOperator"`;
            lines = wrapLines(ctx, text, width);
        }

        ctx.save();
        ctx.translate(POS.x * SCALE_FACTOR, POS.y * SCALE_FACTOR);
        ctx.rotate(POS.rotate);

        // Menggambar Nama HD
        ctx.font = `${nameSize}px "PixelOperator"`;
        ctx.lineWidth = 4.5 * SCALE_FACTOR;
        ctx.strokeStyle = COLOR.nameStroke;
        ctx.fillStyle = COLOR.name;
        ctx.strokeText(name, 0, 0);
        ctx.fillText(name, 0, 0);

        // Menggambar Teks/Dialog HD
        ctx.font = `${textSize}px "PixelOperator"`;
        ctx.lineWidth = 5.5 * SCALE_FACTOR;
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
