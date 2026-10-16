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
        GlobalFonts.register(Buffer.from(data), "CyberFont");
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
        const fontFamily = fontLoaded ? "CyberFont" : "sans-serif";

        // 1. Render Background Gambar (Dimmed)
        if (bgImg) {
            ctx.drawImage(bgImg, 0, 0, width, height);
            ctx.fillStyle = "rgba(5, 8, 15, 0.65)";
            ctx.fillRect(0, 0, width, height);
        } else {
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#05070d');
            grad.addColorStop(1, '#0e1524');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }

        // 2. Cyberpunk Grid Lines Background
        ctx.strokeStyle = "rgba(0, 240, 255, 0.05)";
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // 3. Panel Kiri Solid Dark Cyberpunk
        const topCutX = 420;
        const botCutX = 220;

        ctx.save();
        ctx.fillStyle = "#070a10";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(topCutX, 0);
        ctx.lineTo(botCutX, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // 4. Garis Pembatas Miring Neon Stripe
        const stripeWidth = 50;
        ctx.save();
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.moveTo(topCutX, 0);
        ctx.lineTo(topCutX + stripeWidth, 0);
        ctx.lineTo(botCutX + stripeWidth, height);
        ctx.lineTo(botCutX, height);
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 15;
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(topCutX + stripeWidth, 0);
        ctx.lineTo(botCutX + stripeWidth, height);
        ctx.stroke();

        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(topCutX, 0);
        ctx.lineTo(botCutX, height);
        ctx.stroke();
        ctx.restore();

        // 5. Teks Miring "WELCOME TO" (Sudut Disesuaikan Agar Tidak Terbalik)
        ctx.save();
        const dx = topCutX - botCutX;
        const dy = -height;
        const slope = Math.atan2(dy, dx);

        const midStripeX = (topCutX + botCutX + stripeWidth) / 2;
        const midStripeY = height / 2;

        ctx.translate(midStripeX, midStripeY);
        ctx.rotate(slope);
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 26px "${fontFamily}"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 10;
        ctx.fillText("WELCOME TO", 0, 0);
        ctx.restore();

        // 6. Foto Profil User
        const avatarX = 140;
        const avatarY = 225;
        const avatarRadius = 85;

        // Outer HUD Tech Rings
        ctx.save();
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 20;
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarRadius + 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarRadius + 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Clip User Image
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(userImg, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
        ctx.restore();

        // 7. Panel Informasi Kanan
        const infoX = 490;
        const infoY = 180;
        const infoW = 490;
        const infoH = 220;

        ctx.save();
        ctx.fillStyle = "rgba(7, 10, 16, 0.85)";
        ctx.beginPath();
        ctx.roundRect(infoX, infoY, infoW, infoH, 12);
        ctx.fill();

        ctx.strokeStyle = "rgba(0, 240, 255, 0.3)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // 8. Member Pill Badge
        const pillText = `MEMBER #${memberCount}`;
        ctx.font = `bold 16px "${fontFamily}"`;
        const pillW = ctx.measureText(pillText).width + 30;
        const pillH = 36;
        const pillX = width - pillW - 40;
        const pillY = 35;

        ctx.save();
        ctx.fillStyle = "#070a10";
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 6);
        ctx.fill();

        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 10;
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pillText, pillX + (pillW / 2), pillY + (pillH / 2));
        ctx.restore();

        // 9. Teks Username & Group Name
        const textLeftMargin = infoX + 30;

        ctx.fillStyle = "#00f0ff";
        ctx.font = `bold 13px "${fontFamily}"`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("● SYSTEM ONLINE // USER DETECTED", textLeftMargin, infoY + 25);

        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 40px "${fontFamily}"`;
        let displayUser = username;
        if (ctx.measureText(displayUser).width > (infoW - 60)) {
            while (ctx.measureText(displayUser + "...").width > (infoW - 60) && displayUser.length > 0) {
                displayUser = displayUser.slice(0, -1);
            }
            displayUser += "...";
        }
        ctx.fillText(displayUser, textLeftMargin, infoY + 55);

        ctx.fillStyle = "#00f0ff";
        ctx.font = `bold 20px "${fontFamily}"`;
        ctx.fillText(`GROUP: ${groupName.toUpperCase()}`, textLeftMargin, infoY + 115);

        const barY = infoY + 155;
        ctx.save();
        ctx.fillStyle = "#00f0ff";
        ctx.fillRect(textLeftMargin, barY, 180, 4);

        ctx.fillStyle = "rgba(0, 240, 255, 0.3)";
        ctx.fillRect(textLeftMargin + 190, barY, 210, 4);
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
            message: "Internal Server Error saat membuat Cyberpunk Welcome Canvas",
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
        default: "9999"
    }
};

router.desc = "Maker Welcome Card Bot Cyberpunk Ultra Presisi via Unggah File.";
router.status = "ready";
router.type = "free";

module.exports = router;
