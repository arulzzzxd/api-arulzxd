const express = require('express');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const axios = require('axios');

const router = express.Router();

const BRAT_IMAGE_URL = "https://files.catbox.moe/nnftbq.jpg";
const BRAT_FONT_URL = "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Poppins.ttf";

const CANVAS = { width: 1254, height: 1254 };
const SAFE_ZONE = { a: 760, b: 1100, c: 300, d: 950 }; 
const TEXT_STYLE = {
    fontFamily: "PoppinsBratVermile",
    maxFontSize: 80, 
    minFontSize: 22,
    lineHeight: 1.18,
    color: "#111111",
    align: "center"
};

let fontRegistered = false;

// Fungsi pembantu pemrosesan teks canvas
function normalizeText(text) {
    return String(text || "")
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function getSafeRect(zone) {
    return {
        x: zone.c,
        y: zone.a,
        w: zone.d - zone.c,
        h: zone.b - zone.a,
        centerX: (zone.c + zone.d) / 2,
        centerY: (zone.a + zone.b) / 2
    };
}

function setFont(ctx, size) {
    ctx.font = `${size}px ${TEXT_STYLE.fontFamily}`;
}

function splitLongWord(ctx, word, maxWidth) {
    const chars = [...word];
    const parts = [];
    let current = "";

    for (const char of chars) {
        const test = current + char;
        if (ctx.measureText(test).width <= maxWidth || !current) {
            current = test;
        } else {
            parts.push(current);
            current = char;
        }
    }
    if (current) parts.push(current);
    return parts;
}

function wrapParagraph(ctx, paragraph, maxWidth) {
    const words = paragraph.split(" ").filter(Boolean);
    const lines = [];
    let current = "";

    for (const word of words) {
        const test = current ? `${current} ${word}` : word
        if (ctx.measureText(test).width <= maxWidth) {
            current = test;
            continue;
        }
        if (current) {
            lines.push(current);
            current = "";
        }
        if (ctx.measureText(word).width <= maxWidth) {
            current = word;
        } else {
            const parts = splitLongWord(ctx, word, maxWidth);
            lines.push(...parts.slice(0, -1));
            current = parts.at(-1) || "";
        }
    }
    if (current) lines.push(current);
    return lines;
}

function wrapText(ctx, text, maxWidth) {
    return text.split("\n").flatMap((paragraph) => {
        const clean = paragraph.trim();
        if (!clean) return [""];
        return wrapParagraph(ctx, clean, maxWidth);
    });
}

function fitText(ctx, text, rect) {
    for (let size = TEXT_STYLE.maxFontSize; size >= TEXT_STYLE.minFontSize; size--) {
        setFont(ctx, size);
        const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
        const lines = wrapText(ctx, text, rect.w);
        const totalHeight = lines.length * lineHeight;

        if (totalHeight <= rect.h) {
            return { size, lines, lineHeight, totalHeight };
        }
    }

    const size = TEXT_STYLE.minFontSize;
    setFont(ctx, size);
    const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
    const lines = wrapText(ctx, text, rect.w);
    const maxLines = Math.max(1, Math.floor(rect.h / lineHeight));
    const clipped = lines.slice(0, maxLines);

    if (lines.length > maxLines && clipped.length) {
        let last = clipped[clipped.length - 1];
        while (last.length > 0 && ctx.measureText(`${last}...`).width > rect.w) {
            last = last.slice(0, -1);
        }
        clipped[clipped.length - 1] = `${last}...`;
    }

    return { size, lines: clipped, lineHeight, totalHeight: clipped.length * lineHeight };
}

function drawCenteredText(ctx, text, zone) {
    const rect = getSafeRect(zone);
    const fitted = fitText(ctx, text, rect);
    const startY = rect.y + (rect.h - fitted.totalHeight) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    setFont(ctx, fitted.size);
    ctx.fillStyle = TEXT_STYLE.color;
    ctx.textAlign = TEXT_STYLE.align;
    ctx.textBaseline = "top";

    fitted.lines.forEach((line, index) => {
        const y = startY + index * fitted.lineHeight;
        ctx.fillText(line, rect.centerX, y);
    });
    ctx.restore();
}

// GET Route Utama API
router.get('/', async (req, res) => {
    const text = req.query.text;

    if (!text) {
        return res.status(400).json({
            status: false,
            message: "Parameter '?text=' wajib diisi pada URL endpoint.",
            example: "/api/brattakina?text=Halo%20Cuy"
        });
    }

    try {
        // Registrasi font sekali saja agar menghemat resource memory RAM
        if (!fontRegistered) {
            const fontRes = await axios.get(BRAT_FONT_URL, { responseType: 'arraybuffer' });
            GlobalFonts.register(Buffer.from(fontRes.data), TEXT_STYLE.fontFamily);
            fontRegistered = true;
        }

        // Ambil template background image brat takina
        const imgRes = await axios.get(BRAT_IMAGE_URL, { responseType: 'arraybuffer' });
        const image = await loadImage(Buffer.from(imgRes.data));

        // Setup Canvas rendering
        const canvas = createCanvas(CANVAS.width, CANVAS.height);
        const ctx = canvas.getContext("2d");

        ctx.drawImage(image, 0, 0, CANVAS.width, CANVAS.height);
        
        const inputText = normalizeText(text);
        drawCenteredText(ctx, inputText, SAFE_ZONE);

        // Encode canvas hasil rendering ke format buffer murni PNG
        const finalBuffer = await canvas.encode("png");

        // Kirim langsung sebagai file gambar ke browser/client
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': finalBuffer.length,
            'Cache-Control': 'public, max-age=86400, s-maxage=86400'
        });
        res.end(finalBuffer);

    } catch (e) {
        console.error('[Brattakina Error]:', e);
        res.status(500).json({
            status: false,
            error: e.message
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;