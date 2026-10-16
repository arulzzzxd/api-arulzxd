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

// Helper: Slanted/Angled Rect (Khas Esports/VIP Badge)
function drawSlantedRect(ctx, x, y, width, height, skew) {
    ctx.beginPath();
    ctx.moveTo(x + skew, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width - skew, y + height);
    ctx.lineTo(x, y + height);
    ctx.closePath();
}

// Helper: Heksagon Avatar VIP
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

// Helper: Teks Berjarak (Spaced Text)
function drawSpacedTextCenter(ctx, text, x, y, spacing) {
    const chars = text.split('');
    let totalWidth = 0;
    for (const c of chars) {
        totalWidth += ctx.measureText(c).width + spacing;
    }
    totalWidth -= spacing;

    let currentX = x - (totalWidth / 2);
    for (const c of chars) {
        ctx.fillText(c, currentX, y);
        currentX += ctx.measureText(c).width + spacing;
    }
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
        // 1. LATAR BELAKANG TRANSPARAN & CRIMSON LIGHTING
        // ==========================================
        if (bgImg) {
            ctx.drawImage(bgImg, 0, 0, width, height);
            ctx.fillStyle = "rgba(20, 6, 9, 0.42)";
            ctx.fillRect(0, 0, width, height);
        } else {
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#16090b');
            grad.addColorStop(0.5, '#2e1216');
            grad.addColorStop(1, '#14080a');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }

        // Ambient Glow Center (Red/Magenta)
        const orbCenter = ctx.createRadialGradient(640, 360, 40, 640, 360, 450);
        orbCenter.addColorStop(0, "rgba(239, 68, 68, 0.35)");
        orbCenter.addColorStop(0.6, "rgba(249, 115, 22, 0.18)");
        orbCenter.addColorStop(1, "transparent");
        ctx.fillStyle = orbCenter;
        ctx.fillRect(0, 0, width, height);

        // ==========================================
        // 2. MAIN CENTER GLASS CARD (SLANTED VIP CARD)
        // ==========================================
        const cardW = 1080;
        const cardH = 580;
        const cardX = (width - cardW) / 2;
        const cardY = (height - cardH) / 2;

        ctx.save();
        ctx.fillStyle = "rgba(30, 11, 15, 0.68)";
        ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
        ctx.shadowBlur = 40;
        drawSlantedRect(ctx, cardX, cardY, cardW, cardH, 20);
        ctx.fill();

        // Border Crimson Red / Magenta Neon Slanted
        const borderGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
        borderGrad.addColorStop(0, "#f43f5e");
        borderGrad.addColorStop(0.5, "rgba(239, 68, 68, 0.5)");
        borderGrad.addColorStop(1, "#f97316");
        ctx.strokeStyle = borderGrad;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        // ==========================================
        // 3. TOP BANNER "GOODBYE FROM"
        // ==========================================
        const goodbyeText = "G O O D B Y E  F R O M  T H E  G R O U P";
        ctx.font = `bold 22px "${fontFamily}"`;
        const goodbyeW = ctx.measureText(goodbyeText).width + 60;
        const goodbyeH = 48;
        const goodbyeX = width / 2 - goodbyeW / 2;
        const goodbyeY = cardY + 28;

        ctx.save();
        ctx.fillStyle = "rgba(244, 63, 94, 0.25)";
        drawSlantedRect(ctx, goodbyeX, goodbyeY, goodbyeW, goodbyeH, 12);
        ctx.fill();

        ctx.shadowColor = "#f43f5e";
        ctx.shadowBlur = 15;
        ctx.strokeStyle = "rgba(244, 63, 94, 0.85)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(goodbyeText, width / 2, goodbyeY + goodbyeH / 2);
        ctx.restore();

        // Member Count Badge Slanted (Kanan Atas)
        let displayMember = memberCount;
        ctx.font = `bold 16px "${fontFamily}"`;
        const maxMemberTextWidth = 180;
        if (ctx.measureText(`MEMBER #${displayMember}`).width > maxMemberTextWidth) {
            while (ctx.measureText(`MEMBER #${displayMember}...`).width > maxMemberTextWidth && displayMember.length > 0) {
                displayMember = displayMember.slice(0, -1);
            }
            displayMember += "...";
        }
        const memberText = `MEMBER #${displayMember}`;
        const memberW = ctx.measureText(memberText).width + 36;
        const memberH = 42;
        const memberX = cardX + cardW - memberW - 25;
        const memberY = cardY + 30;

        ctx.save();
        ctx.fillStyle = "rgba(249, 115, 22, 0.25)";
        drawSlantedRect(ctx, memberX, memberY, memberW, memberH, 10);
        ctx.fill();

        ctx.shadowColor = "#f97316";
        ctx.shadowBlur = 12;
        ctx.strokeStyle = "rgba(249, 115, 22, 0.85)";
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(memberText, memberX + memberW / 2, memberY + memberH / 2);
        ctx.restore();

        // ==========================================
        // 4. CENTER HEXAGON AVATAR (RED NEON)
        // ==========================================
        const avatarX = width / 2;
        const avatarY = cardY + 220;
        const avatarR = 108;

        // Outer Glow Ring 1 (Magenta)
        ctx.save();
        ctx.shadowColor = "#f43f5e";
        ctx.shadowBlur = 30;
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 4.5;
        drawHexagonPath(ctx, avatarX, avatarY, avatarR + 14);
        ctx.stroke();
        ctx.restore();

        // Inner Glow Ring 2 (Amber/Orange)
        ctx.save();
        ctx.shadowColor = "#f97316";
        ctx.shadowBlur = 20;
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 3;
        drawHexagonPath(ctx, avatarX, avatarY, avatarR + 5);
        ctx.stroke();
        ctx.restore();

        // Clip & Draw Hexagon User Avatar
        ctx.save();
        drawHexagonPath(ctx, avatarX, avatarY, avatarR);
        ctx.clip();
        ctx.drawImage(userImg, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
        ctx.restore();

        // Status Sub-Badge Below Avatar
        const statusText = "● MEMBER HAS LEFT";
        ctx.font = `bold 12px "${fontFamily}"`;
        const statusW = ctx.measureText(statusText).width + 24;
        const statusH = 26;
        const statusY = avatarY + avatarR + 10;

        ctx.save();
        ctx.fillStyle = "#1a080c";
        drawSlantedRect(ctx, avatarX - statusW / 2, statusY, statusW, statusH, 8);
        ctx.fill();

        ctx.shadowColor = "#f43f5e";
        ctx.shadowBlur = 10;
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#f87171";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(statusText, avatarX, statusY + statusH / 2);
        ctx.restore();

        // ==========================================
        // 5. USERNAME & GROUP (TYPOGRAPHY)
        // ==========================================
        // Sub-title label
        ctx.save();
        ctx.fillStyle = "rgba(244, 63, 94, 0.85)";
        ctx.font = `bold 13px "${fontFamily}"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        drawSpacedTextCenter(ctx, "U S E R N A M E", avatarX, avatarY + avatarR + 48, 4);
        ctx.restore();

        // Username Text (Metallic Crimson Gradient + Dual Glow)
        ctx.save();
        let displayUser = username;
        const maxUserWidth = cardW - 120;
        ctx.font = `bold 54px "${fontFamily}"`;
        if (ctx.measureText(displayUser).width > maxUserWidth) {
            while (ctx.measureText(displayUser + "...").width > maxUserWidth && displayUser.length > 0) {
                displayUser = displayUser.slice(0, -1);
            }
            displayUser += "...";
        }

        const userY = avatarY + avatarR + 68;
        
        ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
        ctx.shadowBlur = 16;
        
        const userGrad = ctx.createLinearGradient(0, userY, 0, userY + 54);
        userGrad.addColorStop(0, "#ffffff");
        userGrad.addColorStop(0.6, "#ffe4e6");
        userGrad.addColorStop(1, "#f43f5e");
        
        ctx.fillStyle = userGrad;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(displayUser, avatarX, userY);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.strokeText(displayUser, avatarX, userY);
        ctx.restore();

        // Group Name Badge (Slanted Slit Box)
        let displayGroup = groupName.toUpperCase();
        const maxGroupWidth = cardW - 160;
        ctx.font = `bold 22px "${fontFamily}"`;

        if (ctx.measureText(`GROUP : ${displayGroup}`).width > maxGroupWidth) {
            while (ctx.measureText(`GROUP : ${displayGroup}...`).width > maxGroupWidth && displayGroup.length > 0) {
                displayGroup = displayGroup.slice(0, -1);
            }
            displayGroup += "...";
        }

        const groupText = `G R O U P :  ${displayGroup}`;
        const groupW = ctx.measureText(groupText).width + 50;
        const groupH = 48;
        const groupX = avatarX - groupW / 2;
        const groupY = avatarY + avatarR + 140;

        ctx.save();
        ctx.fillStyle = "rgba(244, 63, 94, 0.18)";
        drawSlantedRect(ctx, groupX, groupY, groupW, groupH, 12);
        ctx.fill();

        ctx.shadowColor = "#f43f5e";
        ctx.shadowBlur = 14;
        ctx.strokeStyle = "rgba(244, 63, 94, 0.85)";
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(groupText, avatarX, groupY + groupH / 2);
        ctx.restore();

        // Bottom Accent Divider Line
        const barW = 340;
        const barH = 4;
        const barX = avatarX - barW / 2;
        const barY = cardY + cardH - 28;

        ctx.save();
        const barGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
        barGrad.addColorStop(0, "rgba(244, 63, 94, 0.1)");
        barGrad.addColorStop(0.5, "#f43f5e");
        barGrad.addColorStop(1, "rgba(244, 63, 94, 0.1)");
        ctx.fillStyle = barGrad;
        ctx.fillRect(barX, barY, barW, barH);
        ctx.restore();

        // ==========================================
        // 6. EXPORT PNG BUFFER
        // ==========================================
        const buffer = await canvas.encode('png');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `inline; filename="goodbye-v2-${Date.now()}.png"`);
        return res.send(buffer);

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            creator: "Arulzxd",
            message: "Internal Server Error saat membuat Goodbye Canvas V2",
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

router.desc = "Maker Goodbye Card Bot Versi 2 Gaming/Esports VIP Typography (Centered Slanted Glassmorphism 16:9).";
router.status = "ready";
router.type = "free";

module.exports = router;
