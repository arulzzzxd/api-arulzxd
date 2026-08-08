const express = require("express");
const axios = require("axios");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const { spawn } = require("child_process");

const router = express.Router();

// Asset URL
const FONT_URL = "https://raw.githubusercontent.com/arulzzzxd/database/main/font/arialnarrow.ttf";
let isFontRegistered = false;

// Load & Register Font langsung ke Memory (RAM)
async function loadFont() {
    if (isFontRegistered) return;
    try {
        const response = await axios.get(FONT_URL, { responseType: "arraybuffer" });
        const fontBuffer = Buffer.from(response.data);
        GlobalFonts.register(fontBuffer, "Narrow");
        isFontRegistered = true;
    } catch (err) {
        throw new Error("Gagal memuat font dari GitHub Raw: " + err.message);
    }
}

// Fungsi Render Frame ke Canvas Buffer
function renderFrameBuffer(text) {
    const width = 512;
    const height = 512;
    const margin = 30;
    const wordSpacing = 15;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);

    let fontSize = 200;
    const lineHeightMultiplier = 1.1;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "black";

    const words = text.split(" ");
    let lines = [];

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

    rebuildLines();
    while (lines.length * fontSize * lineHeightMultiplier > height - margin * 2 && fontSize > 20) {
        fontSize -= 2;
        rebuildLines();
    }

    const lineHeight = fontSize * lineHeightMultiplier;
    let y = margin;
    
    for (let line of lines) {
        let wordsInLine = line.split(" ");
        let x = margin;
        ctx.font = `${fontSize}px Narrow`;
        
        for (let word of wordsInLine) {
            ctx.fillText(word, x, y);
            x += ctx.measureText(word).width + wordSpacing;
        }
        y += lineHeight;
    }

    return canvas.toBuffer("image/png");
}

// Render Video In-Memory Menggunakan FFmpeg Stream Pipe
function generateVideoFromBuffers(frameBuffers, fps = 2.5) {
    return new Promise((resolve, reject) => {
        // Membuka subprocess FFmpeg yang menerima input imagepipe dari stdin
        const ffmpeg = spawn("ffmpeg", [
            "-y",
            "-f", "image2pipe",
            "-vcodec", "png",
            "-r", String(fps),             // Frame rate / kecepatan animasi
            "-i", "-",                      // '-' berarti membaca input dari stdin Stream
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "ultrafast",
            "-f", "mp4",
            "-movflags", "frag_keyframe+empty_moov", // Izinkan output stream MP4 langsung di RAM
            "pipe:1"                        // Output dikirim ke stdout Stream
        ]);

        const chunks = [];

        ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
        ffmpeg.stderr.on("data", () => {}); // Supaya buffer stderr tidak memicu error

        ffmpeg.on("close", (code) => {
            if (code === 0) {
                resolve(Buffer.concat(chunks));
            } else {
                reject(new Error(`FFmpeg exited with code ${code}`));
            }
        });

        ffmpeg.on("error", (err) => reject(err));

        // Tulis semua buffer gambar bertahap ke stdin FFmpeg
        for (const buf of frameBuffers) {
            ffmpeg.stdin.write(buf);
        }

        // Tahan frame terakhir (repeat) beberapa kali agar tulisan akhir sempat terbaca
        const lastFrame = frameBuffers[frameBuffers.length - 1];
        for (let i = 0; i < 3; i++) {
            ffmpeg.stdin.write(lastFrame);
        }

        ffmpeg.stdin.end();
    });
}

router.get("/", async (req, res) => {
    try {
        const text = req.query.text;

        if (!text) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'text' diperlukan.",
                example: "/api/sticker/bratvid?text=Halo semuanya"
            });
        }

        await loadFont();

        const words = text.split(" ").filter(Boolean);
        const frameBuffers = [];

        // Buat frame buffer secara in-memory
        for (let i = 0; i < words.length; i++) {
            const partialText = words.slice(0, i + 1).join(" ");
            const frameBuf = renderFrameBuffer(partialText);
            frameBuffers.push(frameBuf);
        }

        // Konversi deretan buffer frame ke buffer video MP4
        const videoBuffer = await generateVideoFromBuffers(frameBuffers, 2.5);

        res.setHeader("Content-Type", "video/mp4");
        return res.send(videoBuffer);

    } catch (error) {
        res.status(500).json({
            status: false,
            creator: "ArulzXD",
            error: error.message
        });
    }
});

router.status = "ready";
router.type = "free";
module.exports = router;
