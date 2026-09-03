const express = require("express");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const path = require("path");
const os = require("os");
const { writeFileSync, existsSync, unlinkSync } = require("fs");

const router = express.Router();

const BG_URL = "https://raw.githubusercontent.com/ryyntwx/Image-rinn/refs/heads/main/153a185e-f1de-4078-8042-fdfc56592c3d.png";
const DEFAULT_AVATAR_URL = "https://files.catbox.moe/wlvb0g.png";

const FONTS = [
    {
        url: "https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2",
        family: "Inter"
    }
];

async function downloadBuffer(url) {
    const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!res.ok) {
        throw new Error(`Download gagal: ${res.status} ${res.statusText}`);
    }
    return Buffer.from(await res.arrayBuffer());
}

let loadedResources = null;

async function getResources() {
    if (loadedResources) return loadedResources;

    for (const f of FONTS) {
        try {
            const fontBuffer = await downloadBuffer(f.url);
            GlobalFonts.register(fontBuffer, f.family);
        } catch (err) {
            console.warn(`Gagal memuat font [${f.family}]:`, err.message);
        }
    }

    const bgBuffer = await downloadBuffer(BG_URL);
    const bgImg = await loadImage(bgBuffer);

    loadedResources = { bgImg };
    return loadedResources;
}

async function createFakeChImage(namaInput, pengikutInput, jamInput, ppUrl) {
    const { bgImg } = await getResources();

    let ppBuffer;
    try {
        ppBuffer = await downloadBuffer(ppUrl);
    } catch {
        ppBuffer = await downloadBuffer(DEFAULT_AVATAR_URL);
    }

    const ppImg = await loadImage(ppBuffer);

    const canvas = createCanvas(bgImg.width, bgImg.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

    let namaText = namaInput;
    let pengikutText = `${pengikutInput} pengikut`;
    let jamText = jamInput;

    const config = {
        pp: { x: 585, y: 622, r: 213 },
        nama: { y: 908, maxSize: 68, maxWidth: 1000 },
        pengikut: { y: 995, size: 45 },
        jam: { x: 116, y: 63, size: 43 }
    };

    // Foto Profil Saluran
    ctx.save();
    ctx.beginPath();
    ctx.arc(config.pp.x, config.pp.y, config.pp.r, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(ppImg, config.pp.x - config.pp.r, config.pp.y - config.pp.r, config.pp.r * 2, config.pp.r * 2);
    ctx.restore();

    // Nama Saluran
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let fontSize = config.nama.maxSize;
    ctx.font = `900 ${fontSize}px Inter, sans-serif`;

    while (ctx.measureText(namaText).width > config.nama.maxWidth && fontSize > 14) {
        fontSize -= 2;
        ctx.font = `900 ${fontSize}px Inter, sans-serif`;
    }
    ctx.fillText(namaText, canvas.width / 2, config.nama.y);

    // Pengikut
    ctx.fillStyle = "#8E8E93";
    ctx.font = `500 ${config.pengikut.size}px Inter, sans-serif`;
    ctx.fillText(pengikutText, canvas.width / 2, config.pengikut.y);

    // Jam
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 ${config.jam.size}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(jamText, config.jam.x, config.jam.y);

    return await canvas.encode("png");
}

router.get("/", async (req, res) => {
    try {
        const text = req.query.text?.trim();

        let nama = req.query.nama?.trim();
        let pengikut = req.query.pengikut?.trim();
        let jam = req.query.jam?.trim();
        let url = req.query.url?.trim() || DEFAULT_AVATAR_URL;

        if (text && text.includes("|")) {
            const parts = text.split("|").map((v) => (v ? v.trim() : ""));
            nama = nama || parts[0];
            pengikut = pengikut || parts[1];
            jam = jam || parts[2];
        }

        if (!nama || !pengikut || !jam) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Parameter tidak lengkap. Gunakan ?nama=X&pengikut=Y&jam=Z&url=URL atau ?text=Nama|Pengikut|Jam"
            });
        }

        const imageBuffer = await createFakeChImage(nama, pengikut, jam, url);

        const tempPath = path.join(os.tmpdir(), `fakech-${Date.now()}.png`);
        writeFileSync(tempPath, imageBuffer);

        res.setHeader("Content-Type", "image/png");

        res.sendFile(tempPath, (err) => {
            if (existsSync(tempPath)) unlinkSync(tempPath);
            if (err && !res.headersSent) {
                console.error("Gagal mengirim file:", err);
            }
        });
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            status: false,
            creator: "ArulzXD",
            message: err.message
        });
    }
});

router.paramsConfig = {
    nama: "text",
    pengikut: "text",
    jam: "text",
    url: "text"
};

router.status = "ready";
router.type = "free";

module.exports = router;