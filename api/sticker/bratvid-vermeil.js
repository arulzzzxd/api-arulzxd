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

const BRAT_IMAGE_URL = "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Vermile.jpg";
const BRAT_FONT_URL = "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Brat/Poppins.ttf";

const CANVAS = {
  width: 1254,
  height: 1254
};

const SAFE_ZONE = {
  a: 655,
  b: 1118,
  c: 282,
  d: 993
};

const TEXT_STYLE = {
  fontFamily: "PoppinsVermeilVideo",
  maxFontSize: 90,
  minFontSize: 22,
  lineHeight: 1.18,
  color: "#111111",
  align: "center"
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

function getSafeRect(zone) {
  return {
    x: zone.c,
    y: zone.a,
    w: zone.d - zone.c,
    h: zone.b - zone.a,
    centerX: (zone.c + zone.d) / 2,
    centerY: (zone.a + zone.b) / 2
  };
}

function setFont(ctx, size) {
  ctx.font = `${size}px ${TEXT_STYLE.fontFamily}`;
}

function splitLongWord(ctx, word, maxWidth) {
  const chars = [...word];
  const parts = [];
  let current = "";

  for (const char of chars) {
    const test = current + char;
    if (ctx.measureText(test).width <= maxWidth || !current) {
      current = test;
    } else {
      parts.push(current);
      current = char;
    }
  }

  if (current) parts.push(current);
  return parts;
}

function wrapParagraph(ctx, paragraph, maxWidth) {
  const words = paragraph.split(" ").filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;

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
      const parts = splitLongWord(ctx, word, maxWidth);
      lines.push(...parts.slice(0, -1));
      current = parts.at(-1) || "";
    }
  }

  if (current) lines.push(current);
  return lines;
}

function wrapText(ctx, text, maxWidth) {
  return text
    .split("\n")
    .flatMap((paragraph) => {
      const clean = paragraph.trim();
      return clean ? wrapParagraph(ctx, clean, maxWidth) : [""];
    });
}

function fitText(ctx, text, rect) {
  for (let size = TEXT_STYLE.maxFontSize; size >= TEXT_STYLE.minFontSize; size--) {
    setFont(ctx, size);

    const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
    const lines = wrapText(ctx, text, rect.w);
    const totalHeight = lines.length * lineHeight;

    if (totalHeight <= rect.h) {
      return {
        size,
        lines,
        lineHeight,
        totalHeight
      };
    }
  }

  const size = TEXT_STYLE.minFontSize;
  setFont(ctx, size);

  const lineHeight = Math.ceil(size * TEXT_STYLE.lineHeight);
  const lines = wrapText(ctx, text, rect.w);
  const maxLines = Math.max(1, Math.floor(rect.h / lineHeight));
  const clipped = lines.slice(0, maxLines);

  if (lines.length > maxLines && clipped.length) {
    let last = clipped[clipped.length - 1];

    while (last.length > 0 && ctx.measureText(`${last}...`).width > rect.w) {
      last = last.slice(0, -1);
    }

    clipped[clipped.length - 1] = `${last}...`;
  }

  return {
    size,
    lines: clipped,
    lineHeight,
    totalHeight: clipped.length * lineHeight
  };
}

function drawCenteredText(ctx, text, zone) {
  const rect = getSafeRect(zone);
  const fitted = fitText(ctx, text, rect);
  const startY = rect.y + (rect.h - fitted.totalHeight) / 2;

  ctx.save();

  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  setFont(ctx, fitted.size);
  ctx.fillStyle = TEXT_STYLE.color;
  ctx.textAlign = TEXT_STYLE.align;
  ctx.textBaseline = "top";

  for (let i = 0; i < fitted.lines.length; i++) {
    ctx.fillText(fitted.lines[i], rect.centerX, startY + i * fitted.lineHeight);
  }

  ctx.restore();
}

async function renderFrameBuffer(baseImage, text) {
  const canvas = createCanvas(CANVAS.width, CANVAS.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(baseImage, 0, 0, CANVAS.width, CANVAS.height);
  drawCenteredText(ctx, text, SAFE_ZONE);

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
  const concatPath = path.join(os.tmpdir(), `concat-vermeil-${timestamp}.txt`);
  const outputPath = path.join(os.tmpdir(), `vermeilvid-${timestamp}.mp4`);

  const createdFiles = [concatPath];

  try {
    const manifestLines = [];

    for (let i = 0; i < frames.length; i++) {
      const frameBuffer = await renderFrameBuffer(baseImage, frames[i].text);
      const framePath = path.join(os.tmpdir(), `frame-vermeil-${timestamp}-${i}.png`);

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

router.status = "ready";
router.type = "free";

module.exports = router;