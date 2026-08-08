const express = require("express");
const axios = require("axios");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");

const router = express.Router();

// URL Font Arial Narrow dari GitHub Raw
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
        const text = req.query.text;

        if (!text) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'text' diperlukan.",
                example: "/api/sticker/brat?apikey=arulzxd-keys&text=Cewe cantik"
            });
        }

        // 3. Pastikan font sudah ter-registrasi
        await loadFont();

        // 4. Proses Rendering Low Quality (256x256)
        const width = 256;
        const height = 256;
        const margin = 15; // Skala diturunkan (setengah dari 512)
        const wordSpacing = 7.5; // Skala diturunkan

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");

        // Matikan smoothing untuk efek pikselasi/low res
        ctx.imageSmoothingEnabled = false;

        // Background putih khas Brat
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, width, height);

        let fontSize = 100; // Skala setengah dari 200
        const lineHeightMultiplier = 1.1;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = "black";

        const words = text.split(" ");
        let lines = [];

        // Fungsi rekonstruksi baris teks agar pas di canvas
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
        while (lines.length * fontSize * lineHeightMultiplier > height - margin * 2 && fontSize > 10) {
            fontSize -= 1;
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

        // 5. Mengubah Canvas menjadi Buffer PNG Low Res
        const buffer = canvas.toBuffer("image/png");

        // Mengirimkan gambar PNG murni ke client
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
