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
    { name: 'userAvatarFile', maxCount: 1 },
    { name: 'groupAvatarFile', maxCount: 1 }
]);

router.post('/', cpUpload, async (req, res) => {
    try {
        const files = req.files || {};
        const body = req.body || {};

        const username = body.username?.trim() || body.name?.trim() || "KYUU";
        const groupName = body.groupName?.trim() || body.gcName?.trim() || "KYZZ COMMUNITY";
        const memberCount = body.memberCount?.trim() || body.member?.trim() || "1,234";

        const userImg = await getImageFromFile(files.userAvatarFile?.[0]);

        if (!userImg) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Berkas 'userAvatarFile' (Foto profil user) wajib diunggah!"
            });
        }

        const bgImg = await getImageFromFile(files.bgFile?.[0]);
        const groupImg = await getImageFromFile(files.groupAvatarFile?.[0]);

        await loadFont();

        const width = 1024;
        const height = 450;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        const fontFamily = fontLoaded ? "JakartaSans" : "sans-serif";

        // 1. Render Background (Gunakan file jika ada, atau fallback ke gradient)
        if (bgImg) {
            ctx.drawImage(bgImg, 0, 0, width, height);
        } else {
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#0a0d14');
            grad.addColorStop(1, '#161b26');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }

        // 2. Render Spanduk Gelap Miring di Sisi Kiri
        ctx.save();
        ctx.fillStyle = "#12151b";
        ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(540, 0);
        ctx.lineTo(310, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Garis Pembatas Miring Bergaya Cyberpunk (Aksen Gelap & Cyan)
        ctx.save();
        ctx.lineWidth = 8;
        ctx.strokeStyle = "#202531";
        ctx.beginPath();
        ctx.moveTo(540, 0);
        ctx.lineTo(310, height);
        ctx.stroke();

        ctx.lineWidth = 3;
        ctx.strokeStyle = "#00f0ff";
        ctx.beginPath();
        ctx.moveTo(538, 0);
        ctx.lineTo(308, height);
        ctx.stroke();
        ctx.restore();

        // 3. Render Teks Diagon "WELCOME TO" di Spanduk Kiri
        ctx.save();
        ctx.translate(415, 120);
        ctx.rotate(Math.atan2(height, -230));
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 38px "${fontFamily}"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("WELCOME TO", 0, 0);
        ctx.restore();

        // 4. Render Foto Profil User (Spanduk Kiri)
        const userX = 220;
        const userY = 270;
        const userRadius = 85;

        // Ikon Profil Grup Kecil di Atas Avatar (Jika File Diunggah)
        if (groupImg) {
            const iconX = 100;
            const iconY = 80;
            const iconR = 30;

            ctx.save();
            ctx.beginPath();
            ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(groupImg, iconX - iconR, iconY - iconR, iconR * 2, iconR * 2);
            ctx.restore();

            ctx.beginPath();
            ctx.arc(iconX, iconY, iconR + 2, 0, Math.PI * 2);
            ctx.strokeStyle = "#00f0ff";
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Lingkaran Glow Cyan Avatar User
        ctx.save();
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(userX, userY, userRadius + 5, 0, Math.PI * 2);
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
        
        // Badge "MEMBER #1,234" di Kanan Atas
        const pillText = `MEMBER #${memberCount}`;
        ctx.font = `bold 18px "${fontFamily}"`;
        const pillWidth = ctx.measureText(pillText).width + 30;
        const pillHeight = 36;
        const pillX = width - pillWidth - 50;
        const pillY = 35;

        ctx.fillStyle = "rgba(18, 21, 27, 0.85)";
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 10);
        ctx.fill();

        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pillText, pillX + (pillWidth / 2), pillY + (pillHeight / 2));

        // Teks Nama User
        const textX = 520;
        const nameY = 310;

        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 42px "${fontFamily}"`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        let displayUser = username;
        if (ctx.measureText(displayUser).width > 450) {
            while (ctx.measureText(displayUser + "...").width > 450 && displayUser.length > 0) {
                displayUser = displayUser.slice(0, -1);
            }
            displayUser += "...";
        }
        ctx.fillText(displayUser, textX, nameY);

        // Teks Nama Grup
        const groupY = 355;
        ctx.fillStyle = "#00f0ff";
        ctx.font = `bold 22px "${fontFamily}"`;
        ctx.fillText(`GROUP: ${groupName.toUpperCase()}`, textX, groupY);

        // Garis Bingkai Futuristik Bawah
        const lineY = 380;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(textX, lineY);
        ctx.lineTo(textX + 320, lineY);
        ctx.lineTo(textX + 290, lineY + 18);
        ctx.lineTo(textX, lineY + 18);
        ctx.closePath();
        ctx.fillStyle = "rgba(18, 21, 27, 0.8)";
        ctx.fill();
        ctx.strokeStyle = "#556070";
        ctx.lineWidth = 2;
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
    groupAvatarFile: {
        type: "file",
        desc: "Berkas foto/ikon grup (Opsional)"
    },
    username: {
        type: "text",
        desc: "Nama user/member",
        default: "KYUU"
    },
    groupName: {
        type: "text",
        desc: "Nama grup",
        default: "KYZZ COMMUNITY"
    },
    memberCount: {
        type: "text",
        desc: "Urutan / jumlah member",
        default: "1,234"
    }
};

router.desc = "Maker Welcome Card Bot Futuristik via Unggah File (Spanduk & Foto Profil di Kiri).";
router.status = "ready";
router.type = "free";

module.exports = router;
