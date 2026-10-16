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

// Helper: Membuat Rectangle Sudut Terpotong (Sci-Fi Cut-Corner)
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

// Helper: Frame Siku HUD (Bracket Accent)
function drawHUDCorners(ctx, x, y, width, height, len, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    // Top-Left
    ctx.beginPath(); ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    // Top-Right
    ctx.beginPath(); ctx.moveTo(x + width - len, y); ctx.lineTo(x + width); ctx.lineTo(x + width, y + len); ctx.stroke();
    // Bottom-Left
    ctx.beginPath(); ctx.moveTo(x, y + height - len); ctx.lineTo(x, y + height); ctx.lineTo(x + len, y + height); ctx.stroke();
    // Bottom-Right
    ctx.beginPath(); ctx.moveTo(x + width - len, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - len); ctx.stroke();

    ctx.restore();
}

// Helper: Barcode Digital
function drawBarcode(ctx, x, y, width, height, color) {
    ctx.save();
    ctx.fillStyle = color;
    let currX = x;
    while (currX < x + width) {
        const w = Math.random() > 0.5 ? 4 : 2;
        const gap = Math.random() * 3 + 2;
        if (currX + w <= x + width) {
            ctx.fillRect(currX, y, w, height);
        }
        currX += w + gap;
    }
    ctx.restore();
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

        // RASIO 16:9 STANDAR HD (1280 x 720)
        const width = 1280;
        const height = 720;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        const fontFamily = fontLoaded ? "CyberFont" : "sans-serif";

        // ==========================================
        // 1. BACKGROUND & MULTI-LAYER GRID
        // ==========================================
        if (bgImg) {
            ctx.drawImage(bgImg, 0, 0, width, height);
            ctx.fillStyle = "rgba(2, 4, 10, 0.78)";
            ctx.fillRect(0, 0, width, height);
        } else {
            const grad = ctx.createLinearGradient(0, 0, width, height);
            grad.addColorStop(0, '#020409');
            grad.addColorStop(0.5, '#080d1a');
            grad.addColorStop(1, '#03050d');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }

        // Cyber Grid Lines Pattern
        ctx.strokeStyle = "rgba(0, 240, 255, 0.05)";
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = 0; y < height; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }

        // Ambient Glowing Center
        const ambientGlow = ctx.createRadialGradient(950, 360, 50, 950, 360, 500);
        ambientGlow.addColorStop(0, "rgba(0, 240, 255, 0.15)");
        ambientGlow.addColorStop(0.6, "rgba(255, 0, 85, 0.1)");
        ambientGlow.addColorStop(1, "transparent");
        ctx.fillStyle = ambientGlow;
        ctx.fillRect(0, 0, width, height);

        // ==========================================
        // 2. PANEL KIRI SOLID CYBER SLANT
        // ==========================================
        const topCutX = 540;
        const botCutX = 280;

        ctx.save();
        ctx.fillStyle = "#050812";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(topCutX, 0);
        ctx.lineTo(botCutX, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Neon Border Stripe (Dual Color: Magenta & Cyan)
        const stripeWidth = 55;
        ctx.save();
        ctx.fillStyle = "#0a1122";
        ctx.beginPath();
        ctx.moveTo(topCutX, 0);
        ctx.lineTo(topCutX + stripeWidth, 0);
        ctx.lineTo(botCutX + stripeWidth, height);
        ctx.lineTo(botCutX, height);
        ctx.closePath();
        ctx.fill();

        // Cyan Line
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 20;
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(topCutX + stripeWidth, 0); ctx.lineTo(botCutX + stripeWidth, height);
        ctx.stroke();

        // Magenta Line
        ctx.shadowColor = "#ff0055";
        ctx.shadowBlur = 15;
        ctx.strokeStyle = "#ff0055";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(topCutX, 0); ctx.lineTo(botCutX, height);
        ctx.stroke();
        ctx.restore();

        // ==========================================
        // 3. TEKS "WELCOME TO" ROTASI SEJAJAR PEMBATAS
        // ==========================================
        ctx.save();
        const dx = topCutX - botCutX;
        const dy = -height;
        const slope = Math.atan2(dy, dx);

        const midStripeX = (topCutX + botCutX + stripeWidth) / 2;
        const midStripeY = height / 2;

        ctx.translate(midStripeX, midStripeY);
        ctx.rotate(slope);

        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 14;
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 32px "${fontFamily}"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("WELCOME TO", 0, 0);
        ctx.restore();

        // ==========================================
        // 4. AREA AVATAR USER RADAR HUD SUPER RICH
        // ==========================================
        const avatarX = 200;
        const avatarY = 360;
        const avatarRadius = 125;

        // Ambient Radial Glow
        ctx.save();
        const avGlow = ctx.createRadialGradient(avatarX, avatarY, 30, avatarX, avatarY, avatarRadius + 50);
        avGlow.addColorStop(0, "rgba(0, 240, 255, 0.35)");
        avGlow.addColorStop(0.7, "rgba(255, 0, 85, 0.2)");
        avGlow.addColorStop(1, "transparent");
        ctx.fillStyle = avGlow;
        ctx.beginPath(); ctx.arc(avatarX, avatarY, avatarRadius + 50, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Sci-Fi Polygon Octagon Frame
        ctx.save();
        ctx.strokeStyle = "rgba(0, 240, 255, 0.5)";
        ctx.lineWidth = 2.5;
        const octR = avatarRadius + 32;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const ox = avatarX + octR * Math.cos(angle);
            const oy = avatarY + octR * Math.sin(angle);
            if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Dashed Ring (Magenta)
        ctx.save();
        ctx.shadowColor = "#ff0055";
        ctx.shadowBlur = 18;
        ctx.strokeStyle = "#ff0055";
        ctx.lineWidth = 3;
        ctx.setLineDash([16, 8]);
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarRadius + 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Inner Solid Ring (Cyan Glow)
        ctx.save();
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 25;
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarRadius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Crosshair Ticks (+)
        ctx.save();
        ctx.fillStyle = "#00f0ff";
        const ticks = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
        for (const angle of ticks) {
            const tx = avatarX + Math.cos(angle) * (avatarRadius + 8);
            const ty = avatarY + Math.sin(angle) * (avatarRadius + 8);
            ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        // HUD Corners pada Avatar
        const bracketBoxSize = (avatarRadius + 38) * 2;
        drawHUDCorners(ctx, avatarX - bracketBoxSize / 2, avatarY - bracketBoxSize / 2, bracketBoxSize, bracketBoxSize, 20, "rgba(0, 240, 255, 0.85)");

        // Render Avatar Image
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(userImg, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
        ctx.restore();

        // Tag Badge Top & Bottom
        ctx.save();
        const topBadgeText = "[ TARGET LOCKED ]";
        ctx.font = `bold 13px "${fontFamily}"`;
        const topBW = ctx.measureText(topBadgeText).width + 24;
        ctx.fillStyle = "#ff0055";
        drawCutCornerRect(ctx, avatarX - topBW / 2, avatarY - avatarRadius - 52, topBW, 26, 6);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(topBadgeText, avatarX, avatarY - avatarRadius - 38);

        ctx.fillStyle = "#00f0ff";
        ctx.font = `bold 13px "${fontFamily}"`;
        ctx.fillText("SYS.LOC // 0x7F9A-CYBER", avatarX, avatarY + avatarRadius + 45);
        ctx.restore();

        // Telemetry Status Kiri Atas
        ctx.save();
        ctx.fillStyle = "rgba(0, 240, 255, 0.75)";
        ctx.font = `12px "${fontFamily}"`;
        ctx.textAlign = "left";
        ctx.fillText("SYNC : 99.9%", 25, 40);
        ctx.fillText("SIG  : OPTIMAL", 25, 60);
        ctx.fillText("CORE : RUNNING", 25, 80);
        ctx.restore();

        // ==========================================
        // 5. MEMBER PILL BADGE (KANAN ATAS TRUNCATION)
        // ==========================================
        let displayMember = memberCount;
        ctx.font = `bold 18px "${fontFamily}"`;
        const maxMemberTextWidth = 220; // Batas maksimum lebar teks member
        if (ctx.measureText(`MEMBER #${displayMember}`).width > maxMemberTextWidth) {
            while (ctx.measureText(`MEMBER #${displayMember}...`).width > maxMemberTextWidth && displayMember.length > 0) {
                displayMember = displayMember.slice(0, -1);
            }
            displayMember += "...";
        }
        const pillText = `MEMBER #${displayMember}`;
        const pillW = ctx.measureText(pillText).width + 42;
        const pillH = 46;
        const pillX = width - pillW - 45;
        const pillY = 40;

        ctx.save();
        ctx.fillStyle = "#060a14";
        drawCutCornerRect(ctx, pillX, pillY, pillW, pillH, 10);
        ctx.fill();

        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 16;
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pillText, pillX + (pillW / 2), pillY + (pillH / 2));
        ctx.restore();

        // ==========================================
        // 6. PANEL INFORMASI HUD GLASSMORPHISM (KANAN)
        // ==========================================
        const infoX = 620;
        const infoY = 190;
        const infoW = 610;
        const infoH = 440;

        // Glass Panel
        ctx.save();
        ctx.fillStyle = "rgba(6, 10, 20, 0.94)";
        drawCutCornerRect(ctx, infoX, infoY, infoW, infoH, 22);
        ctx.fill();

        ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // HUD Corners di Dalam Info Panel
        drawHUDCorners(ctx, infoX, infoY, infoW, infoH, 24, "#00f0ff");

        const textLeft = infoX + 40;

        // A. Header Status Dot & Bar
        ctx.save();
        ctx.fillStyle = "#00f0ff";
        ctx.beginPath(); ctx.arc(textLeft + 5, infoY + 40, 6, 0, Math.PI * 2); ctx.fill();
        ctx.shadowColor = "#00f0ff"; ctx.shadowBlur = 12; ctx.fill();

        ctx.fillStyle = "#00f0ff";
        ctx.font = `bold 14px "${fontFamily}"`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("SYSTEM ONLINE // USER AUTHENTICATED", textLeft + 22, infoY + 40);
        ctx.restore();

        // B. Username Text (Auto Truncate / Menyuut)
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 52px "${fontFamily}"`;
        ctx.textBaseline = "top";

        let displayUser = username;
        const maxUserWidth = infoW - 80;
        if (ctx.measureText(displayUser).width > maxUserWidth) {
            while (ctx.measureText(displayUser + "...").width > maxUserWidth && displayUser.length > 0) {
                displayUser = displayUser.slice(0, -1);
            }
            displayUser += "...";
        }
        ctx.fillText(displayUser, textLeft, infoY + 80);
        ctx.restore();

        // C. Group Name Badge Box (Auto Truncate / Menyuut)
        let displayGroup = groupName.toUpperCase();
        const maxGroupTextWidth = infoW - 120; // Batas lebar teks grup di dalam box
        ctx.font = `bold 22px "${fontFamily}"`;

        if (ctx.measureText(`GROUP // ${displayGroup}`).width > maxGroupTextWidth) {
            while (ctx.measureText(`GROUP // ${displayGroup}...`).width > maxGroupTextWidth && displayGroup.length > 0) {
                displayGroup = displayGroup.slice(0, -1);
            }
            displayGroup += "...";
        }

        const groupLabel = `GROUP // ${displayGroup}`;
        const groupW = ctx.measureText(groupLabel).width + 36;
        const groupH = 46;
        const groupY = infoY + 185;

        ctx.save();
        ctx.fillStyle = "rgba(0, 240, 255, 0.14)";
        drawCutCornerRect(ctx, textLeft, groupY, groupW, groupH, 8);
        ctx.fill();

        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#00f0ff";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(groupLabel, textLeft + 18, groupY + (groupH / 2));
        ctx.restore();

        // D. Digital Barcode & Equalizer Progress Bar
        const botUIY = infoY + 295;

        // Equalizer Bars
        ctx.save();
        ctx.fillStyle = "#00f0ff";
        ctx.fillRect(textLeft, botUIY, 180, 6);

        ctx.fillStyle = "#ff0055";
        ctx.fillRect(textLeft + 192, botUIY, 55, 6);

        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.fillRect(textLeft + 255, botUIY, 220, 6);

        // Barcode Hiasan Digital
        drawBarcode(ctx, infoX + infoW - 170, botUIY - 10, 130, 32, "rgba(0, 240, 255, 0.8)");

        // Text Specs Bottom
        ctx.fillStyle = "rgba(0, 240, 255, 0.7)";
        ctx.font = `12px "${fontFamily}"`;
        ctx.textBaseline = "top";
        ctx.fillText("+ + + CYBER_WELCOME_HUD // ACCESS LEVEL: MAXIMUM (16:9 HD)", textLeft, botUIY + 25);
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
        default: "Arulzzxd || channel information system"
    },
    memberCount: {
        type: "text",
        desc: "Urutan / jumlah member",
        default: "9999"
    }
};

router.desc = "Maker Welcome Card Bot Cyberpunk 16:9 HD Widescreen (1280x720).";
router.status = "ready";
router.type = "free";

module.exports = router;
