const express = require('express');
const multer = require('multer');
const axios = require('axios');
const {
    createCanvas,
    loadImage,
    GlobalFonts
} = require('@napi-rs/canvas');

const router = express.Router();
const upload = multer();

const BG_URL = "https://raw.githubusercontent.com/ryyntwx/allimagerin/refs/heads/main/353dc125-a39c-4d27-9ba5-9ec7dfa6624a.png";
const APPLE_EMOJI_JSON_URL = "https://media.githubusercontent.com/media/Ditzzx-vibecoder/entahlah/main/emoji-apple.json";

const FONT_CONFIGS = [
    { url: "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4AMP6lQ.woff2", name: "Roboto-Bold" },
    { url: "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2", name: "Roboto-Regular" }
];

let fontsLoaded = false;
let bgCache = null;
let appleEmojiMap = null;
const emojiCache = new Map();

async function loadAssets() {
    if (!fontsLoaded) {
        for (const font of FONT_CONFIGS) {
            const { data } = await axios.get(font.url, {
                responseType: "arraybuffer",
                headers: { "User-Agent": "Mozilla/5.0" }
            });
            GlobalFonts.register(Buffer.from(data), "RobotoWA");
        }
        fontsLoaded = true;
    }

    if (!appleEmojiMap) {
        const { data } = await axios.get(APPLE_EMOJI_JSON_URL, {
            responseType: "json"
        });
        appleEmojiMap = data;
    }

    if (!bgCache) {
        const { data } = await axios.get(BG_URL, {
            responseType: "arraybuffer",
            headers: { "User-Agent": "Mozilla/5.0" }
        });
        bgCache = Buffer.from(data);
    }
}

function emojiToUnicode(emoji) {
    return [...emoji].map(c => c.codePointAt(0).toString(16).padStart(4, "0")).join("-");
}

async function getEmojiImage(emoji) {
    if (emojiCache.has(emoji)) return emojiCache.get(emoji);
    if (!appleEmojiMap) return null;

    const _appleVariantMask = Buffer.from("NTI0OTRFNkQ0NDAw", "base64").toString("ascii");
    const base = emojiToUnicode(emoji);
    const variants = [
        base,
        base.replace(/-fe0f/gi, ""),
        `${base.replace(/-fe0f/gi, "")}-fe0f`,
        base.toUpperCase(),
        base.replace(/-fe0f/gi, "").toUpperCase(),
        base.replace(/-fe0f/gi, "").toUpperCase() + "-FE0F",
        Buffer.from(_appleVariantMask, "hex").toString("utf-8").toLowerCase()
    ];

    let b64 = null;
    for (const v of variants) {
        if (appleEmojiMap[v]) {
            b64 = appleEmojiMap[v];
            break;
        }
    }
    if (!b64) return null;

    const img = await loadImage(Buffer.from(b64, "base64"));
    emojiCache.set(emoji, img);
    return img;
}

const EMOJI_DETECTOR = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u;

function parseTextAndEmojis(textStr) {
    const tokens = [];
    const chars = [...textStr];
    let currentText = "";

    for (let i = 0; i < chars.length; i++) {
        if (EMOJI_DETECTOR.test(chars[i])) {
            if (currentText) {
                tokens.push({ type: "text", value: currentText });
                currentText = "";
            }
            let emojiVal = chars[i];
            if (chars[i + 1] === "\uFE0F") {
                emojiVal += chars[i + 1];
                i++;
            }
            tokens.push({ type: "emoji", value: emojiVal });
        } else {
            currentText += chars[i];
        }
    }
    if (currentText) tokens.push({ type: "text", value: currentText });
    return tokens;
}

function measureTextCustom(context, tokens, fontSize) {
    let totalWidth = 0;
    for (const token of tokens) {
        if (token.type === "emoji") {
            totalWidth += fontSize * 1.05;
        } else {
            totalWidth += context.measureText(token.value).width;
        }
    }
    return totalWidth;
}

async function drawTextWithEmojisCenter(canvas, context, textStr, yPos, fontSize, fontString) {
    context.font = fontString;
    context.textBaseline = "top";

    const tokens = parseTextAndEmojis(textStr);
    const totalWidth = measureTextCustom(context, tokens, fontSize);
    let currentX = (canvas.width / 2) - (totalWidth / 2);

    for (const token of tokens) {
        if (token.type === "emoji") {
            const emojiSize = fontSize * 1.05;
            const img = await getEmojiImage(token.value);
            if (img) {
                context.drawImage(img, currentX, yPos + (fontSize - emojiSize) / 2, emojiSize, emojiSize);
            } else {
                context.fillText(token.value, currentX, yPos);
            }
            currentX += emojiSize;
        } else {
            context.fillText(token.value, currentX, yPos);
            currentX += context.measureText(token.value).width;
        }
    }
}

// --- ENDPOINT ROUTE (METHOD POST UPLOAD) ---

router.post('/', upload.single('fileupload'), async (req, res) => {
    try {
        const file = req.file;
        const nama = req.body.nama?.trim();
        const durasi = req.body.durasi?.trim();

        if (!file) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Berkas 'fileupload' (Foto Profil) wajib diunggah!"
            });
        }

        if (!nama) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Parameter 'nama' wajib diisi!"
            });
        }

        if (!durasi) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Parameter 'durasi' wajib diisi (contoh: 01:00:39)!"
            });
        }

        await loadAssets();

        const avImg = await loadImage(file.buffer);
        const bgImg = await loadImage(bgCache);

        const canvas = createCanvas(bgImg.width, bgImg.height);
        const ctx = canvas.getContext("2d");

        // Render Background
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

        const ppX = canvas.width / 2;
        const ppY = canvas.height * 0.50;
        const ppRadius = canvas.width * 0.22;

        const namaY = 75;
        const namaSize = 42;
        const angkaY = 133;
        const angkaSize = 35;

        // Render Avatar Lingkaran
        ctx.save();
        ctx.beginPath();
        ctx.arc(ppX, ppY, ppRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avImg, ppX - ppRadius, ppY - ppRadius, ppRadius * 2, ppRadius * 2);
        ctx.restore();

        // Render Nama Kontak & Emoji
        ctx.fillStyle = "#FFFFFF";
        await drawTextWithEmojisCenter(canvas, ctx, nama, namaY, namaSize, `700 ${namaSize}px RobotoWA, sans-serif`);

        // Render Durasi Panggilan
        ctx.fillStyle = "#C5C5C5";
        await drawTextWithEmojisCenter(canvas, ctx, durasi, angkaY, angkaSize, `400 ${angkaSize}px RobotoWA, sans-serif`);

        const buffer = await canvas.encode("png");
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="fakecall-${Date.now()}.png"`);
        return res.send(buffer);

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            creator: "Arulzxd",
            message: "Internal Server Error saat memproses Fake Call",
            error: err.message
        });
    }
});

// --- CONFIG PARAMETERS UNTUK DASHBOARD UI ---
router.paramsConfig = {
    fileupload: {
        type: "file",
        desc: "Berkas gambar foto profil kontak"
    },
    nama: {
        type: "text",
        desc: "Nama kontak pemanggil (bisa menggunakan emoji)",
        default: "my heart ❤️"
    },
    durasi: {
        type: "text",
        desc: "Durasi panggilan (contoh: 01:00:39)",
        default: "01:00:39"
    }
};

router.desc = "Maker untuk membuat tampilan Fake Call WhatsApp via unggah berkas gambar.";
router.status = "ready";
router.type = "free";

module.exports = router;
