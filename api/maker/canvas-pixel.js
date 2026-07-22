const express = require("express");
const axios = require("axios");
const {
    createCanvas,
    loadImage,
    GlobalFonts
} = require("@napi-rs/canvas");

const router = express.Router();

const DEFAULT_IMAGE = "https://files.soonex.biz.id/d57ffe876a03.jpg";

// URL GitHub Raw untuk font PixelOperator
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

const POS = {
    x: 160,
    y: 438,
    rotate: 0.028
};

const COLOR = {
    name: "#45d8d8",
    nameStroke: "#08131d",
    text: "#ffffff",
    textStroke: "#000000"
};

function getLayout(text) {
    const len = text.length;
    if (len <= 70) {
        return { nameSize: 29, textSize: 33, width: 610, lineHeight: 38, textY: 46 };
    }
    if (len <= 120) {
        return { nameSize: 28, textSize: 31, width: 640, lineHeight: 36, textY: 43 };
    }
    if (len <= 170) {
        return { nameSize: 27, textSize: 29, width: 670, lineHeight: 34, textY: 40 };
    }
    if (len <= 230) {
        return { nameSize: 26, textSize: 27, width: 700, lineHeight: 32, textY: 36 };
    }
    return { nameSize: 24, textSize: 25, width: 730, lineHeight: 30, textY: 32 };
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

        // Muat font secara dinamis dari GitHub Raw
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

        while (lines.length > 4 && textSize > 20) {
            textSize--;
            lineHeight--;
            width += 12;
            textY -= 2;

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

        // Encode ke PNG dan kirim response
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
