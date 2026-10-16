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

const FONT_URL = "https://cdn.jsdelivr.net/fontsource/fonts/plus-jakarta-sans@latest/latin-700-normal.ttf";
let fontLoaded = false;

async function loadFont() {
    if (fontLoaded) return;
    try {
        const { data } = await axios.get(FONT_URL, {
            responseType: "arraybuffer",
            headers: { "User-Agent": "Mozilla/5.0" }
        });
        GlobalFonts.register(Buffer.from(data), "JakartaSans");
        fontLoaded = true;
    } catch (e) {
        console.error("Gagal memuat font:", e.message);
    }
}

async function getImageFromFile(file) {
    if (file && file.buffer) {
        return await loadImage(file.buffer);
    }
    return null;
}

const cpUpload = upload.fields([
    { name: 'bgFile', maxCount: 1 },
    { name: 'userAvatarFile', maxCount: 1 }
]);

router.post('/', cpUpload, async (req, res) => {
    try {
        const files = req.files || {};
        const body = req.body || {};

        const username = body.username?.trim() || body.name?.trim() || "Arulzxd";
        const groupName = body.groupName?.trim() || body.gcName?.trim() || "ARUL INFORMASI";
        const memberCount = body.memberCount?.trim() || body.member?.trim() || "9999";

        const userImg = await getImageFromFile(files.userAvatarFile?.[0]);

        if (!userImg) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Berkas 'userAvatarFile' (Foto profil user) wajib diunggah!"
            });
        }

        const bgImg = await getImageFromFile(files.bgFile?.[0]);

        await loadFont();

        const width = 1024;
        const height = 450;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        const fontFamily = fontLoaded ? "JakartaSans" : "sans-serif";

        // 1. Render Background Utama
        if (bgImg) {
            ctx.drawImage(bgImg, 0, 0, width, height);
        } else {
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#0a0e17');
            grad.addColorStop(1, '#161f33');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }

        // Overlay Gelap Gradasi Sisi Kanan (Agar Teks & Gambar Tidak Bentrok/Bertumpuk)
        const rightGrad = ctx.createLinearGradient(350, 0, width, 0);
        rightGrad.addColorStop(0, 'rgba(10, 14, 23, 0.2)');
        rightGrad.addColorStop(0.6, 'rgba(10, 14, 23, 0.85)');
        rightGrad.addColorStop(1, 'rgba(10, 14, 23, 0.95)');
        ctx.fillStyle = rightGrad;
        ctx.fillRect(350, 0, width - 350, height);

        // 2. Render Spanduk Gelap Miring Sisi Kiri
        ctx.save();
        ctx.fillStyle = "#0d111a";
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(400, 0);
        ctx.lineTo(220, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Garis Pembatas Cyberpunk (Aksen Cyan Glow)
        ctx.save();
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#1a2332";
        ctx.beginPath();
        ctx.moveTo(400, 0);
        ctx.lineTo(220, height);
        ctx.stroke();

        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#00f0ff";
        ctx.beginPath();
        ctx.moveTo(398, 0);
        ctx.lineTo(218, height);
        ctx.stroke();
        ctx.restore();

        // 3. Render Teks "WELCOME TO" Miring Sejajar Garis Spanduk
        ctx.save();
        const angle = Math.atan2(height, -180);
        ctx.translate(325, 190);
        ctx.rotate(angle);
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 32px "${fontFamily}"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 8;
        ctx.fillText("WELCOME TO", 0, 0);
        ctx.restore();

        // 4. Render Foto Profil User (Tepat Di Tengah Spanduk Kiri)
        const userX = 145;
        const userY = 225;
        const userRadius = 85;

        // Outer Glow Ring Cyan Avatar User
        ctx.save();
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(userX, userY, userRadius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.restore();

        // Clip & Draw Foto Profil User
        ctx.save();
        ctx.beginPath();
        ctx.arc(userX, userY, userRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(userImg, userX - userRadius, userY - userRadius, userRadius * 2, userRadius * 2);
        ctx.restore();

        // 5. Render Sisi Kanan (Badge Member & Teks Informasi)

        // Badge "MEMBER #9999" di Kanan Atas
        const pillText = `MEMBER #${memberCount}`;
        ctx.font = `bold 18px "${fontFamily}"`;
        const pillWidth = ctx.measureText(pillText).width + 30;
        const pillHeight = 36;
        const pillX = width - pillWidth - 40;
        const pillY = 35;

        ctx.fillStyle = "rgba(13, 17, 26, 0.9)";
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 8);
        ctx.fill();

        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pillText, pillX + (pillWidth / 2), pillY + (pillHeight / 2));

        // Teks Nama User
        const textX = 450;
        const nameY = 290;

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 44px "${fontFamily}"`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        let displayUser = username;
        if (ctx.measureText(displayUser).width > 500) {
            while (ctx.measureText(displayUser + "...").width > 500 && displayUser.length > 0) {
                displayUser = displayUser.slice(0, -1);
            }
            displayUser += "...";
        }
        ctx.fillText(displayUser, textX, nameY);

        // Teks Nama Grup
        const groupY = 340;
        ctx.fillStyle = "#00f0ff";
        ctx.font = `bold 22px "${fontFamily}"`;
        ctx.fillText(`GROUP: ${groupName.toUpperCase()}`, textX, groupY);

        // Aksen Garis Futuristik Bawah
        const lineY = 365;
        ctx.beginPath();
        ctx.moveTo(textX, lineY);
        ctx.lineTo(textX + 340, lineY);
        ctx.lineTo(textX + 310, lineY + 16);
        ctx.lineTo(textX, lineY + 16);
        ctx.closePath();
        ctx.fillStyle = "rgba(13, 17, 26, 0.85)";
        ctx.fill();
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        const buffer = await canvas.encode('png');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `inline; filename="welcome-${Date.now()}.png"`);
        return res.send(buffer);

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            creator: "Arulzxd",
            message: "Internal Server Error saat membuat Welcome Canvas",
            error: err.message
        });
    }
});

router.paramsConfig = {
    userAvatarFile: {
        type: "file",
        desc: "Berkas foto profil user/member (Wajib)"
    },
    bgFile: {
        type: "file",
        desc: "Berkas latar belakang card (Opsional)"
    },
    username: {
        type: "text",
        desc: "Nama user/member",
        default: "Arulzxd"
    },
    groupName: {
        type: "text",
        desc: "Nama grup",
        default: "ARUL INFORMASI"
    },
    memberCount: {
        type: "text",
        desc: "Urutan / jumlah member",
        default: "999"
    }
};

router.desc = "Maker Welcome Card Bot Futuristik Presisi via Unggah File (Tanpa Avatar Group).";
router.status = "ready";
router.type = "free";

module.exports = router;
