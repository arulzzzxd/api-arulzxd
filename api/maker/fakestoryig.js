const express = require("express");
const axios = require("axios");
const {
    createCanvas,
    loadImage,
    GlobalFonts
} = require("@napi-rs/canvas");

const router = express.Router();

const BG_URL =
    "https://files.catbox.moe/3gwr1l.jpg";

const DEFAULT_PP =
    "https://img1.pixhost.to/images/5831/600387261_biyu-offc.jpg";

const FONT_URL =
    "https://raw.githubusercontent.com/arulzzzxd/database/heads/main/font/arialnarrow.ttf";

let fontLoaded = false;

async function loadFont() {
    if (fontLoaded) return;

    const { data } = await axios.get(
        FONT_URL,
        {
            responseType: "arraybuffer"
        }
    );

    GlobalFonts.register(
        Buffer.from(data),
        "ArialNarrow"
    );

    fontLoaded = true;
}

async function getBuffer(url) {
    const { data } = await axios.get(url, {
        responseType: "arraybuffer"
    });

    return Buffer.from(data);
}

function wrapText(
    ctx,
    text,
    maxWidth
) {
    const words = text.split(" ");
    const lines = [];
    let line = "";

    for (const word of words) {
        const test =
            line + word + " ";

        if (
            ctx.measureText(test).width >
                maxWidth &&
            line
        ) {
            lines.push(line.trim());
            line = word + " ";
        } else {
            line = test;
        }
    }

    if (line)
        lines.push(line.trim());

    return lines;
}

router.get("/", async (req, res) => {
    try {
        const username =
            req.query.username?.trim();

        const caption =
            req.query.caption?.trim();

        const pp =
            req.query.pp?.trim() ||
            DEFAULT_PP;

        if (!username) {
            return res.status(400).json({
                status: false,
                message:
                    "Parameter username wajib"
            });
        }

        if (!caption) {
            return res.status(400).json({
                status: false,
                message:
                    "Parameter caption wajib"
            });
        }

        await loadFont();

        const bg = await loadImage(
            await getBuffer(BG_URL)
        );

        const avatar =
            await loadImage(
                await getBuffer(pp)
            );

        const canvas =
            createCanvas(
                bg.width,
                bg.height
            );

        const ctx =
            canvas.getContext("2d");

        ctx.drawImage(
            bg,
            0,
            0,
            canvas.width,
            canvas.height
        );

        // Avatar
        const ppX = 40;
        const ppY = 250;
        const ppSize = 70;

        ctx.save();

        ctx.beginPath();
        ctx.arc(
            ppX + ppSize / 2,
            ppY + ppSize / 2,
            ppSize / 2,
            0,
            Math.PI * 2
        );

        ctx.closePath();
        ctx.clip();

        ctx.drawImage(
            avatar,
            ppX,
            ppY,
            ppSize,
            ppSize
        );

        ctx.restore();

        // Username
        ctx.font =
            "28px ArialNarrow";

        ctx.fillStyle =
            "#ffffff";

        ctx.textAlign = "left";
        ctx.textBaseline =
            "middle";

        ctx.fillText(
            username,
            ppX + ppSize + 15,
            ppY + ppSize / 2
        );

        // Caption
        ctx.font =
            "bold 42px ArialNarrow";

        ctx.fillStyle =
            "#ffffff";

        ctx.strokeStyle =
            "#000000";

        ctx.lineWidth = 6;

        ctx.textAlign =
            "center";

        ctx.textBaseline =
            "middle";

        const lines =
            wrapText(
                ctx,
                caption,
                520
            );

        const lineHeight = 55;

        let y =
            canvas.height / 2 -
            (
                lines.length *
                lineHeight
            ) /
                2;

        for (const line of lines) {
            ctx.strokeText(
                line,
                canvas.width / 2,
                y
            );

            ctx.fillText(
                line,
                canvas.width / 2,
                y
            );

            y += lineHeight;
        }

        const buffer =
            await canvas.encode(
                "png"
            );

        res.setHeader(
            "Content-Type",
            "image/png"
        );

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