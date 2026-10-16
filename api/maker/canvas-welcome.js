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

// Fungsi pembantu membuat polygon dengan sudut terpotong (Cut-Corners HUD)
function drawCutCornerRect(ctx, x, y, width, height, cutSize) {
    ctx.beginPath();
    ctx.moveTo(x + cutSize, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + height - cutSize);
    ctx.lineTo(x + width - cutSize, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + cutSize);
    ctx.closePath();
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

        // ==========================================
        // 1. BACKGROUND & OVERLAY
        // ==========================================
        if (bgImg) {
            ctx.drawImage(bgImg, 0, 0, width, height);
            ctx.fillStyle = "rgba(4, 6, 12, 0.70)";
            ctx.fillRect(0, 0, width, height);
        } else {
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#04060c');
            grad.addColorStop(1, '#0c1424');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }

        // Cyberpunk Matrix Grid Pattern
        ctx.strokeStyle = "rgba(0, 240, 255, 0.06)";
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 35) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += 35) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // ==========================================
        // 2. PANEL KIRI SOLID CYBERPUNK SLANT
        // ==========================================
        const topCutX = 430;
        const botCutX = 230;

        // Base Solid Left Panel
        ctx.save();
        ctx.fillStyle = "#070a12";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(topCutX, 0);
        ctx.lineTo(botCutX, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Neon Border Stripe 1 (Pink/Magenta Accent Line)
        const stripeWidth = 45;
        ctx.save();
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.moveTo(topCutX, 0);
        ctx.lineTo(topCutX + stripeWidth, 0);
        ctx.lineTo(botCutX + stripeWidth, height);
        ctx.lineTo(botCutX, height);
        ctx.closePath();
        ctx.fill();

        // Cyber Neon Glow Border
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 18;
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(topCutX + stripeWidth, 0);
        ctx.lineTo(botCutX + stripeWidth, height);
        ctx.stroke();

        ctx.shadowColor = "#ff0055";
        ctx.shadowBlur = 12;
        ctx.strokeStyle = "#ff0055";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(topCutX, 0);
        ctx.lineTo(botCutX, height);
        ctx.stroke();
        ctx.restore();

        // ==========================================
        // 3. TEKS ROTASI "WELCOME TO"
        // ==========================================
        ctx.save();
        const dx = topCutX - botCutX;
        const dy = -height;
        const slope = Math.atan2(dy, dx);

        const midStripeX = (topCutX + botCutX + stripeWidth) / 2;
        const midStripeY = height / 2;

        ctx.translate(midStripeX, midStripeY);
        ctx.rotate(slope);
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 24px "${fontFamily}"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 12;
        ctx.fillText("WELCOME TO", 0, 0);
        ctx.restore();

        // ==========================================
        // 4. AVATAR USER DENGAN HUD TECH RING
        // ==========================================
        const avatarX = 145;
        const avatarY = 225;
        const avatarRadius = 85;

        // Outer Dashed HUD Ring (Pink Neon)
        ctx.save();
        ctx.shadowColor = "#ff0055";
        ctx.shadowBlur = 15;
        ctx.strokeStyle = "#ff0055";
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarRadius + 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Inner Solid HUD Ring (Cyan Neon)
        ctx.save();
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 22;
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarRadius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Tech Tick Marks pada Avatar
        ctx.save();
        ctx.fillStyle = "#00f0ff";
        const tickAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
        for (const angle of tickAngles) {
            const tx = avatarX + Math.cos(angle) * (avatarRadius + 6);
            const ty = avatarY + Math.sin(angle) * (avatarRadius + 6);
            ctx.beginPath();
            ctx.arc(tx, ty, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Render Circular User Avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(userImg, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
        ctx.restore();

        // ==========================================
        // 5. MEMBER BADGE (TOP RIGHT HUD)
        // ==========================================
        const pillText = `MEMBER #${memberCount}`;
        ctx.font = `bold 16px "${fontFamily}"`;
        const pillW = ctx.measureText(pillText).width + 36;
        const pillH = 38;
        const pillX = width - pillW - 40;
        const pillY = 35;

        ctx.save();
        ctx.fillStyle = "#090d16";
        drawCutCornerRect(ctx, pillX, pillY, pillW, pillH, 8);
        ctx.fill();

        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 12;
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pillText, pillX + (pillW / 2), pillY + (pillH / 2));
        ctx.restore();

        // ==========================================
        // 6. KOTAK INFORMASI GLASSMORPHISM HUD (KANAN)
        // ==========================================
        const infoX = 500;
        const infoY = 160;
        const infoW = 480;
        const infoH = 240;

        ctx.save();
        // Container Cut-Corner Box
        ctx.fillStyle = "rgba(9, 13, 22, 0.88)";
        drawCutCornerRect(ctx, infoX, infoY, infoW, infoH, 16);
        ctx.fill();

        ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        const textLeft = infoX + 30;

        // Header Status Dot & Line
        ctx.fillStyle = "#00f0ff";
        ctx.font = `bold 12px "${fontFamily}"`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("● SYSTEM ONLINE // USER VERIFIED", textLeft, infoY + 22);

        // Username Text
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 38px "${fontFamily}"`;

        let displayUser = username;
        if (ctx.measureText(displayUser).width > (infoW - 60)) {
            while (ctx.measureText(displayUser + "...").width > (infoW - 60) && displayUser.length > 0) {
                displayUser = displayUser.slice(0, -1);
            }
            displayUser += "...";
        }
        ctx.fillText(displayUser, textLeft, infoY + 52);
        ctx.restore();

        // Group Badge Box
        const groupLabel = `GROUP: ${groupName.toUpperCase()}`;
        ctx.font = `bold 18px "${fontFamily}"`;
        const groupW = ctx.measureText(groupLabel).width + 24;
        const groupH = 34;
        const groupY = infoY + 112;

        ctx.save();
        ctx.fillStyle = "rgba(0, 240, 255, 0.12)";
        drawCutCornerRect(ctx, textLeft, groupY, Math.min(groupW, infoW - 60), groupH, 6);
        ctx.fill();

        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#00f0ff";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(groupLabel, textLeft + 12, groupY + (groupH / 2));
        ctx.restore();

        // Cyberpunk Equalizer & HUD Bar Decor
        const barY = infoY + 175;
        ctx.save();
        ctx.fillStyle = "#00f0ff";
        ctx.fillRect(textLeft, barY, 140, 4);

        ctx.fillStyle = "#ff0055";
        ctx.fillRect(textLeft + 148, barY, 35, 4);

        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(textLeft + 190, barY, 180, 4);

        // Decorative Tech Crosshairs (+)
        ctx.fillStyle = "rgba(0, 240, 255, 0.5)";
        ctx.font = `12px "${fontFamily}"`;
        ctx.fillText("+ + + HUD-v2.0", textLeft, barY + 18);
        ctx.restore();

        // ==========================================
        // 7. EXPORT PNG BUFFER
        // ==========================================
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

router.desc = "Maker Welcome Card Bot Cyberpunk Ultra Presisi & Variatif via Unggah File.";
router.status = "ready";
router.type = "free";

module.exports = router;
