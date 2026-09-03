const express = require("express");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { writeFileSync, existsSync, readFileSync, mkdtempSync, rmSync, unlinkSync } = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const ffmpegPath = require("ffmpeg-static");

const execFileAsync = promisify(execFile);
const router = express.Router();

const FONT_URL = "https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/Font/ARIALN.ttf";
const EMOJI_JSON_URL = "https://media.githubusercontent.com/media/Ditzzx-vibecoder/entahlah/main/emoji-apple.json";

// KONSTANTA DEFAULT OTOMATIS
const DEFAULT_THEME = "white";
const DEFAULT_BLUR = 0;
const DEFAULT_FRAME_DURATION = 0.4;
const DEFAULT_HOLD_DURATION = 1.2;
const DEFAULT_MAX_WORD_PER_LAYER = 1;
const DEFAULT_MAX_WORD_BEFORE_RESET = [7, 8];
const DEFAULT_FAST_PROGRESS = true;

const THEMES = {
  black: { bg: "#000000", text: "#ffffff" },
  white: { bg: "#ffffff", text: "#000000" },
  green: { bg: "#8ace00", text: "#000000" }
};

async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download gagal: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

let fontLoaded = false;
async function ensureFont() {
  if (!fontLoaded) {
    const fontBuffer = await downloadBuffer(FONT_URL);
    GlobalFonts.register(fontBuffer, "ArialNarrow");
    fontLoaded = true;
  }
}

let emojiMap = null;
const emojiImageCache = new Map();

function emojiToUnicode(emoji) {
  return [...emoji].map(c => c.codePointAt(0).toString(16).padStart(4, "0")).join("-");
}

async function loadEmojiMap() {
  if (!emojiMap) {
    const buf = await downloadBuffer(EMOJI_JSON_URL);
    emojiMap = JSON.parse(buf.toString("utf-8"));
  }
  return emojiMap;
}

async function getEmojiImage(emoji) {
  if (emojiImageCache.has(emoji)) return emojiImageCache.get(emoji);
  const map = await loadEmojiMap();
  const base = emojiToUnicode(emoji);
  const variants = [
    base,
    base.replace(/-fe0f/gi, ""),
    `${base.replace(/-fe0f/gi, "")}-fe0f`,
    base.toUpperCase(),
    base.replace(/-fe0f/gi, "").toUpperCase(),
    base.replace(/-fe0f/gi, "").toUpperCase() + "-FE0F"
  ];
  let b64 = null;
  for (const v of variants) {
    if (map[v]) { b64 = map[v]; break; }
  }
  if (!b64) return null;
  const img = await loadImage(Buffer.from(b64, "base64"));
  emojiImageCache.set(emoji, img);
  return img;
}

async function drawAppleEmoji(ctx, emoji, x, y, size) {
  const img = await getEmojiImage(emoji);
  if (!img) { ctx.fillText(emoji, x, y); return; }
  ctx.drawImage(img, x, y, size, size);
}

const EMOJI_REGEX = /(\p{Emoji_Modifier_Base}\p{Emoji_Modifier}|\p{Emoji_Presentation}\uFE0F?|\p{Emoji}\uFE0F|[\u{1F1E0}-\u{1F1FF}]{2}|\p{Extended_Pictographic}\uFE0F?)/gu;

function measureTextCustom(ctx, text, fontSize) {
  const parts = text.split(EMOJI_REGEX);
  let w = 0;
  for (const part of parts) {
    if (!part) continue;
    EMOJI_REGEX.lastIndex = 0;
    if (EMOJI_REGEX.test(part)) w += fontSize;
    else w += ctx.measureText(part).width;
    EMOJI_REGEX.lastIndex = 0;
  }
  return w;
}

async function drawTextWithEmojis(ctx, text, x, y, fontSize) {
  const parts = text.split(EMOJI_REGEX);
  let curX = x;
  for (const part of parts) {
    if (!part) continue;
    EMOJI_REGEX.lastIndex = 0;
    if (EMOJI_REGEX.test(part)) {
      await drawAppleEmoji(ctx, part, curX, y, fontSize);
      curX += fontSize;
    } else {
      ctx.fillText(part, curX, y);
      ctx.measureText(part);
      curX += ctx.measureText(part).width;
    }
    EMOJI_REGEX.lastIndex = 0;
  }
}

function wrapText(ctx, text, maxWidth, fontSize) {
  ctx.font = `${fontSize}px ArialNarrow`;
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? cur + " " + word : word;
    if (measureTextCustom(ctx, test, fontSize) > maxWidth && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function fitsAt(ctx, text, fontSize, maxWidth, maxHeight, lineGap) {
  const lines = wrapText(ctx, text, maxWidth, fontSize);
  const longestWord = Math.max(...text.split(" ").map(w => measureTextCustom(ctx, w, fontSize)));
  const totalHeight = lines.length * (fontSize + lineGap) - lineGap;
  return longestWord <= maxWidth && totalHeight <= maxHeight;
}

function findBestFontSize(ctx, text, maxWidth, maxHeight, lineGap) {
  let lo = 10;
  let hi = 700;
  let best = lo;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fitsAt(ctx, text, mid, maxWidth, maxHeight, lineGap)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function tokenize(text) {
  return text.split(" ").filter(Boolean);
}

async function renderCanvas(text, theme, blurAmount) {
  const selectedTheme = THEMES[theme] || THEMES.white;
  const size = 1000;
  const padding = 80;
  const lineGap = 20;
  const maxWidth = size - padding * 2;
  const maxHeight = size - padding * 2;

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = selectedTheme.bg;
  ctx.fillRect(0, 0, size, size);

  if (!text.trim()) return canvas;

  const fontSize = findBestFontSize(ctx, text, maxWidth, maxHeight, lineGap);
  const lines = wrapText(ctx, text, maxWidth, fontSize);

  ctx.fillStyle = selectedTheme.text;
  ctx.font = `${fontSize}px ArialNarrow`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  ctx.save();
  if (blurAmount > 0) ctx.filter = `blur(${blurAmount}px)`;

  const totalTextHeight = lines.length * (fontSize + lineGap) - lineGap;
  let y = (size - totalTextHeight) / 2;
  for (const line of lines) {
    await drawTextWithEmojis(ctx, line, padding, y, fontSize);
    y += fontSize + lineGap;
  }

  ctx.restore();
  return canvas;
}

async function generateBratVideo({
  text = "Halo Guys Nama Saya",
  theme = DEFAULT_THEME,
  blur = DEFAULT_BLUR,
  format = "mp4",
  frameDuration = DEFAULT_FRAME_DURATION,
  holdDuration = DEFAULT_HOLD_DURATION,
  maxWordPerLayer = DEFAULT_MAX_WORD_PER_LAYER,
  maxWordBeforeReset = DEFAULT_MAX_WORD_BEFORE_RESET,
  fastProgress = DEFAULT_FAST_PROGRESS
} = {}) {
  const blurAmount = [0, 1, 2, 3].includes(blur) ? blur : DEFAULT_BLUR;
  const step = Math.max(1, maxWordPerLayer);
  const resetSchedule = Array.isArray(maxWordBeforeReset)
    ? maxWordBeforeReset.map(n => Math.max(0, n))
    : [Math.max(0, Number(maxWordBeforeReset) || 0)];
  const getResetAt = (batchIndex) => resetSchedule[batchIndex % resetSchedule.length];

  await ensureFont();
  await loadEmojiMap();

  const tokens = tokenize(text);
  if (!tokens.length) throw new Error("Teks kosong");

  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "brat-"));

  const partialTexts = [];
  let batchStart = 0;
  let batchIndex = 0;
  while (batchStart < tokens.length) {
    const resetAt = getResetAt(batchIndex);
    const batchEnd = resetAt > 0 ? Math.min(batchStart + resetAt, tokens.length) : tokens.length;
    for (let i = batchStart + step; i < batchEnd; i += step) {
      partialTexts.push(tokens.slice(batchStart, i).join(" "));
    }
    partialTexts.push(tokens.slice(batchStart, batchEnd).join(" "));
    batchStart = batchEnd;
    batchIndex++;
  }

  const renderFrame = async (partialText, index) => {
    const canvas = await renderCanvas(partialText, theme, blurAmount);
    const buffer = await canvas.encode("png");
    const framePath = path.join(tmpDir, `frame-${String(index + 1).padStart(4, "0")}.png`);
    writeFileSync(framePath, buffer);
    return framePath;
  };

  let framePaths;
  if (fastProgress) {
    framePaths = await Promise.all(partialTexts.map((t, i) => renderFrame(t, i)));
  } else {
    framePaths = [];
    for (let i = 0; i < partialTexts.length; i++) {
      framePaths.push(await renderFrame(partialTexts[i], i));
    }
  }

  const durations = framePaths.map((_, i) =>
    i === framePaths.length - 1 ? holdDuration : frameDuration
  );

  const manifestLines = [];
  for (let i = 0; i < framePaths.length; i++) {
    manifestLines.push(`file '${framePaths[i].replace(/'/g, "'\\''")}'`);
    manifestLines.push(`duration ${durations[i]}`);
  }
  manifestLines.push(`file '${framePaths[framePaths.length - 1].replace(/'/g, "'\\''")}'`);
  const concatPath = path.join(tmpDir, "concat.txt");
  writeFileSync(concatPath, manifestLines.join("\n"));

  const ext = format === "gif" ? "gif" : "mp4";
  const outPath = path.join(os.tmpdir(), `brat-${Date.now()}.${ext}`);

  if (format === "gif") {
    await execFileAsync(ffmpegPath, [
      "-y",
      "-f", "concat", "-safe", "0", "-i", concatPath,
      "-vf", "fps=10,scale=1000:1000:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer",
      "-loop", "0",
      outPath
    ]);
  } else {
    await execFileAsync(ffmpegPath, [
      "-y",
      "-f", "concat", "-safe", "0", "-i", concatPath,
      "-vf", "scale=1000:1000",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outPath
    ]);
  }

  rmSync(tmpDir, { recursive: true, force: true });
  return outPath;
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

    const parseParam = (paramValue) => paramValue ? String(paramValue).split('|')[0].trim() : null;

    // Hanya memproses parameter text, theme, dan format
    const rawTheme = parseParam(req.query.theme) || DEFAULT_THEME;
    const theme = THEMES[rawTheme] ? rawTheme : DEFAULT_THEME;

    const format = (parseParam(req.query.format) || "mp4").toLowerCase();

    // Menggunakan nilai default langsung tanpa mengambil dari req.query
    const filePath = await generateBratVideo({
      text,
      theme,
      format,
      blur: DEFAULT_BLUR,
      frameDuration: DEFAULT_FRAME_DURATION,
      holdDuration: DEFAULT_HOLD_DURATION,
      maxWordPerLayer: DEFAULT_MAX_WORD_PER_LAYER,
      maxWordBeforeReset: DEFAULT_MAX_WORD_BEFORE_RESET,
      fastProgress: DEFAULT_FAST_PROGRESS
    });

    const contentType = format === "gif" ? "image/gif" : "video/mp4";
    res.setHeader("Content-Type", contentType);

    res.sendFile(filePath, (err) => {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
      if (err && !res.headersSent) {
        console.error("Error sending file:", err);
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

// Konfigurasi parameter untuk dashboard/frontend (Hanya text, theme, dan format)
router.paramsConfig = {
  text: "text",
  theme: {
    type: "select",
    options: [
      "white | White Theme",
      "black | Black Theme",
      "green | Green Theme"
    ]
  },
  format: {
    type: "select",
    options: [
      "mp4 | MP4 Video",
      "gif | Animated GIF"
    ]
  }
};

router.status = "ready";
router.type = "free";

module.exports = router;