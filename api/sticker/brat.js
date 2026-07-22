const express = require("express");
const axios = require("axios");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");

const router = express.Router();

// URL Font Arial Narrow dari GitHub Raw (Bisa diganti dengan repository Anda sendiri)
const FONT_URL = "https://raw.githubusercontent.com/arulzzzxd/database/main/font/arialnarrow.ttf";
let isFontRegistered = false;

// Fungsi untuk mendownload dan meregistrasikan font secara runtime
async function loadFont() {
    if (isFontRegistered) return;
    try {
        const response = await axios.get(FONT_URL, { responseType: "arraybuffer" });
        const fontBuffer = Buffer.from(response.data);
        
        // Registrasi font langsung dari Buffer ke @napi-rs/canvas
        GlobalFonts.register(fontBuffer, "Narrow");
        isFontRegistered = true;
    } catch (err) {
        throw new Error("Gagal memuat font dari GitHub Raw: " + err.message);
    }
}

router.get("/", async (req, res) => {
    try {
        const apikey = req.query.apikey;
        const text = req.query.text;

        // 1. Validasi Apikey
        if (!apikey) {
            return res.status(403).json({ status: false, message: "Parameter 'apikey' diperlukan." });
        }
        if (apikey !== "arulzxd-keys") {
            return res.status(403).json({ status: false, message: "Apikey tidak valid." });
        }

        // 2. Validasi Parameter Text
        if (!text) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'text' diperlukan.",
                example: "/api/sticker/brat?apikey=arulzxd-keys&text=Cewe cantik"
            });
        }

        // 3. Pastikan font sudah ter-registrasi
        await loadFont();

        // 4. Proses Rendering Menggunakan @napi-rs/canvas
        const width = 512;
        const height = 512;
        const margin = 30;
        const wordSpacing = 15; // Jarak antar kata disesuaikan agar lebih proporsional

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");

        // Background putih khas Brat
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, width, height);

        let fontSize = 200; // Mulai dari ukuran font besar
        const lineHeightMultiplier = 1.1;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = "black";

        const words = text.split(" ");
        let lines = [];

        // Fungsi rekonstruksi baris teks teks agar pas di canvas
        const rebuildLines = () => {
            lines = [];
            let currentLine = "";
            for (let word of words) {
                let testLine = currentLine ? `${currentLine} ${word}` : word;
                ctx.font = `${fontSize}px Narrow`;
                let lineWidth = ctx.measureText(testLine).width;
                
                if (lineWidth < width - margin * 2) {
                    currentLine = testLine;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                }
            }
            if (currentLine) lines.push(currentLine);
        };

        // Kurangi ukuran font secara berkala jika teks terlalu panjang dan meluber ke bawah
        rebuildLines();
        while (lines.length * fontSize * lineHeightMultiplier > height - margin * 2 && fontSize > 20) {
            fontSize -= 2;
            rebuildLines();
        }

        // Gambar teks ke canvas
        const lineHeight = fontSize * lineHeightMultiplier;
        let y = margin;
        
        for (let line of lines) {
            let wordsInLine = line.split(" ");
            let x = margin;
            ctx.font = `${fontSize}px Narrow`;
            
            for (let word of wordsInLine) {
                ctx.fillText(word, x, y);
                // Tambahkan lebar kata ditambah spasi antar kata
                x += ctx.measureText(word).width + wordSpacing;
            }
            y += lineHeight;
        }

        // 5. Mengubah Canvas menjadi Buffer PNG
        const buffer = canvas.toBuffer("image/png");

        // Mengirimkan gambar PNG murni ke client (Siap dipakai untuk fitur bot/sticker)
        res.setHeader("Content-Type", "image/png");
        return res.send(buffer);

    } catch (error) {
        res.status(500).json({
            status: false,
            creator: "ArulzXD",
            error: error.message,
            details: null
        });
    }
});

router.status = "ready"; 
router.type = "free";
module.exports = router;