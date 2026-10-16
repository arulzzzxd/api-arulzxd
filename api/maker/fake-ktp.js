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
        GlobalFonts.register(Buffer.from(data), "KtpFont");
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

const ktpUpload = upload.fields([
    { name: 'pasFotoFile', maxCount: 1 },
    { name: 'pasFoto', maxCount: 1 },
    { name: 'userAvatarFile', maxCount: 1 }
]);

router.post('/', ktpUpload, async (req, res) => {
    try {
        const files = req.files || {};
        const body = req.body || {};

        // Mengambil berkas pas foto dari beberapa kemungkinan key field
        const photoFile = files.pasFotoFile?.[0] || files.pasFoto?.[0] || files.userAvatarFile?.[0];
        const userPhoto = await getImageFromFile(photoFile);

        if (!userPhoto) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Berkas 'pasFotoFile' (Pas foto / Foto profil) wajib diunggah!"
            });
        }

        await loadFont();

        // Canvas Dimensi Standar Kartu KTP (1000 x 630)
        const width = 1000;
        const height = 630;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        const fontFamily = fontLoaded ? "KtpFont" : "sans-serif";

        // ==========================================
        // 1. DEFAULT VALUES (DATA DEFAULT JIKA KOSONG)
        // ==========================================
        const provinsi = (body.provinsi || "PROVINSI JAWA BARAT").toUpperCase();
        const kota = (body.kota || body.kabupaten || "BANDUNG").toUpperCase();
        const nik = body.nik?.trim() || "0909090909090909";
        const nama = (body.nama || body.name || "JOHN DOE").toUpperCase();
        const ttl = (body.ttl || body.tempatTglLahir || "BANDUNG, 01-01-2000").toUpperCase();
        const jk = (body.jk || body.jenisKelamin || "LAKI-LAKI").toUpperCase();
        const golDarah = (body.golDarah || body.golonganDarah || "O").toUpperCase();
        const alamat = (body.alamat || "JL. MERDEKA NO. 1").toUpperCase();
        const rtrw = (body.rtrw || "001/002").toUpperCase();
        const kelDesa = (body.kelDesa || body.kelurahan || "CIBADUYUT").toUpperCase();
        const kecamatan = (body.kecamatan || "BOJONGLOA KIDUL").toUpperCase();
        const agama = (body.agama || "ISLAM").toUpperCase();
        const status = (body.status || body.statusPerkawinan || "BELUM KAWIN").toUpperCase();
        const pekerjaan = (body.pekerjaan || "SWASTA").toUpperCase();
        const kewarganegaraan = (body.kewarganegaraan || "WNI").toUpperCase();
        const berlakuHingga = (body.berlakuHingga || "SEUMUR HIDUP").toUpperCase();
        const tglBuat = (body.tglBuat || "BANDUNG, 01-01-2020").toUpperCase();
        const ttdText = body.ttdText || nama;

        // ==========================================
        // 2. BACKGROUND & TEXTURE KTP CYAN
        // ==========================================
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#aee2f9');
        bgGrad.addColorStop(0.5, '#d0eeef');
        bgGrad.addColorStop(1, '#b8e4f8');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Simulasi Pola Gelombang / Watermark KTP
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
        ctx.lineWidth = 12;
        for (let i = -200; i < width + 200; i += 60) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.bezierCurveTo(i + 100, height * 0.3, i - 100, height * 0.7, i + 150, height);
            ctx.stroke();
        }
        ctx.restore();

        // ==========================================
        // 3. HEADER PROVINSI & KOTA
        // ==========================================
        ctx.save();
        ctx.fillStyle = "#000000";
        ctx.font = `bold 28px "${fontFamily}"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(provinsi, width / 2, 22);
        ctx.fillText(kota, width / 2, 58);
        ctx.restore();

        // ==========================================
        // 4. BARIS NIK
        // ==========================================
        ctx.save();
        ctx.fillStyle = "#000000";
        ctx.font = `bold 36px "${fontFamily}"`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("NIK", 28, 122);
        ctx.fillText(":", 220, 122);

        // Teks NIK Monospace Spacing
        ctx.font = `bold 38px "${fontFamily}"`;
        ctx.fillText(nik, 245, 120);
        ctx.restore();

        // ==========================================
        // 5. DETAIL BIODATA KTP
        // ==========================================
        ctx.save();
        ctx.fillStyle = "#000000";
        ctx.font = `bold 22px "${fontFamily}"`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        const startXLabel = 28;
        const startXSub = 65;
        const xColon = 230;
        const xVal = 250;
        let startY = 175;
        const rowHeight = 33;

        // Rows Data
        const items = [
            { label: "Nama", val: nama },
            { label: "Tempat/Tgl Lahir", val: ttl },
            { label: "Jenis Kelamin", val: jk, extraLabel: "Gol. Darah :", extraVal: golDarah },
            { label: "Alamat", val: alamat },
            { label: "RT/RW", val: rtrw, isSub: true },
            { label: "Kel/Desa", val: kelDesa, isSub: true },
            { label: "Kecamatan", val: kecamatan, isSub: true },
            { label: "Agama", val: agama },
            { label: "Status Perkawinan", val: status },
            { label: "Pekerjaan", val: pekerjaan },
            { label: "Kewarganegaraan", val: kewarganegaraan },
            { label: "Berlaku Hingga", val: berlakuHingga }
        ];

        for (const item of items) {
            const currentX = item.isSub ? startXSub : startXLabel;
            ctx.fillText(item.label, currentX, startY);
            ctx.fillText(":", xColon, startY);
            ctx.fillText(item.val, xVal, startY);

            // Ekstra Golongan Darah
            if (item.extraLabel) {
                ctx.fillText(item.extraLabel, 490, startY);
                ctx.fillText(item.extraVal, 635, startY);
            }

            startY += rowHeight;
        }
        ctx.restore();

        // ==========================================
        // 6. PAS FOTO USER (SEBELAH KANAN)
        // ==========================================
        const photoX = 745;
        const photoY = 180;
        const photoW = 220;
        const photoH = 285;

        ctx.save();
        // Frame/Border Pas Foto
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 2;
        ctx.strokeRect(photoX, photoY, photoW, photoH);

        // Clip & Draw Pas Foto
        ctx.drawImage(userPhoto, photoX, photoY, photoW, photoH);
        ctx.restore();

        // ==========================================
        // 7. KOTA, TANGGAL PEMBUATAN & TANDA TANGAN
        // ==========================================
        const ttdCenterX = photoX + (photoW / 2);
        
        ctx.save();
        ctx.fillStyle = "#000000";
        ctx.font = `bold 20px "${fontFamily}"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        
        // Teks Kota & Tanggal di Bawah Foto
        ctx.fillText(kota, ttdCenterX, 485);
        ctx.fillText(tglBuat.split(',')[1]?.trim() || "01-01-2020", ttdCenterX, 512);

        // Simulasi Tanda Tangan Cursive / Handwriting Style
        ctx.font = `italic bold 42px "${fontFamily}"`;
        ctx.fillText(ttdText, ttdCenterX, 545);
        ctx.restore();

        // ==========================================
        // 8. EXPORT PNG BUFFER
        // ==========================================
        const buffer = await canvas.encode('png');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `inline; filename="ktp-${Date.now()}.png"`);
        return res.send(buffer);

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            creator: "Arulzxd",
            message: "Internal Server Error saat memproses KTP Canvas",
            error: err.message
        });
    }
});

router.paramsConfig = {
    pasFotoFile: {
        type: "file",
        desc: "Berkas pas foto user/karakter (Wajib)"
    },
    nik: {
        type: "text",
        desc: "Nomor NIK KTP",
        default: "0909090909090909"
    },
    nama: {
        type: "text",
        desc: "Nama Lengkap",
        default: "JOHN DOE"
    },
    ttl: {
        type: "text",
        desc: "Tempat/Tgl Lahir",
        default: "BANDUNG, 01-01-2000"
    },
    jk: {
        type: "text",
        desc: "Jenis Kelamin",
        default: "LAKI-LAKI"
    },
    golDarah: {
        type: "text",
        desc: "Golongan Darah",
        default: "O"
    },
    alamat: {
        type: "text",
        desc: "Alamat Jalan",
        default: "JL. MERDEKA NO. 1"
    },
    rtrw: {
        type: "text",
        desc: "RT/RW",
        default: "001/002"
    },
    kelDesa: {
        type: "text",
        desc: "Kelurahan/Desa",
        default: "CIBADUYUT"
    },
    kecamatan: {
        type: "text",
        desc: "Kecamatan",
        default: "BOJONGLOA KIDUL"
    },
    agama: {
        type: "text",
        desc: "Agama",
        default: "ISLAM"
    },
    status: {
        type: "text",
        desc: "Status Perkawinan",
        default: "BELUM KAWIN"
    },
    pekerjaan: {
        type: "text",
        desc: "Pekerjaan",
        default: "SWASTA"
    },
    kewarganegaraan: {
        type: "text",
        desc: "Kewarganegaraan",
        default: "WNI"
    },
    berlakuHingga: {
        type: "text",
        desc: "Masa Berlaku",
        default: "SEUMUR HIDUP"
    }
};

router.desc = "Maker Roleplay Parody KTP Generator via Unggah Pas Foto.";
router.status = "ready";
router.type = "free";

module.exports = router;
