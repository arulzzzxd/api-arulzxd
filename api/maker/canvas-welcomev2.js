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
        GlobalFonts.register(Buffer.from(data), "VipFont");
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

// Helper: Membuat Kotak dengan Sudut Tumpul (Rounded Rect)
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// Helper: Membuat Bentuk Heksagon (Path Avatar V2)
function drawHexagonPath(ctx, x, y, radius) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const hx = x + radius * Math.cos(angle);
        const hy = y + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
    }
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
        const groupName = body.groupName?.trim() || body.gcName?.trim() || "Arulzzxd || channel information system";
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

        // DIMENSI STANDAR 16:9 HD (1280 x 720)
        const width = 1280;
        const height = 720;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        const fontFamily = fontLoaded ? "VipFont" : "sans-serif";

        // ==========================================
        // 1. LATAR BELAKANG AMBIENT & LIGHTING
        // ==========================================
        if (bgImg) {
            ctx.drawImage(bgImg, 0, 0, width, height);
            ctx.fillStyle = "rgba(11, 14, 28, 0.82)";
            ctx.fillRect(0, 0, width, height);
        } else {
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#090b16');
            grad.addColorStop(0.5, '#12162e');
            grad.addColorStop(1, '#080a14');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }

        // Ambient Orb Light (Ungu & Cyan Spotlights)
        const orbLeft = ctx.createRadialGradient(250, 200, 20, 250, 200, 350);
        orbLeft.addColorStop(0, "rgba(147, 51, 234, 0.28)");
        orbLeft.addColorStop(1, "transparent");
        ctx.fillStyle = orbLeft;
        ctx.fillRect(0, 0, width, height);

        const orbRight = ctx.createRadialGradient(1030, 520, 20, 1030, 520, 350);
        orbRight.addColorStop(0, "rgba(6, 182, 212, 0.28)");
        orbRight.addColorStop(1, "transparent");
        ctx.fillStyle = orbRight;
        ctx.fillRect(0, 0, width, height);

        // Grid Dot Pattern Background
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        for (let x = 30; x < width; x += 40) {
            for (let y = 30; y < height; y += 40) {
                ctx.beginPath();
                ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ==========================================
        // 2. MAIN CENTER FLOATING GLASS CARD
        // ==========================================
        const cardW = 1040;
        const cardH = 560;
        const cardX = (width - cardW) / 2;
        const cardY = (height - cardH) / 2;

        ctx.save();
        ctx.fillStyle = "rgba(18, 22, 42, 0.82)";
        ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
        ctx.shadowBlur = 35;
        drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 32);
        ctx.fill();

        // Border Gradasi Neon (Purple-Magenta-Cyan)
        const borderGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
        borderGrad.addColorStop(0, "rgba(168, 85, 247, 0.8)");
        borderGrad.addColorStop(0.5, "rgba(236, 72, 153, 0.4)");
        borderGrad.addColorStop(1, "rgba(6, 182, 212, 0.8)");
        ctx.strokeStyle = borderGrad;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();

        // ==========================================
        // 3. TOP BANNER HEADER & MEMBER BADGE
        // ==========================================
        // Top Center Badge: "WELCOME TO THE COMMUNITY"
        const headerText = "WELCOME TO THE COMMUNITY";
        ctx.font = `bold 14px "${fontFamily}"`;
        const headerW = ctx.measureText(headerText).width + 40;
        const headerH = 34;
        const headerX = width / 2 - headerW / 2;
        const headerY = cardY + 28;

        ctx.save();
        ctx.fillStyle = "rgba(147, 51, 234, 0.18)";
        drawRoundedRect(ctx, headerX, headerY, headerW, headerH, 17);
        ctx.fill();
        ctx.strokeStyle = "rgba(168, 85, 247, 0.6)";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = "#e9d5ff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(headerText, width / 2, headerY + headerH / 2);
        ctx.restore();

        // Member Count Badge (Truncated)
        let displayMember = memberCount;
        ctx.font = `bold 14px "${fontFamily}"`;
        const maxMemberTextWidth = 180;
        if (ctx.measureText(`MEMBER #${displayMember}`).width > maxMemberTextWidth) {
            while (ctx.measureText(`MEMBER #${displayMember}...`).width > maxMemberTextWidth && displayMember.length > 0) {
                displayMember = displayMember.slice(0, -1);
            }
            displayMember += "...";
        }
        const memberText = `MEMBER #${displayMember}`;
        const memberW = ctx.measureText(memberText).width + 32;
        const memberH = 36;
        const memberX = cardX + cardW - memberW - 28;
        const memberY = cardY + 28;

        ctx.save();
        ctx.fillStyle = "rgba(6, 182, 212, 0.15)";
        drawRoundedRect(ctx, memberX, memberY, memberW, memberH, 10);
        ctx.fill();
        ctx.strokeStyle = "rgba(6, 182, 212, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#cff4fc";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(memberText, memberX + memberW / 2, memberY + memberH / 2);
        ctx.restore();

        // ==========================================
        // 4. CENTER HEXAGON AVATAR WITH NEON RINGS
        // ==========================================
        const avatarX = width / 2;
        const avatarY = cardY + 200;
        const avatarR = 105;

        // Outer Glowing Hexagon Ring (Cyan)
        ctx.save();
        ctx.shadowColor = "#06b6d4";
        ctx.shadowBlur = 25;
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 4;
        drawHexagonPath(ctx, avatarX, avatarY, avatarR + 12);
        ctx.stroke();
        ctx.restore();

        // Inner Glowing Hexagon Ring (Purple)
        ctx.save();
        ctx.shadowColor = "#a855f7";
        ctx.shadowBlur = 18;
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 3;
        drawHexagonPath(ctx, avatarX, avatarY, avatarR + 4);
        ctx.stroke();
        ctx.restore();

        // Clip & Draw Hexagon User Avatar
        ctx.save();
        drawHexagonPath(ctx, avatarX, avatarY, avatarR);
        ctx.clip();
        ctx.drawImage(userImg, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
        ctx.restore();

        // Status Indicator Pill (Online Active)
        const statusText = "● USER ACTIVE";
        ctx.font = `bold 12px "${fontFamily}"`;
        const statusW = ctx.measureText(statusText).width + 20;
        const statusH = 24;
        const statusY = avatarY + avatarR + 8;

        ctx.save();
        ctx.fillStyle = "#09131d";
        drawRoundedRect(ctx, avatarX - statusW / 2, statusY, statusW, statusH, 12);
        ctx.fill();
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#34d399";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(statusText, avatarX, statusY + statusH / 2);
        ctx.restore();

        // ==========================================
        // 5. CENTER USERNAME & GROUP NAME (AUTO-TRUNCATE)
        // ==========================================
        // Username Text (Center & Auto-Truncate)
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 48px "${fontFamily}"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        let displayUser = username;
        const maxUserWidth = cardW - 120; // Batas lebar username
        if (ctx.measureText(displayUser).width > maxUserWidth) {
            while (ctx.measureText(displayUser + "...").width > maxUserWidth && displayUser.length > 0) {
                displayUser = displayUser.slice(0, -1);
            }
            displayUser += "...";
        }
        ctx.fillText(displayUser, avatarX, avatarY + avatarR + 48);
        ctx.restore();

        // Group Name Badge (Center & Auto-Truncate)
        let displayGroup = groupName.toUpperCase();
        const maxGroupWidth = cardW - 160; // Batas lebar nama grup
        ctx.font = `bold 20px "${fontFamily}"`;

        if (ctx.measureText(`GROUP // ${displayGroup}`).width > maxGroupWidth) {
            while (ctx.measureText(`GROUP // ${displayGroup}...`).width > maxGroupWidth && displayGroup.length > 0) {
                displayGroup = displayGroup.slice(0, -1);
            }
            displayGroup += "...";
        }

        const groupText = `GROUP // ${displayGroup}`;
        const groupW = ctx.measureText(groupText).width + 38;
        const groupH = 44;
        const groupX = avatarX - groupW / 2;
        const groupY = avatarY + avatarR + 118;

        ctx.save();
        ctx.fillStyle = "rgba(168, 85, 247, 0.14)";
        drawRoundedRect(ctx, groupX, groupY, groupW, groupH, 12);
        ctx.fill();

        ctx.strokeStyle = "rgba(168, 85, 247, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#c084fc";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(groupText, avatarX, groupY + groupH / 2);
        ctx.restore();

        // Bottom Decorative Accent Bar
        const barW = 240;
        const barH = 4;
        const barX = avatarX - barW / 2;
        const barY = cardY + cardH - 35;

        ctx.save();
        const barGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
        barGrad.addColorStop(0, "rgba(168, 85, 247, 0.2)");
        barGrad.addColorStop(0.5, "#06b6d4");
        barGrad.addColorStop(1, "rgba(168, 85, 247, 0.2)");
        ctx.fillStyle = barGrad;
        ctx.fillRect(barX, barY, barW, barH);
        ctx.restore();

        // ==========================================
        // 6. EXPORT PNG BUFFER
        // ==========================================
        const buffer = await canvas.encode('png');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `inline; filename="welcome-v2-${Date.now()}.png"`);
        return res.send(buffer);

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            creator: "Arulzxd",
            message: "Internal Server Error saat membuat Welcome Canvas V2",
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
        default: "Arulzzxd || channel information system"
    },
    memberCount: {
        type: "text",
        desc: "Urutan / jumlah member",
        default: "9999"
    }
};

router.desc = "Maker Welcome Card Bot Versi 2 (Centered VIP Glassmorphism Hexagon Widescreen 16:9).";
router.status = "ready";
router.type = "free";

module.exports = router;
