const express = require("express");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const path = require("path");
const os = require("os");
const { writeFileSync, unlinkSync, existsSync } = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");
const ffmpegPath = require("ffmpeg-static");

const execFileAsync = promisify(execFile);
const router = express.Router();

const BRAT_IMAGE_URL = "https://files.catbox.moe/wlvb0g.png";
const BRAT_FONT_URL = "https://raw.githubusercontent.com/arulzzzxd/database/main/font/Poppins.ttf";

const CANVAS = {
    width: 1254,
    height: 1254
};

// AREA KERTAS
const SAFE_ZONE = {
    top: 790,
    bottom: 975,
    left: 445,
    right: 815
};

const TEXT_STYLE = {
    fontFamily: "PoppinsBratAnimeVideo",
    maxFontSize: 76,
    minFontSize: 18,
    lineHeight: 1.15,
    color: "#111111"
};

const VIDEO_CONFIG = {
    fps: 24,
    width: 512,
    height: 512,
    lyric: {
        maxWordPerLayer: 5,
        frameDuration: 0.7,
        lastFrameDuration: 1.5
    }
};

async function downloadBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Download gagal: ${res.status} ${res.statusText}`);
    }
    return Buffer.from(await res.arrayBuffer());
}

function normalizeText(text) {
    return String(text || "")
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function tokenize(text) {
    return normalizeText(text)
        .replace(/[,，]/g, " ")
        .split(/\s+/)
        .map((v) => v.trim())
        .filter(Boolean);
}

function splitIntoLayers(tokens, maxWordPerLayer) {
    if (!Number.isFinite(maxWordPerLayer) || maxWordPerLayer <= 0) {
        return [tokens];
    }
    const layers = [];
    for (let i = 0; i < tokens.length; i += maxWordPerLayer) {
        layers.push(tokens.slice(i, i + maxWordPerLayer));
    }
    return layers;
}

function buildRevealFrames(text, lyricConfig) {
    const tokens = tokenize(text);
    const layers = splitIntoLayers(tokens, lyricConfig.maxWordPerLayer);
    const frames = [];

    for (const layer of layers) {
        let current = "";
        for (let i = 0; i < layer.length; i++) {
            current += (current ? " " : "") + layer[i];
            const isLastInLayer = i === layer.length - 1;
            frames.push({
                text: current,
                duration: isLastInLayer ? lyricConfig.lastFrameDuration : lyricConfig.frameDuration
            });
        }
    }

    return frames;
}

function setFont(ctx, size) {
    ctx.font = `${size}px ${TEXT_STYLE.fontFamily}`;
}

function splitLongWord(ctx, word, maxWidth) {
    const chars = [...word];
    const result = [];
    let current = "";

    for (const char of chars) {
        const test = current + char;

        if (ctx.measureText(test).width <= maxWidth || current.length === 0) {
            current = test;
        } else {
            result.push(current);
            current = char;
        }
    }

    if (current) result.push(current);
    return result;
}

function wrapParagraph(ctx, text, maxWidth) {
    const words = text.split(" ").filter(Boolean);
    const lines = [];
    let current = "";

    for (const word of words) {
        const test = current ? current + " " + word : word;

        if (ctx.measureText(test).width <= maxWidth) {
            current = test;
            continue;
        }

        if (current) {
            lines.push(current);
            current = "";
        }

        if (ctx.measureText(word).width <= maxWidth) {
            current = word;
        } else {
            const pieces = splitLongWord(ctx, word, maxWidth);
            lines.push(...pieces.slice(0, -1));
            current = pieces[pieces.length - 1];
        }
    }

    if (current) lines.push(current);
    return lines;
}

function wrapText(ctx, text, maxWidth) {
    return text.split("\n").flatMap((paragraph) => {
        const clean = paragraph.trim();
        if (!clean) return [""];
        return wrapParagraph(ctx, clean, maxWidth);
    });
}

function fitText(ctx, text, width, height) {
    for (let size = TEXT_STYLE.maxFontSize; size >= TEXT_STYLE.minFontSize; size--) {
        setFont(ctx, size);

        const lines = wrapText(ctx, text, width);
        const lineHeight = size * TEXT_STYLE.lineHeight;
        const totalHeight = lines.length * lineHeight;
        const widestLine = Math.max(...lines.map((line) => ctx.measureText(line).width));

        if (widestLine <= width && totalHeight <= height) {
            return {
                size,
                lines,
                lineHeight,
                totalHeight
            };
        }
    }

    setFont(ctx, TEXT_STYLE.minFontSize);

    return {
        size: TEXT_STYLE.minFontSize,
        lines: wrapText(ctx, text, width),
        lineHeight: TEXT_STYLE.minFontSize * TEXT_STYLE.lineHeight,
        totalHeight: 0
    };
}

function drawCenteredText(ctx, text) {
    const padding = {
        top: 12,
        bottom: 12,
        left: 25,
        right: 25
    };

    const width = SAFE_ZONE.right - SAFE_ZONE.left - padding.left - padding.right;
    const height = SAFE_ZONE.bottom - SAFE_ZONE.top - padding.top - padding.bottom;

    const fitted = fitText(ctx, text, width, height);

    setFont(ctx, fitted.size);

    const centerX = (SAFE_ZONE.left + SAFE_ZONE.right) / 2;
    const centerY = (SAFE_ZONE.top + SAFE_ZONE.bottom) / 2 - 8;

    ctx.save();

    ctx.beginPath();
    ctx.rect(
        SAFE_ZONE.left,
        SAFE_ZONE.top,
        SAFE_ZONE.right - SAFE_ZONE.left,
        SAFE_ZONE.bottom - SAFE_ZONE.top
    );
    ctx.clip();

    ctx.translate(centerX, centerY);

    // kemiringan mengikuti kertas
    ctx.rotate((-2 * Math.PI) / 180);

    ctx.fillStyle = TEXT_STYLE.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const totalHeight = fitted.lines.length * fitted.lineHeight;
    let y = -(totalHeight / 2) + fitted.lineHeight / 2;

    for (const line of fitted.lines) {
        ctx.fillText(line, 0, y);
        y += fitted.lineHeight;
    }

    ctx.restore();
}

async function renderFrameBuffer(baseImage, text) {
    const canvas = createCanvas(CANVAS.width, CANVAS.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(baseImage, 0, 0, CANVAS.width, CANVAS.height);
    drawCenteredText(ctx, normalizeText(text));

    return await canvas.encode("png");
}

let loadedResources = null;

async function getResources() {
    if (loadedResources) return loadedResources;

    const [imageBuffer, fontBuffer] = await Promise.all([
        downloadBuffer(BRAT_IMAGE_URL),
        downloadBuffer(BRAT_FONT_URL)
    ]);

    GlobalFonts.register(fontBuffer, TEXT_STYLE.fontFamily);
    const baseImage = await loadImage(imageBuffer);

    loadedResources = { baseImage };
    return loadedResources;
}

async function generateBratVideo(text) {
    const frames = buildRevealFrames(text, VIDEO_CONFIG.lyric);

    if (!frames.length) {
        throw new Error("Teks kosong");
    }

    const { baseImage } = await getResources();
    const timestamp = Date.now();
    const concatPath = path.join(os.tmpdir(), `concat-bratanime-${timestamp}.txt`);
    const outputPath = path.join(os.tmpdir(), `bratanimevid-${timestamp}.mp4`);

    const createdFiles = [concatPath];

    try {
        const manifestLines = [];

        for (let i = 0; i < frames.length; i++) {
            const frameBuffer = await renderFrameBuffer(baseImage, frames[i].text);
            const framePath = path.join(os.tmpdir(), `frame-bratanime-${timestamp}-${i}.png`);

            writeFileSync(framePath, frameBuffer);
            createdFiles.push(framePath);

            const safePath = framePath.replace(/'/g, "'\\''");
            manifestLines.push(`file '${safePath}'`);
            manifestLines.push(`duration ${frames[i].duration}`);
        }

        const lastFramePath = createdFiles[createdFiles.length - 1].replace(/'/g, "'\\''");
        manifestLines.push(`file '${lastFramePath}'`);

        writeFileSync(concatPath, manifestLines.join("\n"));

        await execFileAsync(
            ffmpegPath,
            [
                "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", concatPath,
                "-vf", `fps=${VIDEO_CONFIG.fps},scale=${VIDEO_CONFIG.width}:${VIDEO_CONFIG.height}:flags=lanczos`,
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "18",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                outputPath
            ],
            { maxBuffer: 1024 * 1024 * 10 }
        );

        return { outputPath, createdFiles };
    } catch (err) {
        createdFiles.forEach((file) => {
            if (existsSync(file)) unlinkSync(file);
        });
        if (existsSync(outputPath)) unlinkSync(outputPath);
        throw err;
    }
}

router.get("/", async (req, res) => {
    try {
        const text = req.query.text?.trim();

        if (!text) {
            return res.status(400).json({
                status: false,
                creator: "ArulzXD",
                message: "Masukkan parameter text"
            });
        }

        const { outputPath, createdFiles } = await generateBratVideo(text);

        res.setHeader("Content-Type", "video/mp4");

        res.sendFile(outputPath, (err) => {
            createdFiles.forEach((file) => {
                if (existsSync(file)) unlinkSync(file);
            });
            if (existsSync(outputPath)) unlinkSync(outputPath);

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
    text: "text"
};

router.status = "ready";
router.type = "free";

module.exports = router;