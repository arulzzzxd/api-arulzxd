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

const DEFAULT_BG = "https://raw.githubusercontent.com/ryyntwx/allimagerin/refs/heads/main/3b1a98bd-2ebd-4035-a645-f42556300408.png";
const DEFAULT_AVATAR = "https://cdn.arulzzxd.my.id/files/XqtOfI.png";

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

async function getImage(file, url, defaultUrl) {
    if (file && file.buffer) {
        return await loadImage(file.buffer);
    }
    const targetUrl = url || defaultUrl;
    if (targetUrl) {
        const { data } = await axios.get(targetUrl, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return await loadImage(Buffer.from(data));
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

        const username = body.username?.trim() || body.name?.trim() || "User Baru";
        const groupName = body.groupName?.trim() || body.gcName?.trim() || "Grup WhatsApp";
        const memberCount = body.memberCount?.trim() || body.member?.trim() || "1";
        const titleText = body.title?.trim() || "WELCOME";

        await loadFont();

        const bgImg = await getImage(files.bgFile?.[0], body.bgUrl, DEFAULT_BG);
        const userImg = await getImage(files.userAvatarFile?.[0], body.userAvatarUrl, DEFAULT_AVATAR);
        const groupImg = await getImage(files.groupAvatarFile?.[0], body.groupAvatarUrl, DEFAULT_AVATAR);

        const width = 1024;
        const height = 500;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // 1. Render Background
        ctx.drawImage(bgImg, 0, 0, width, height);

        // 2. Overlay Gelap (Glassmorphism Effect)
        ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
        ctx.beginPath();
        ctx.roundRect(40, 40, width - 80, height - 80, 25);
        ctx.fill();

        // Border luar overlay
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.stroke();

        const fontFamily = fontLoaded ? "JakartaSans" : "sans-serif";

        // 3. Render Profile User (Lingkaran Utama)
        const userX = 180;
        const userY = height / 2;
        const userRadius = 90;

        // Outer Glow / Ring Avatar User
        ctx.save();
        ctx.beginPath();
        ctx.arc(userX, userY, userRadius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.restore();

        // Clip User Avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(userX, userY, userRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(userImg, userX - userRadius, userY - userRadius, userRadius * 2, userRadius * 2);
        ctx.restore();

        // 4. Render Profile Group (Badge Lingkaran Kecil di Kanan Atas Overlay)
        if (groupImg) {
            const groupX = width - 100;
            const groupY = 100;
            const groupRadius = 40;

            ctx.save();
            ctx.beginPath();
            ctx.arc(groupX, groupY, groupRadius + 3, 0, Math.PI * 2);
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();

            ctx.save();
            ctx.beginPath();
            ctx.arc(groupX, groupY, groupRadius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(groupImg, groupX - groupRadius, groupY - groupRadius, groupRadius * 2, groupRadius * 2);
            ctx.restore();
        }

        // 5. Render Teks Informasi
        const textX = 320;

        // Title (Contoh: WELCOME)
        ctx.fillStyle = "#60a5fa";
        ctx.font = `bold 32px "${fontFamily}"`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(titleText.toUpperCase(), textX, 130);

        // Username
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 42px "${fontFamily}"`;
        
        let displayUser = username;
        if (ctx.measureText(displayUser).width > 550) {
            while (ctx.measureText(displayUser + "...").width > 550 && displayUser.length > 0) {
                displayUser = displayUser.slice(0, -1);
            }
            displayUser += "...";
        }
        ctx.fillText(displayUser, textX, 180);

        // Group Name
        ctx.fillStyle = "#cbd5e1";
        ctx.font = `26px "${fontFamily}"`;
        ctx.fillText(`Welcome to ${groupName}`, textX, 245);

        // Member Count Pill Badge
        const badgeText = `Member #${memberCount}`;
        ctx.font = `bold 20px "${fontFamily}"`;
        const badgeWidth = ctx.measureText(badgeText).width + 30;
        const badgeHeight = 38;
        const badgeY = 300;

        ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
        ctx.beginPath();
        ctx.roundRect(textX, badgeY, badgeWidth, badgeHeight, 10);
        ctx.fill();

        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#93c5fd";
        ctx.textBaseline = "middle";
        ctx.fillText(badgeText, textX + 15, badgeY + (badgeHeight / 2));

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
    bgFile: {
        type: "file",
        desc: "Gambar latar belakang card (Opsional)"
    },
    userAvatarFile: {
        type: "file",
        desc: "Foto profil user/member (Opsional)"
    },
    groupAvatarFile: {
        type: "file",
        desc: "Foto profil grup (Opsional)"
    },
    bgUrl: {
        type: "text",
        desc: "URL latar belakang jika tidak unggah file"
    },
    userAvatarUrl: {
        type: "text",
        desc: "URL foto profil user jika tidak unggah file"
    },
    groupAvatarUrl: {
        type: "text",
        desc: "URL foto profil grup jika tidak unggah file"
    },
    username: {
        type: "text",
        desc: "Nama user/member",
        default: "Arulzxd"
    },
    groupName: {
        type: "text",
        desc: "Nama grup",
        default: "WhatsApp Bot Community"
    },
    memberCount: {
        type: "text",
        desc: "Urutan / jumlah member",
        default: "124"
    },
    title: {
        type: "text",
        desc: "Judul header card",
        default: "WELCOME"
    }
};

router.desc = "Maker Welcome Card Bot (Bisa setting background, foto profil user, & foto profil grup via upload file/URL).";
router.status = "ready";
router.type = "free";

module.exports = router;
