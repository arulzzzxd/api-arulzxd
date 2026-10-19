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

const TEMPLATE_URL = "https://cdn.arulzzxd.my.id/files/IWczV0EHAQ.jpg";
const FONT_NIK_URL = "https://raw.githubusercontent.com/arulzzzxd/database/main/font/ocraextended.ttf";
const FONT_BODY_URL = "https://raw.githubusercontent.com/arulzzzxd/database/main/font/ARIAL.TTF";

let nikFontLoaded = false;
let bodyFontLoaded = false;
let cachedTemplate = null;

async function loadFonts() {
    const promises = [];

    if (!nikFontLoaded) {
        promises.push(
            axios.get(FONT_NIK_URL, {
                responseType: "arraybuffer",
                headers: { "User-Agent": "Mozilla/5.0" }
            }).then(({ data }) => {
                GlobalFonts.register(Buffer.from(data), "NikFont");
                nikFontLoaded = true;
            }).catch(e => console.error("Gagal memuat font NIK:", e.message))
        );
    }

    if (!bodyFontLoaded) {
        promises.push(
            axios.get(FONT_BODY_URL, {
                responseType: "arraybuffer",
                headers: { "User-Agent": "Mozilla/5.0" }
            }).then(({ data }) => {
                GlobalFonts.register(Buffer.from(data), "KtpFont");
                bodyFontLoaded = true;
            }).catch(e => console.error("Gagal memuat font Body:", e.message))
        );
    }

    await Promise.all(promises);
}

async function getTemplateImage() {
    if (cachedTemplate) return cachedTemplate;
    try {
        const { data } = await axios.get(TEMPLATE_URL, {
            responseType: "arraybuffer",
            headers: { "User-Agent": "Mozilla/5.0" }
        });
        cachedTemplate = await loadImage(Buffer.from(data));
        return cachedTemplate;
    } catch (e) {
        console.error("Gagal memuat mentahan KTP:", e.message);
        return null;
    }
}

async function getImageFromFile(file) {
    if (file && file.buffer) {
        return await loadImage(file.buffer);
    }
    return null;
}

// Fungsi pembuat tanda tangan acak (Ukuran diperbesar, tebal, & lebat)
function drawRandomSignature(ctx, cx, cy, seedText) {
    let hash = 0;
    for (let i = 0; i < seedText.length; i++) {
        hash = seedText.charCodeAt(i) + ((hash << 5) - hash);
    }

    const random = () => {
        const x = Math.sin(hash++) * 10000;
        return x - Math.floor(x);
    };

    ctx.save();
    ctx.strokeStyle = "#081124"; // Warna tinta pulpen pekat
    ctx.lineWidth = 4.2; // Ketebalan tinta diperbesar
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    let startX = cx - 70 + random() * 12; // Bentangan disebarkan dari -70
    let startY = cy + 2 - random() * 10;
    ctx.moveTo(startX, startY);

    // Tarikan awal / Inisial (Ukuran diperbesar)
    ctx.bezierCurveTo(
        startX - 35, startY - 40,
        startX + 50, startY - 50,
        startX + 32, startY + 12
    );

    // Gelombang coretan acak (Rentang gelombang diperlebar)
    let currX = startX + 32;
    let currY = startY + 12;
    const loopCount = 3 + Math.floor(random() * 3);
    for (let i = 0; i < loopCount; i++) {
        let nextX = currX + 22 + random() * 12;
        let nextY = cy + (random() - 0.5) * 30;
        ctx.quadraticCurveTo(currX + 8, currY - 20 * (i % 2 === 0 ? 1 : -1), nextX, nextY);
        currX = nextX;
        currY = nextY;
    }

    // Garis bawah / Aksen tanda tangan
    ctx.moveTo(startX - 20, cy + 25);
    ctx.bezierCurveTo(
        cx - 15, cy + 35 + random() * 8,
        cx + 45, cy + 15,
        currX + 22, cy + 25
    );

    // Garis silang / titik hiasan acak
    if (random() > 0.3) {
        ctx.moveTo(currX + 8, cy - 12);
        ctx.lineTo(currX + 20, cy + 12);
    }

    ctx.stroke();
    ctx.restore();
}

const ktpUpload = upload.fields([
    { name: 'pasFotoFile', maxCount: 1 },
    { name: 'pasFoto', maxCount: 1 },
    { name: 'userAvatarFile', maxCount: 1 }
]);

router.post('/', ktpUpload, async (req, res) => {
    try {
        const files = req.files || {};
        const body = { ...req.query, ...req.body };

        const photoFile = files.pasFotoFile?.[0] || files.pasFoto?.[0] || files.userAvatarFile?.[0];
        const userPhoto = await getImageFromFile(photoFile);

        if (!userPhoto) {
            return res.status(400).json({
                status: false,
                creator: "Arulzxd",
                message: "Berkas 'pasFotoFile' (Pas foto) wajib diunggah!"
            });
        }

        const templateImg = await getTemplateImage();
        if (!templateImg) {
            return res.status(500).json({
                status: false,
                creator: "Arulzxd",
                message: "Gagal memproses gambar mentahan KTP dari server."
            });
        }

        await loadFonts();

        const width = templateImg.width;
        const height = templateImg.height;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        const fontFamily = bodyFontLoaded ? "KtpFont" : "sans-serif";
        const nikFontFamily = nikFontLoaded ? "NikFont" : "monospace";

        // 1. RENDER MENTAHAN KTP TEMPLATE
        ctx.drawImage(templateImg, 0, 0, width, height);

        // 2. DATA VALUES INPUT & FORMATTING
        let provinsi = (body.provinsi || "PROVINSI JAWA BARAT").trim().toUpperCase();
        if (!provinsi.startsWith("PROVINSI")) {
            provinsi = "PROVINSI " + provinsi;
        }

        let kota = (body.kota || body.kabupaten || "KOTA BANDUNG").trim().toUpperCase();
        if (!kota.startsWith("KOTA") && !kota.startsWith("KABUPATEN")) {
            kota = "KOTA " + kota;
        }

        const nik = body.nik?.trim() || "3273010101000001";
        const nama = (body.nama || body.name || "JOHN DOE").toUpperCase();
        const ttl = (body.ttl || body.tempatTglLahir || "BANDUNG, 01-01-2000").toUpperCase();
        const jk = (body.jk || body.jenisKelamin || "LAKI-LAKI").toUpperCase();
        const golDarah = (body.golDarah || body.golonganDarah || "O").toUpperCase();
        const alamat = (body.alamat || "JL. MERDEKA NO. 123").toUpperCase();
        const rtrw = (body.rtrw || "001/002").toUpperCase();
        const kelDesa = (body.kelDesa || body.kelurahan || "CIBADUYUT").toUpperCase();
        const kecamatan = (body.kecamatan || "BOJONGLOA KIDUL").toUpperCase();
        const agama = (body.agama || "ISLAM").toUpperCase();
        const status = (body.status || body.statusPerkawinan || "BELUM KAWIN").toUpperCase();
        const pekerjaan = (body.pekerjaan || "SWASTA").toUpperCase();
        const kewarganegaraan = (body.kewarganegaraan || "WNI").toUpperCase();
        const berlakuHingga = (body.berlakuHingga || "SEUMUR HIDUP").toUpperCase();
        const tglBuat = (body.tglBuat || "BANDUNG, 01-01-2021").toUpperCase();

        // 3. HEADER PROVINSI & KOTA
        ctx.save();
        ctx.fillStyle = "#000000";
        ctx.font = `bold ${Math.round(height * 0.038)}px "${fontFamily}"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(provinsi, width * 0.495, height * 0.048);
        ctx.fillText(kota, width * 0.495, height * 0.088);
        ctx.restore();

        // 4. VALUE NIK (Tepat di samping titik dua NIK)
        ctx.save();
        ctx.fillStyle = "#000000";
        ctx.font = `bold ${Math.round(height * 0.052)}px "${nikFontFamily}"`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(nik, width * 0.202, height * 0.202);
        ctx.restore();

        // 5. ISIAN BIODATA KTP (Tepat di samping titik dua :)
        ctx.save();
        ctx.fillStyle = "#050505";
        ctx.font = `bold ${Math.round(height * 0.028)}px "${fontFamily}"`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        const valX = width * 0.302; // Digeser rapat ke titik dua
        const rows = [
            { y: height * 0.278, val: nama },
            { y: height * 0.330, val: ttl },
            { y: height * 0.382, val: jk },
            { y: height * 0.434, val: alamat },
            { y: height * 0.486, val: rtrw },
            { y: height * 0.538, val: kelDesa },
            { y: height * 0.590, val: kecamatan },
            { y: height * 0.642, val: agama },
            { y: height * 0.694, val: status },
            { y: height * 0.746, val: pekerjaan },
            { y: height * 0.798, val: kewarganegaraan },
            { y: height * 0.850, val: berlakuHingga }
        ];

        for (const row of rows) {
            ctx.fillText(row.val, valX, row.y);
        }

        // Value Golongan Darah (Pas di samping titik dua Gol. Darah)
        ctx.fillText(golDarah, width * 0.675, height * 0.382);
        ctx.restore();

        // 6. RENDER PAS FOTO USER
        const photoX = width * 0.710;
        const photoY = height * 0.170;
        const photoW = width * 0.245;
        const photoH = height * 0.455; // Mengurangi tinggi agar tidak menabrak teks kota

        ctx.save();
        ctx.drawImage(userPhoto, photoX, photoY, photoW, photoH);
        ctx.restore();

        // 7. KOTA & TANGGAL TERBIT (Berada di bawah foto dengan jarak aman)
        const ttdCenterX = photoX + (photoW / 2);

        ctx.save();
        ctx.fillStyle = "#000000";
        ctx.font = `bold ${Math.round(height * 0.026)}px "${fontFamily}"`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        const kotaOnly = kota.replace("KOTA", "").replace("KABUPATEN", "").trim();
        const tglOnly = tglBuat.includes(',') ? tglBuat.split(',')[1].trim() : tglBuat;

        ctx.fillText(kotaOnly, ttdCenterX, height * 0.650);
        ctx.fillText(tglOnly, ttdCenterX, height * 0.688);
        ctx.restore();

        // 8. TANDA TANGAN (Diperbesar dan diposisikan proporsional)
        drawRandomSignature(ctx, ttdCenterX, height * 0.800, nama + nik);

        // EXPORT BUFFER PNG
        const buffer = await canvas.encode('png');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `inline; filename="ktp-${Date.now()}.png"`);
        return res.send(buffer);

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            creator: "Arulzxd",
            message: "Internal Server Error saat merender KTP",
            error: err.message
        });
    }
});

router.paramsConfig = {
    pasFotoFile: {
        type: "file",
        desc: "Berkas pas foto user (Wajib)"
    },
    provinsi: {
        type: "text",
        desc: "Provinsi KTP",
        default: "PROVINSI JAWA BARAT"
    },
    kota: {
        type: "text",
        desc: "Kota / Kabupaten KTP",
        default: "KOTA BANDUNG"
    },
    nik: {
        type: "text",
        desc: "Nomor NIK KTP",
        default: "3273010101000001"
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
        default: "JL. MERDEKA NO. 123"
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
    },
    tglBuat: {
        type: "text",
        desc: "Kota dan Tanggal Pembuatan",
        default: "BANDUNG, 01-01-2021"
    }
};

router.desc = "Maker KTP Canvas generator presisi dengan template e-KTP dan tanda tangan acak.";
router.status = "ready";
router.type = "free";

module.exports = router;
