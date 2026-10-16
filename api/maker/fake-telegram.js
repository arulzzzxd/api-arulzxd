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

const TTF_URL = 'https://cdn.jsdelivr.net/fontsource/fonts/roboto-mono@latest/latin-700-normal.ttf';
const BG_URL = 'https://raw.githubusercontent.com/ryyntwx/Image-rinn/refs/heads/main/c8ac4ffc-618c-411c-b36c-45c06c7e5a5e.png';
const FONT_NAME = 'TeleRobotoMono';

let fontLoaded = false;
let bgCache = null;

async function loadAssets() {
    if (!fontLoaded) {
        try {
            const { data } = await axios.get(TTF_URL, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            GlobalFonts.register(Buffer.from(data), FONT_NAME);
            fontLoaded = true;
        } catch (err) {
            console.error("Gagal load font:", err.message);
        }
    }

    if (!bgCache) {
        const { data } = await axios.get(BG_URL, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        bgCache = Buffer.from(data);
    }
}

// --- ENDPOINT ROUTE (METHOD POST UPLOAD) ---

router.post('/', upload.single('fileupload'), async (req, res) => {
    try {
        const file = req.file;
        const nama = req.body.nama?.trim();
        const ponsel = req.body.ponsel?.trim() || req.body.nomor?.trim();
        const bio = req.body.bio?.trim();
        let username = req.body.username?.trim();

        if (!file) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Berkas 'fileupload' (Foto Profil) wajib diunggah!"
            });
        }

        if (!nama || !ponsel || !bio || !username) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Parameter 'nama', 'ponsel', 'bio', dan 'username' wajib diisi!"
            });
        }

        username = username.startsWith('@') ? username : '@' + username;

        await loadAssets();

        const ppImg = await loadImage(file.buffer);
        const bgImg = await loadImage(bgCache);

        const canvas = createCanvas(bgImg.width, bgImg.height);
        const ctx = canvas.getContext('2d');

        // Render Background
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

        const fontFamily = fontLoaded ? FONT_NAME : 'sans-serif';

        const config = {
            pp: { x: 571, y: 244, r: 137 },
            nama: { y: 448, size: 50 },
            ponsel: { x: 80, y: 883, size: 35 },
            bio: { x: 83, y: 996, size: 36 },
            username: { x: 83, y: 1143, size: 38 }
        };

        // Render Foto Profil Lingkaran
        ctx.save();
        ctx.beginPath();
        ctx.arc(config.pp.x, config.pp.y, config.pp.r, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(ppImg, config.pp.x - config.pp.r, config.pp.y - config.pp.r, config.pp.r * 2, config.pp.r * 2);
        ctx.restore();

        // Render Nama Tampilan
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${config.nama.size}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(nama, canvas.width / 2, config.nama.y);

        // Render Nomor Ponsel
        ctx.textAlign = 'left';
        ctx.font = `${config.ponsel.size}px ${fontFamily}`;
        ctx.fillText(ponsel, config.ponsel.x, config.ponsel.y);

        // Render Bio
        ctx.font = `${config.bio.size}px ${fontFamily}`;
        ctx.fillText(bio, config.bio.x, config.bio.y);

        // Render Username
        ctx.font = `${config.username.size}px ${fontFamily}`;
        ctx.fillText(username, config.username.x, config.username.y);

        const buffer = await canvas.encode('png');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="faketele-${Date.now()}.png"`);
        return res.send(buffer);

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            creator: "Arulzxd",
            message: "Internal Server Error saat memproses Fake Telegram Profile",
            error: err.message
        });
    }
});

// --- CONFIG PARAMETERS UNTUK DASHBOARD UI ---
router.paramsConfig = {
    fileupload: {
        type: "file",
        desc: "Berkas gambar foto profil Telegram"
    },
    nama: {
        type: "text",
        desc: "Nama tampilan profil",
        default: "Arulzxd"
    },
    ponsel: {
        type: "text",
        desc: "Nomor telepon / hp",
        default: "+62 812-3456-7890"
    },
    bio: {
        type: "text",
        desc: "Bio profil Telegram",
        default: "Software Developer & Content Creator"
    },
    username: {
        type: "text",
        desc: "Username Telegram",
        default: "arulzxd"
    }
};

router.desc = "Maker untuk membuat tampilan Fake Telegram Profile via unggah berkas gambar.";
router.status = "ready";
router.type = "free";

module.exports = router;
